import { NextResponse } from "next/server";
import { requireCustomerBirthdaysAccess } from "@/lib/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import { normalizeCustomerBirthday } from "@/lib/customer-birthdays";

type CustomerRow = {
  id: string;
  customer_name: string;
  phone: string | null;
  project: string | null;
  project_id: string | null;
  unit: string | null;
  birthday: string | null;
  tags: string[] | null;
  remarks: string | null;
  created_at: string;
  updated_at: string;
};

const customerSelectFields = `
  id, customer_name, phone, project, project_id, unit, birthday, tags,
  remarks, created_at, updated_at
`;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const allowedFields = new Set(["customerName", "phone", "project", "projectId", "unit", "birthday", "tags", "remarks"]);
const protectedFields = new Set(["id", "ownerUserId", "owner_user_id", "createdAt", "created_at", "updatedAt", "updated_at", "isDeleted", "is_deleted", "deletedAt", "deleted_at"]);

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function notFound() {
  return NextResponse.json({ error: "Customer not found" }, { status: 404 });
}

function serverError(message = "Unable to process Customer Birthdays request") {
  return NextResponse.json({ error: message }, { status: 500 });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function parseBody(request: Request) {
  try {
    const body = await request.json();
    if (!isRecord(body)) return { error: "Request body must be a JSON object" };
    if (Object.keys(body).some((field) => protectedFields.has(field))) return { error: "Protected fields cannot be changed" };
    if (Object.keys(body).some((field) => !allowedFields.has(field))) return { error: "Unsupported fields provided" };
    return { body };
  } catch {
    return { error: "Request body must be valid JSON" };
  }
}

function toCustomer(row: CustomerRow) {
  return {
    id: row.id,
    customerName: row.customer_name,
    phone: row.phone,
    project: row.project,
    projectId: row.project_id,
    unit: row.unit,
    birthday: row.birthday,
    tags: row.tags ?? [],
    remarks: row.remarks,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function bodyFromRow(row: CustomerRow) {
  return {
    customerName: row.customer_name,
    phone: row.phone,
    project: row.project,
    projectId: row.project_id,
    unit: row.unit,
    birthday: row.birthday,
    tags: row.tags ?? [],
    remarks: row.remarks,
  };
}

async function validateProjectId(supabase: ReturnType<typeof createSupabaseAdminClient>, projectId: string | null) {
  if (!projectId) return null;
  const { data, error } = await supabase.from("projects").select("id").eq("id", projectId).eq("is_deleted", false).maybeSingle();
  if (error) throw error;
  return data ? null : "Selected project is unavailable";
}

export async function listCustomerBirthdays() {
  const authorization = await requireCustomerBirthdaysAccess();
  if (!authorization.authorized) return authorization.response;
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.from("customer_birthdays").select(customerSelectFields).eq("owner_user_id", authorization.user.id).eq("is_deleted", false).order("customer_name", { ascending: true });
    if (error) throw error;
    return NextResponse.json({ customerBirthdays: ((data ?? []) as CustomerRow[]).map(toCustomer) });
  } catch (error) {
    console.error("GET /api/customer-birthdays error:", error);
    return serverError("Unable to load customers");
  }
}

export async function createCustomerBirthday(request: Request) {
  const authorization = await requireCustomerBirthdaysAccess();
  if (!authorization.authorized) return authorization.response;
  const parsedBody = await parseBody(request);
  if (!parsedBody.body) return badRequest(parsedBody.error ?? "Invalid request");
  const parsed = normalizeCustomerBirthday(parsedBody.body);
  if ("error" in parsed) return badRequest(parsed.error);
  try {
    const supabase = createSupabaseAdminClient();
    const projectError = await validateProjectId(supabase, parsed.value.project_id);
    if (projectError) return badRequest(projectError);
    const { data, error } = await supabase.from("customer_birthdays").insert({ ...parsed.value, owner_user_id: authorization.user.id }).select(customerSelectFields).single();
    if (error) throw error;
    return NextResponse.json({ customerBirthday: toCustomer(data as CustomerRow) }, { status: 201 });
  } catch (error) {
    console.error("POST /api/customer-birthdays error:", error);
    return serverError("Unable to create customer");
  }
}

async function findOwnedCustomer(customerId: string, ownerUserId: string) {
  if (!uuidPattern.test(customerId)) return { customer: null, error: null };
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from("customer_birthdays").select(customerSelectFields).eq("id", customerId).eq("owner_user_id", ownerUserId).eq("is_deleted", false).maybeSingle();
  return { customer: data as CustomerRow | null, error };
}

export async function getCustomerBirthday(customerId: string) {
  const authorization = await requireCustomerBirthdaysAccess();
  if (!authorization.authorized) return authorization.response;
  try {
    const result = await findOwnedCustomer(customerId, authorization.user.id);
    if (result.error) throw result.error;
    if (!result.customer) return notFound();
    return NextResponse.json({ customerBirthday: toCustomer(result.customer) });
  } catch (error) {
    console.error("GET /api/customer-birthdays/[id] error:", error);
    return serverError("Unable to load customer");
  }
}

export async function updateCustomerBirthday(request: Request, customerId: string) {
  const authorization = await requireCustomerBirthdaysAccess();
  if (!authorization.authorized) return authorization.response;
  const parsedBody = await parseBody(request);
  if (!parsedBody.body) return badRequest(parsedBody.error ?? "Invalid request");
  if (!Object.keys(parsedBody.body).length) return badRequest("No supported fields provided");
  try {
    const existing = await findOwnedCustomer(customerId, authorization.user.id);
    if (existing.error) throw existing.error;
    if (!existing.customer) return notFound();
    const parsed = normalizeCustomerBirthday({ ...bodyFromRow(existing.customer), ...parsedBody.body });
    if ("error" in parsed) return badRequest(parsed.error);
    const supabase = createSupabaseAdminClient();
    const projectError = await validateProjectId(supabase, parsed.value.project_id);
    if (projectError) return badRequest(projectError);
    const { data, error } = await supabase.from("customer_birthdays").update(parsed.value).eq("id", customerId).eq("owner_user_id", authorization.user.id).eq("is_deleted", false).select(customerSelectFields).maybeSingle();
    if (error) throw error;
    if (!data) return notFound();
    return NextResponse.json({ customerBirthday: toCustomer(data as CustomerRow) });
  } catch (error) {
    console.error("PATCH /api/customer-birthdays/[id] error:", error);
    return serverError("Unable to update customer");
  }
}

export async function deleteCustomerBirthday(customerId: string) {
  const authorization = await requireCustomerBirthdaysAccess();
  if (!authorization.authorized) return authorization.response;
  if (!uuidPattern.test(customerId)) return notFound();
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.from("customer_birthdays").update({ is_deleted: true, deleted_at: new Date().toISOString() }).eq("id", customerId).eq("owner_user_id", authorization.user.id).eq("is_deleted", false).select("id").maybeSingle();
    if (error) throw error;
    if (!data) return notFound();
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/customer-birthdays/[id] error:", error);
    return serverError("Unable to delete customer");
  }
}
