import { NextResponse } from "next/server";
import { buildHistoricalSalesPreview, HistoricalWorkbookError } from "@/lib/historical-sales-import";
import { requireSalesApiAccess } from "@/lib/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
const pageSize = 1_000;

function errorDetails(error: unknown) {
  if (error instanceof Error) return { name: error.name, message: error.message, stack: error.stack };
  if (error && typeof error === "object") return error;
  return { value: String(error) };
}

async function fetchAll<T>(fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) throw error;
    const page = data ?? [];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

export async function POST(request: Request) {
  const authorization = await requireSalesApiAccess(true);
  if (!authorization.authorized) return authorization.response;

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Choose a 2026 Case Report workbook" }, { status: 400 });

    const supabase = createSupabaseAdminClient();
    const [projects, members, activeCases] = await Promise.all([
      fetchAll((from, to) => supabase.from("projects").select("id, project_name").eq("is_deleted", false).range(from, to)),
      fetchAll((from, to) => supabase.from("users").select("id, full_name, position").eq("is_deleted", false).range(from, to)),
      fetchAll((from, to) => supabase.from("sales_cases").select("id, project_id, unit_no, status").eq("is_deleted", false).neq("status", "cancelled").range(from, to)),
    ]);

    const preview = await buildHistoricalSalesPreview(file, {
      projects, members, activeCases, fingerprints: [],
    });
    return NextResponse.json({ preview });
  } catch (error) {
    console.error("POST /api/sales/import/preview failed", errorDetails(error));
    const safeMessage = error instanceof HistoricalWorkbookError ? error.message : "Unable to preview historical Sales workbook";
    const developmentDetails = process.env.NODE_ENV === "development" ? { details: errorDetails(error) } : {};
    return NextResponse.json({ error: safeMessage, ...developmentDetails }, { status: 500 });
  }
}
