import { NextResponse } from "next/server";
import { canManageSales, requireSalesApiAccess } from "@/lib/permissions";
import { calculateSalesAnalytics, getSalesDateRange, parseSalesPercentage, salesStatuses, type SalesCase, type SalesStatus } from "@/lib/sales";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import { isValidDateString } from "@/lib/malaysia-date";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const salesCaseSelect = `
  id, project_id, unit_no, booking_date, nett_price, falcon_portion, status,
  spa_signed_date, cancel_date, remark, created_at, updated_at,
  project:projects!sales_cases_project_id_fkey(project_name),
  contributors:sales_case_contributors(member_id, portion, member:users!sales_case_contributors_member_id_fkey(full_name, position)),
  status_history:sales_case_status_history(status, effective_date, created_at, event_type, note),
  unit_history:sales_unit_history(previous_unit_no, new_unit_no, changed_at)
`;

type InputContributor = { memberId: string; portion: string };
type SalesInput = {
  projectId: string; unitNo: string; bookingDate: string; nettPrice: number;
  falconPortion: string; status: SalesStatus; spaSignedDate: string | null;
  cancelDate: string | null; remark: string | null; contributors: InputContributor[];
};
type SalesCaseDbRow = {
  id: string; project_id: string; unit_no: string; booking_date: string; nett_price: number | string;
  falcon_portion: number | string; status: SalesStatus; spa_signed_date: string | null; cancel_date: string | null;
  remark: string | null; project: { project_name: string | null } | null;
  contributors: Array<{ member_id: string; portion: number | string; member: { full_name: string | null; position: string | null } | null }> | null;
  status_history: Array<{ status: SalesStatus; effective_date: string | null; created_at: string; event_type: "lifecycle" | "spa_correction"; note: string | null }> | null;
  unit_history: Array<{ previous_unit_no: string; new_unit_no: string; changed_at: string }> | null;
};

function badRequest(error: string) { return NextResponse.json({ error }, { status: 400 }); }
function numeric(value: unknown) { const result = Number(value); return Number.isFinite(result) ? result : null; }

async function parseInput(request: Request) {
  let body: Record<string, unknown>;
  try {
    const value = await request.json();
    if (!value || typeof value !== "object" || Array.isArray(value)) return { error: "Request body must be an object" } as const;
    body = value as Record<string, unknown>;
  } catch { return { error: "Request body must be valid JSON" } as const; }

  const projectId = typeof body.projectId === "string" ? body.projectId : "";
  const unitNo = typeof body.unitNo === "string" ? body.unitNo.trim() : "";
  const bookingDate = typeof body.bookingDate === "string" ? body.bookingDate : "";
  const nettPrice = numeric(body.nettPrice);
  const falconPortion = parseSalesPercentage(body.falconPortion);
  const status = typeof body.status === "string" && salesStatuses.includes(body.status as SalesStatus) ? body.status as SalesStatus : null;
  const spaSignedDate = typeof body.spaSignedDate === "string" && body.spaSignedDate ? body.spaSignedDate : null;
  const cancelDate = typeof body.cancelDate === "string" && body.cancelDate ? body.cancelDate : null;
  const remark = typeof body.remark === "string" && body.remark.trim() ? body.remark.trim() : null;
  if (!uuidPattern.test(projectId)) return { error: "Project is required" } as const;
  if (!unitNo || unitNo.length > 80) return { error: "Unit No is required and must be 80 characters or fewer" } as const;
  if (!isValidDateString(bookingDate)) return { error: "Booking Date is required" } as const;
  if (nettPrice === null || nettPrice <= 0) return { error: "Nett Price must be greater than 0" } as const;
  if (!falconPortion) return { error: "Falcon Portion must be greater than 0, no more than 100, and use at most 4 decimal places" } as const;
  if (!status) return { error: "Status is invalid" } as const;
  if (status === "sign_spa" && (!spaSignedDate || !isValidDateString(spaSignedDate))) return { error: "SPA Signed Date is required for Sign SPA" } as const;
  if (status === "cancelled" && (!cancelDate || !isValidDateString(cancelDate))) return { error: "Cancel Date is required for Cancelled cases" } as const;
  if (spaSignedDate && isValidDateString(spaSignedDate) && spaSignedDate < bookingDate) return { error: "SPA Signed Date cannot be before Booking Date" } as const;
  if (cancelDate && isValidDateString(cancelDate) && cancelDate < bookingDate) return { error: "Cancel Date cannot be before Booking Date" } as const;
  if (spaSignedDate && cancelDate && isValidDateString(spaSignedDate) && isValidDateString(cancelDate) && cancelDate < spaSignedDate) return { error: "Cancel Date cannot be before SPA Signed Date" } as const;
  if (remark && remark.length > 2000) return { error: "Remark must be 2,000 characters or fewer" } as const;
  if (!Array.isArray(body.contributors) || body.contributors.length === 0) return { error: "At least one contributor is required" } as const;

  const contributors: InputContributor[] = [];
  for (const raw of body.contributors) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { error: "Contributor is invalid" } as const;
    const item = raw as Record<string, unknown>;
    const memberId = typeof item.memberId === "string" ? item.memberId : "";
    const portion = parseSalesPercentage(item.portion);
    if (!uuidPattern.test(memberId) || !portion) return { error: "Every contributor needs a valid member and a portion using at most 4 decimal places" } as const;
    contributors.push({ memberId, portion: portion.normalized });
  }
  if (new Set(contributors.map((item) => item.memberId)).size !== contributors.length) return { error: "A contributor can only be selected once" } as const;
  const allocatedScaled = contributors.reduce((sum, item) => sum + (parseSalesPercentage(item.portion)?.scaled ?? 0), 0);
  if (allocatedScaled !== falconPortion.scaled) return { error: "Contributor allocations must exactly equal Falcon Portion" } as const;
  return { input: { projectId, unitNo, bookingDate, nettPrice, falconPortion: falconPortion.normalized, status, spaSignedDate: status === "sign_spa" ? spaSignedDate : null, cancelDate: status === "cancelled" ? cancelDate : null, remark, contributors } satisfies SalesInput } as const;
}

function toSalesCase(row: SalesCaseDbRow): SalesCase {
  return {
    id: row.id, projectId: row.project_id, projectName: row.project?.project_name ?? "Unknown project",
    unitNo: row.unit_no, bookingDate: row.booking_date, nettPrice: Number(row.nett_price),
    falconPortion: Number(row.falcon_portion), status: row.status, spaSignedDate: row.spa_signed_date,
    cancelDate: row.cancel_date, remark: row.remark,
    contributors: (row.contributors ?? []).map((item) => ({ memberId: item.member_id, memberName: item.member?.full_name ?? "Unknown member", position: item.member?.position ?? null, portion: Number(item.portion) })),
    statusHistory: (row.status_history ?? []).map((item) => ({ status: item.status, effectiveDate: item.effective_date, createdAt: item.created_at, eventType: item.event_type, note: item.note })).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    unitHistory: (row.unit_history ?? []).map((item) => ({ previousUnitNo: item.previous_unit_no, newUnitNo: item.new_unit_no, changedAt: item.changed_at })).sort((a, b) => b.changedAt.localeCompare(a.changedAt)),
  };
}

export async function listSales(request: Request) {
  const authorization = await requireSalesApiAccess();
  if (!authorization.authorized) return authorization.response;
  try {
    const supabase = createSupabaseAdminClient();
    const rows: SalesCaseDbRow[] = [];
    const pageSize = 1000;
    for (let offset = 0; ; offset += pageSize) {
      const { data: page, error } = await supabase.from("sales_cases").select(salesCaseSelect).eq("is_deleted", false).order("booking_date", { ascending: false }).order("id", { ascending: true }).range(offset, offset + pageSize - 1);
      if (error) throw error;
      const pageRows = (page ?? []) as unknown as SalesCaseDbRow[];
      rows.push(...pageRows);
      if (pageRows.length < pageSize) break;
    }
    const allCases = rows.map(toSalesCase);
    const url = new URL(request.url);
    const range = getSalesDateRange(url.searchParams.get("period"), url.searchParams.get("from"), url.searchParams.get("to"));
    const canManage = canManageSales(authorization.profile);
    const visibleCases = canManage ? allCases : allCases.filter((item) => item.contributors.some((contributor) => contributor.memberId === authorization.profile.member_id));
    const projectId = url.searchParams.get("projectId");
    const status = url.searchParams.get("status");
    const memberId = url.searchParams.get("memberId");
    const search = url.searchParams.get("search")?.trim().toLowerCase();
    const records = visibleCases.filter((item) => item.bookingDate >= range.from && item.bookingDate <= range.to)
      .filter((item) => !projectId || item.projectId === projectId)
      .filter((item) => !status || item.status === status)
      .filter((item) => !memberId || item.contributors.some((contributor) => contributor.memberId === memberId))
      .filter((item) => !search || item.projectName.toLowerCase().includes(search) || item.unitNo.toLowerCase().includes(search));

    const [{ data: projects, error: projectsError }, { data: members, error: membersError }] = await Promise.all([
      supabase.from("projects").select("id, project_name").eq("is_deleted", false).order("project_name"),
      supabase.from("users").select("id, full_name, position").eq("is_deleted", false).eq("status", "Active").order("full_name"),
    ]);
    if (projectsError) throw projectsError;
    if (membersError) throw membersError;
    return NextResponse.json({ range, canManage, analytics: calculateSalesAnalytics(allCases, range.from, range.to), records, projects: projects ?? [], members: canManage ? members ?? [] : [] });
  } catch (error) {
    console.error("GET /api/sales error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load Sales" }, { status: 500 });
  }
}

async function saveSales(request: Request, caseId: string | null) {
  const authorization = await requireSalesApiAccess(true);
  if (!authorization.authorized) return authorization.response;
  if (caseId && !uuidPattern.test(caseId)) return badRequest("Sales case id is invalid");
  const parsed = await parseInput(request);
  if ("error" in parsed && parsed.error) return badRequest(parsed.error);
  const input = parsed.input;
  try {
    const supabase = createSupabaseAdminClient();
    if (caseId) {
      const { data: existing, error: existingError } = await supabase.from("sales_cases").select("status, spa_signed_date").eq("id", caseId).eq("is_deleted", false).maybeSingle();
      if (existingError) throw existingError;
      if (!existing) return badRequest("Sales case not found");
      if (existing.status === "cancelled" && input.status !== "cancelled") return badRequest("Cancelled cases are terminal. Create a new case for a rebooking");
      if (existing.status === "sign_spa" && input.status !== "sign_spa" && input.status !== "cancelled") return badRequest("Use Remove Incorrect SPA Record to correct an erroneous conversion");
      if (input.status === "cancelled" && existing.spa_signed_date && input.cancelDate && input.cancelDate < existing.spa_signed_date) return badRequest("Cancel Date cannot be before SPA Signed Date");
    }
    const [{ data: project }, { data: validMembers }] = await Promise.all([
      supabase.from("projects").select("id").eq("id", input.projectId).eq("is_deleted", false).maybeSingle(),
      supabase.from("users").select("id").in("id", input.contributors.map((item) => item.memberId)).eq("is_deleted", false).eq("status", "Active"),
    ]);
    if (!project) return badRequest("Project is not available");
    if ((validMembers ?? []).length !== input.contributors.length) return badRequest("Every contributor must be an active Falcon member");
    const { data, error } = await supabase.rpc("save_sales_case", {
      p_case_id: caseId, p_project_id: input.projectId, p_unit_no: input.unitNo,
      p_booking_date: input.bookingDate, p_nett_price: input.nettPrice, p_falcon_portion: input.falconPortion,
      p_status: input.status, p_spa_signed_date: input.spaSignedDate, p_cancel_date: input.cancelDate,
      p_remark: input.remark ?? "", p_contributors: input.contributors, p_actor: authorization.user.id,
    });
    if (error) throw error;
    return NextResponse.json({ id: data }, { status: caseId ? 200 : 201 });
  } catch (error) {
    console.error(`${caseId ? "PATCH" : "POST"} /api/sales error:`, error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save Sales case" }, { status: 500 });
  }
}

export function createSales(request: Request) { return saveSales(request, null); }
export function updateSales(request: Request, caseId: string) { return saveSales(request, caseId); }

export async function correctSalesSpa(request: Request, caseId: string) {
  const authorization = await requireSalesApiAccess(true);
  if (!authorization.authorized) return authorization.response;
  if (!uuidPattern.test(caseId)) return badRequest("Sales case id is invalid");
  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return badRequest("Request body must be an object");
    body = parsed as Record<string, unknown>;
  } catch { return badRequest("Request body must be valid JSON"); }
  const restoredStatus = typeof body.restoredStatus === "string" ? body.restoredStatus : "";
  const note = typeof body.note === "string" ? body.note.trim() : "";
  if (body.confirm !== true) return badRequest("SPA correction must be explicitly confirmed");
  if (!["booking", "submitted", "loan_approved"].includes(restoredStatus)) return badRequest("Select Booking, Submitted, or Loan Approved as the restored status");
  if (!note || note.length > 1000) return badRequest("A correction note is required and must be 1,000 characters or fewer");
  try {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.rpc("correct_sales_case_spa", { p_case_id: caseId, p_restored_status: restoredStatus, p_note: note, p_actor: authorization.user.id });
    if (error) throw error;
    return NextResponse.json({ corrected: true });
  } catch (error) {
    console.error("POST /api/sales/[id]/correct-spa error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to correct SPA record" }, { status: 500 });
  }
}
