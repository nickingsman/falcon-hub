import { NextResponse } from "next/server";
import { canManageSales, requireSalesApiAccess } from "@/lib/permissions";
import { getMemberDisplayName } from "@/lib/member-display";
import { getSalesDateRange, salesStatuses, type SalesStatus } from "@/lib/sales";
import {
  calculateProjectContributionReport,
  filterProjectContributionCasesForAccess,
  getProjectContributionProjectKey,
  normalizeHistoricalIdentity,
  type ProjectContributionCase,
  type ProjectContributionStatusFilter,
} from "@/lib/sales-project-contribution";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const reportSelect = `
  id, project_id, source_project_name, unit_no, booking_date, nett_price, status,
  project:projects!sales_cases_project_id_fkey(project_name),
  contributors:sales_case_contributors(id, member_id, source_member_name, portion, member:users!sales_case_contributors_member_id_fkey(full_name, display_name))
`;

type ProjectOption = { id: string; label: string; kind: "current" | "historical" };
type ProjectIdentityRow = {
  id: string;
  project_id: string | null;
  source_project_name: string | null;
  project: { project_name: string | null } | null;
};
type ReportRow = ProjectIdentityRow & {
  unit_no: string;
  booking_date: string;
  nett_price: number | string;
  status: SalesStatus;
  contributors: Array<{
    id: string;
    member_id: string | null;
    source_member_name: string | null;
    portion: number | string;
    member: { full_name: string | null; display_name: string | null } | null;
  }> | null;
};

function parseStatusFilter(value: string | null): ProjectContributionStatusFilter {
  if (value === "converted" || value === "all") return value;
  return salesStatuses.includes(value as SalesStatus) ? value as SalesStatus : "all";
}

async function getVisibleProjectOptions(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  canManage: boolean,
  memberId: string | null,
) {
  const { data: activeProjects, error: projectsError } = await supabase
    .from("projects")
    .select("id, project_name")
    .eq("is_deleted", false)
    .order("project_name");
  if (projectsError) throw projectsError;

  let visibleCaseIds: string[] | null = null;
  if (!canManage) {
    if (!memberId) visibleCaseIds = [];
    else {
      const contributorCaseIds: string[] = [];
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await supabase
          .from("sales_case_contributors")
          .select("sales_case_id")
          .eq("member_id", memberId)
          .range(offset, offset + 999);
        if (error) throw error;
        contributorCaseIds.push(...(data ?? []).map((row) => row.sales_case_id));
        if ((data ?? []).length < 1000) break;
      }
      visibleCaseIds = [...new Set(contributorCaseIds)];
    }
  }

  const identityRows: ProjectIdentityRow[] = [];
  if (visibleCaseIds === null) {
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await supabase
        .from("sales_cases")
        .select("id, project_id, source_project_name, project:projects!sales_cases_project_id_fkey(project_name)")
        .eq("is_deleted", false)
        .range(offset, offset + 999);
      if (error) throw error;
      const page = (data ?? []) as unknown as ProjectIdentityRow[];
      identityRows.push(...page);
      if (page.length < 1000) break;
    }
  } else {
    for (let offset = 0; offset < visibleCaseIds.length; offset += 500) {
      const caseIds = visibleCaseIds.slice(offset, offset + 500);
      if (!caseIds.length) continue;
      const { data, error } = await supabase
        .from("sales_cases")
        .select("id, project_id, source_project_name, project:projects!sales_cases_project_id_fkey(project_name)")
        .eq("is_deleted", false)
        .in("id", caseIds);
      if (error) throw error;
      identityRows.push(...(data ?? []) as unknown as ProjectIdentityRow[]);
    }
  }

  const options = new Map<string, ProjectOption>();
  for (const project of activeProjects ?? []) {
    if (!project.project_name?.trim()) continue;
    options.set(`project:${project.id}`, { id: `project:${project.id}`, label: project.project_name.trim(), kind: "current" });
  }
  for (const row of identityRows) {
    const key = getProjectContributionProjectKey(row.project_id, row.source_project_name);
    const label = row.project?.project_name?.trim() || row.source_project_name?.trim();
    if (!label || key === "historical:unknown") continue;
    if (!options.has(key)) options.set(key, { id: key, label, kind: row.project_id ? "current" : "historical" });
  }
  return [...options.values()].sort((a, b) => a.label.localeCompare(b.label, "en-MY") || a.id.localeCompare(b.id));
}

export async function GET(request: Request) {
  const authorization = await requireSalesApiAccess();
  if (!authorization.authorized) return authorization.response;

  try {
    const supabase = createSupabaseAdminClient();
    const canManage = canManageSales(authorization.profile);
    const options = await getVisibleProjectOptions(supabase, canManage, authorization.profile.member_id);
    const url = new URL(request.url);
    const projectKey = url.searchParams.get("projectKey")?.trim() ?? "";
    if (!projectKey) return NextResponse.json({ projects: options, report: null });

    const selectedProject = options.find((option) => option.id === projectKey);
    if (!selectedProject) return NextResponse.json({ error: "Project is not available" }, { status: 400 });

    const range = getSalesDateRange(url.searchParams.get("period"), url.searchParams.get("from"), url.searchParams.get("to"));
    const statusFilter = parseStatusFilter(url.searchParams.get("status"));
    const projectId = projectKey.startsWith("project:") ? projectKey.slice("project:".length) : null;
    if (projectId && !uuidPattern.test(projectId)) return NextResponse.json({ error: "Project is invalid" }, { status: 400 });
    let rows: ReportRow[] = [];
    for (let offset = 0; ; offset += 1000) {
      let query = supabase
        .from("sales_cases")
        .select(reportSelect)
        .eq("is_deleted", false)
        .gte("booking_date", range.from)
        .lte("booking_date", range.to)
        .order("booking_date", { ascending: false })
        .order("id", { ascending: true })
        .range(offset, offset + 999);
      query = projectId ? query.eq("project_id", projectId) : query.is("project_id", null);
      if (statusFilter === "converted") query = query.eq("status", "sign_spa");
      else if (statusFilter !== "all") query = query.eq("status", statusFilter);
      const { data, error } = await query;
      if (error) throw error;
      const page = (data ?? []) as unknown as ReportRow[];
      rows.push(...page);
      if (page.length < 1000) break;
    }
    if (projectKey.startsWith("historical:")) {
      const expectedName = projectKey.slice("historical:".length);
      rows = rows.filter((row) => normalizeHistoricalIdentity(row.source_project_name ?? "") === expectedName);
    }
    const cases = filterProjectContributionCasesForAccess(rows.map((row): ProjectContributionCase => ({
      id: row.id,
      projectKey: getProjectContributionProjectKey(row.project_id, row.source_project_name),
      projectName: row.project?.project_name?.trim() || row.source_project_name?.trim() || "Unknown project",
      unitNo: row.unit_no,
      bookingDate: row.booking_date,
      nettPrice: Number(row.nett_price),
      status: row.status,
      contributors: (row.contributors ?? []).map((contributor) => ({
        memberId: contributor.member_id,
        sourceMemberName: contributor.source_member_name,
        memberName: contributor.member ? getMemberDisplayName(contributor.member) : contributor.source_member_name?.trim() || "Unknown member",
        portion: Number(contributor.portion),
      })),
    })), canManage, authorization.profile.member_id);
    const report = calculateProjectContributionReport(cases, {
      projectKey,
      projectName: selectedProject.label,
      from: range.from,
      to: range.to,
      statusFilter,
    });
    return NextResponse.json({ projects: options, report });
  } catch (error) {
    console.error("GET /api/sales/project-contributions error:", error);
    return NextResponse.json({ error: "Unable to load Project Contribution Report" }, { status: 500 });
  }
}
