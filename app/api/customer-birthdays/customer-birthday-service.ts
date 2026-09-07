import { NextResponse } from "next/server";
import { getAuthenticatedUserProfile } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

type CustomerBirthdayRow = {
  id: string;
  customer_name: string;
  project: string | null;
  unit: string | null;
  birthday: string;
  remarks: string | null;
  created_at: string;
  updated_at: string;
};

type CustomerBirthdayInput = {
  customer_name: string;
  project: string | null;
  unit: string | null;
  birthday: string;
  remarks: string | null;
};

const customerBirthdaySelectFields = `
  id,
  customer_name,
  project,
  unit,
  birthday,
  created_at,
  updated_at,
  remarks
`;

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function unauthorized() {
  return NextResponse.json({ error: "Authentication required" }, { status: 401 });
}

function forbidden(message = "Active user profile is required") {
  return NextResponse.json({ error: message }, { status: 403 });
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function notFound() {
  return NextResponse.json({ error: "Customer birthday not found" }, { status: 404 });
}

function serverError(message = "Unable to process Customer Birthday request") {
  return NextResponse.json({ error: message }, { status: 500 });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeRequiredText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();

  if (!trimmed || trimmed.length > maxLength) return null;

  return trimmed;
}

function normalizeOptionalText(value: unknown, maxLength: number) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return null;

  const trimmed = value.trim();

  if (!trimmed) return null;
  if (trimmed.length > maxLength) return null;

  return trimmed;
}

function normalizeBirthday(value: unknown) {
  if (typeof value !== "string") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

  const [yearPart, monthPart, dayPart] = value.split("-");
  const year = Number(yearPart);
  const month = Number(monthPart);
  const day = Number(dayPart);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }

  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return value;
}

function hasProtectedCustomerBirthdayField(body: Record<string, unknown>) {
  return [
    "id",
    "ownerUserId",
    "owner_user_id",
    "createdAt",
    "created_at",
    "updatedAt",
    "updated_at",
    "isDeleted",
    "is_deleted",
    "deletedAt",
    "deleted_at",
  ].some((field) => Object.hasOwn(body, field));
}

function hasUnsupportedCustomerBirthdayField(body: Record<string, unknown>) {
  const allowedFields = new Set(["customerName", "project", "unit", "birthday", "remarks"]);

  return Object.keys(body).some((field) => !allowedFields.has(field));
}

async function requireCustomerBirthdayAccess() {
  const authContext = await getAuthenticatedUserProfile();

  if (!authContext) {
    return { authorized: false, response: unauthorized() } as const;
  }

  if (!authContext.profile || authContext.profile.status !== "active") {
    return { authorized: false, response: forbidden() } as const;
  }

  return {
    authorized: true,
    context: {
      ownerUserId: authContext.user.id,
    },
  } as const;
}

function toCustomerBirthday(row: CustomerBirthdayRow) {
  return {
    id: row.id,
    customerName: row.customer_name,
    project: row.project,
    unit: row.unit,
    birthday: row.birthday,
    remarks: row.remarks,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function parseCustomerBirthdayInput(request: Request) {
  let body: Record<string, unknown>;

  try {
    const parsed = await request.json();
    if (!isRecord(parsed)) {
      return { valid: false, response: badRequest("Request body must be a JSON object") } as const;
    }
    body = parsed;
  } catch {
    return { valid: false, response: badRequest("Request body must be valid JSON") } as const;
  }

  if (hasProtectedCustomerBirthdayField(body)) {
    return { valid: false, response: badRequest("Protected fields cannot be changed") } as const;
  }

  if (hasUnsupportedCustomerBirthdayField(body)) {
    return { valid: false, response: badRequest("Unsupported fields provided") } as const;
  }

  const customerName = normalizeRequiredText(body.customerName, 120);
  if (!customerName) {
    return { valid: false, response: badRequest("Customer name is required") } as const;
  }

  const birthday = normalizeBirthday(body.birthday);
  if (!birthday) {
    return { valid: false, response: badRequest("Birthday must use YYYY-MM-DD format") } as const;
  }

  const project = normalizeOptionalText(body.project, 160);
  if (body.project !== undefined && body.project !== null && typeof body.project !== "string") {
    return { valid: false, response: badRequest("Project is invalid") } as const;
  }
  if (typeof body.project === "string" && body.project.trim() && !project) {
    return { valid: false, response: badRequest("Project must be 160 characters or fewer") } as const;
  }

  const unit = normalizeOptionalText(body.unit, 80);
  if (body.unit !== undefined && body.unit !== null && typeof body.unit !== "string") {
    return { valid: false, response: badRequest("Unit is invalid") } as const;
  }
  if (typeof body.unit === "string" && body.unit.trim() && !unit) {
    return { valid: false, response: badRequest("Unit must be 80 characters or fewer") } as const;
  }

  const remarks = normalizeOptionalText(body.remarks, 1000);
  if (body.remarks !== undefined && body.remarks !== null && typeof body.remarks !== "string") {
    return { valid: false, response: badRequest("Remarks is invalid") } as const;
  }
  if (typeof body.remarks === "string" && body.remarks.trim() && !remarks) {
    return { valid: false, response: badRequest("Remarks must be 1000 characters or fewer") } as const;
  }

  return {
    valid: true,
    input: {
      customer_name: customerName,
      project,
      unit,
      birthday,
      remarks,
    },
  } as const;
}

async function parseCustomerBirthdayPatchInput(request: Request) {
  let body: Record<string, unknown>;

  try {
    const parsed = await request.json();
    if (!isRecord(parsed)) {
      return { valid: false, response: badRequest("Request body must be a JSON object") } as const;
    }
    body = parsed;
  } catch {
    return { valid: false, response: badRequest("Request body must be valid JSON") } as const;
  }

  if (hasProtectedCustomerBirthdayField(body)) {
    return { valid: false, response: badRequest("Protected fields cannot be changed") } as const;
  }

  if (hasUnsupportedCustomerBirthdayField(body)) {
    return { valid: false, response: badRequest("Unsupported fields provided") } as const;
  }

  const updates: Partial<CustomerBirthdayInput> = {};

  if (Object.hasOwn(body, "customerName")) {
    const customerName = normalizeRequiredText(body.customerName, 120);
    if (!customerName) {
      return { valid: false, response: badRequest("Customer name is required") } as const;
    }
    updates.customer_name = customerName;
  }

  if (Object.hasOwn(body, "birthday")) {
    const birthday = normalizeBirthday(body.birthday);
    if (!birthday) {
      return { valid: false, response: badRequest("Birthday must use YYYY-MM-DD format") } as const;
    }
    updates.birthday = birthday;
  }

  if (Object.hasOwn(body, "project")) {
    const project = normalizeOptionalText(body.project, 160);
    if (body.project !== null && body.project !== undefined && typeof body.project !== "string") {
      return { valid: false, response: badRequest("Project is invalid") } as const;
    }
    if (typeof body.project === "string" && body.project.trim() && !project) {
      return { valid: false, response: badRequest("Project must be 160 characters or fewer") } as const;
    }
    updates.project = project;
  }

  if (Object.hasOwn(body, "unit")) {
    const unit = normalizeOptionalText(body.unit, 80);
    if (body.unit !== null && body.unit !== undefined && typeof body.unit !== "string") {
      return { valid: false, response: badRequest("Unit is invalid") } as const;
    }
    if (typeof body.unit === "string" && body.unit.trim() && !unit) {
      return { valid: false, response: badRequest("Unit must be 80 characters or fewer") } as const;
    }
    updates.unit = unit;
  }

  if (Object.hasOwn(body, "remarks")) {
    const remarks = normalizeOptionalText(body.remarks, 1000);
    if (body.remarks !== null && body.remarks !== undefined && typeof body.remarks !== "string") {
      return { valid: false, response: badRequest("Remarks is invalid") } as const;
    }
    if (typeof body.remarks === "string" && body.remarks.trim() && !remarks) {
      return { valid: false, response: badRequest("Remarks must be 1000 characters or fewer") } as const;
    }
    updates.remarks = remarks;
  }

  if (Object.keys(updates).length === 0) {
    return { valid: false, response: badRequest("No supported fields provided") } as const;
  }

  return { valid: true, updates } as const;
}

export async function listCustomerBirthdays() {
  const authorization = await requireCustomerBirthdayAccess();

  if (!authorization.authorized) {
    return authorization.response;
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("customer_birthdays")
      .select(customerBirthdaySelectFields)
      .eq("owner_user_id", authorization.context.ownerUserId)
      .eq("is_deleted", false)
      .order("birthday", { ascending: true })
      .order("customer_name", { ascending: true });

    if (error) {
      throw error;
    }

    return NextResponse.json({
      customerBirthdays: ((data ?? []) as CustomerBirthdayRow[]).map(toCustomerBirthday),
    });
  } catch (error) {
    console.error("GET /api/customer-birthdays error:", error);

    return serverError("Unable to load Customer Birthdays");
  }
}

export async function createCustomerBirthday(request: Request) {
  const authorization = await requireCustomerBirthdayAccess();

  if (!authorization.authorized) {
    return authorization.response;
  }

  const parsed = await parseCustomerBirthdayInput(request);

  if (!parsed.valid) {
    return parsed.response;
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("customer_birthdays")
      .insert({
        ...parsed.input,
        owner_user_id: authorization.context.ownerUserId,
      })
      .select(customerBirthdaySelectFields)
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json(
      { customerBirthday: toCustomerBirthday(data as CustomerBirthdayRow) },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/customer-birthdays error:", error);

    return serverError("Unable to create Customer Birthday");
  }
}

export async function getCustomerBirthday(customerBirthdayId: string) {
  const authorization = await requireCustomerBirthdayAccess();

  if (!authorization.authorized) {
    return authorization.response;
  }

  if (!uuidPattern.test(customerBirthdayId)) {
    return notFound();
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("customer_birthdays")
      .select(customerBirthdaySelectFields)
      .eq("id", customerBirthdayId)
      .eq("owner_user_id", authorization.context.ownerUserId)
      .eq("is_deleted", false)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return notFound();
    }

    return NextResponse.json({
      customerBirthday: toCustomerBirthday(data as CustomerBirthdayRow),
    });
  } catch (error) {
    console.error("GET /api/customer-birthdays/[id] error:", error);

    return serverError("Unable to load Customer Birthday");
  }
}

export async function updateCustomerBirthday(request: Request, customerBirthdayId: string) {
  const authorization = await requireCustomerBirthdayAccess();

  if (!authorization.authorized) {
    return authorization.response;
  }

  if (!uuidPattern.test(customerBirthdayId)) {
    return notFound();
  }

  const parsed = await parseCustomerBirthdayPatchInput(request);

  if (!parsed.valid) {
    return parsed.response;
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("customer_birthdays")
      .update(parsed.updates)
      .eq("id", customerBirthdayId)
      .eq("owner_user_id", authorization.context.ownerUserId)
      .eq("is_deleted", false)
      .select(customerBirthdaySelectFields)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return notFound();
    }

    return NextResponse.json({
      customerBirthday: toCustomerBirthday(data as CustomerBirthdayRow),
    });
  } catch (error) {
    console.error("PATCH /api/customer-birthdays/[id] error:", error);

    return serverError("Unable to update Customer Birthday");
  }
}

export async function deleteCustomerBirthday(customerBirthdayId: string) {
  const authorization = await requireCustomerBirthdayAccess();

  if (!authorization.authorized) {
    return authorization.response;
  }

  if (!uuidPattern.test(customerBirthdayId)) {
    return notFound();
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("customer_birthdays")
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
      })
      .eq("id", customerBirthdayId)
      .eq("owner_user_id", authorization.context.ownerUserId)
      .eq("is_deleted", false)
      .select("id")
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return notFound();
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/customer-birthdays/[id] error:", error);

    return serverError("Unable to delete Customer Birthday");
  }
}
