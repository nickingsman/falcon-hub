import { NextResponse } from "next/server";
import { getAuthenticatedUserProfile } from "@/lib/auth";
import {
  isSavedWorkType,
  normalizeSavedWorkSchemaVersion,
  normalizeSavedWorkTitle,
  validateSavedWorkPayload,
  type SavedWorkType,
} from "@/lib/saved-work";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

type SavedWorkRow = {
  id: string;
  title: string;
  work_type: SavedWorkType;
  schema_version: number;
  payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type SavedWorkMetadataRow = Omit<SavedWorkRow, "payload">;

const savedWorkSelectFields = `
  id,
  title,
  work_type,
  schema_version,
  payload,
  created_at,
  updated_at
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
  return NextResponse.json({ error: "Saved Work not found" }, { status: 404 });
}

function serverError(message = "Unable to process Saved Work request") {
  return NextResponse.json({ error: message }, { status: 500 });
}

function hasProtectedSavedWorkField(body: Record<string, unknown>) {
  return [
    "id",
    "ownerUserId",
    "owner_user_id",
    "workType",
    "work_type",
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

async function requireSavedWorkAccess() {
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

function toSavedWorkMetadata(row: SavedWorkMetadataRow) {
  return {
    id: row.id,
    title: row.title,
    workType: row.work_type,
    schemaVersion: row.schema_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toSavedWorkDetail(row: SavedWorkRow) {
  return {
    ...toSavedWorkMetadata(row),
    payload: row.payload,
  };
}

function parseLimit(request: Request) {
  const url = new URL(request.url);
  const rawLimit = url.searchParams.get("limit");

  if (!rawLimit) return 50;

  const parsed = Number(rawLimit);

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
    return null;
  }

  return parsed;
}

async function parseSavedWorkCreateInput(request: Request) {
  let body: Record<string, unknown>;

  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { valid: false, response: badRequest("Request body must be a JSON object") } as const;
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return { valid: false, response: badRequest("Request body must be valid JSON") } as const;
  }

  const title = normalizeSavedWorkTitle(body.title);
  if (!title) {
    return { valid: false, response: badRequest("Title is required") } as const;
  }

  if (!isSavedWorkType(body.workType)) {
    return { valid: false, response: badRequest("Work type is invalid") } as const;
  }

  const payload = validateSavedWorkPayload(body.payload);
  if (!payload.valid) {
    return { valid: false, response: badRequest(payload.error) } as const;
  }

  const schemaVersion = normalizeSavedWorkSchemaVersion(body.schemaVersion);
  if (!schemaVersion) {
    return { valid: false, response: badRequest("Schema version is invalid") } as const;
  }

  return {
    valid: true,
    input: {
      title,
      workType: body.workType,
      payload: payload.payload,
      schemaVersion,
    },
  } as const;
}

async function parseSavedWorkPatchInput(request: Request) {
  let body: Record<string, unknown>;

  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { valid: false, response: badRequest("Request body must be a JSON object") } as const;
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return { valid: false, response: badRequest("Request body must be valid JSON") } as const;
  }

  const updates: {
    title?: string;
    payload?: Record<string, unknown>;
    schema_version?: number;
  } = {};

  if (Object.hasOwn(body, "title")) {
    const title = normalizeSavedWorkTitle(body.title);
    if (!title) {
      return { valid: false, response: badRequest("Title is invalid") } as const;
    }
    updates.title = title;
  }

  if (Object.hasOwn(body, "payload")) {
    const payload = validateSavedWorkPayload(body.payload);
    if (!payload.valid) {
      return { valid: false, response: badRequest(payload.error) } as const;
    }
    updates.payload = payload.payload;
  }

  if (Object.hasOwn(body, "schemaVersion")) {
    const schemaVersion = normalizeSavedWorkSchemaVersion(body.schemaVersion);
    if (!schemaVersion) {
      return { valid: false, response: badRequest("Schema version is invalid") } as const;
    }
    updates.schema_version = schemaVersion;
  }

  if (hasProtectedSavedWorkField(body)) {
    return { valid: false, response: badRequest("Protected fields cannot be changed") } as const;
  }

  if (Object.keys(updates).length === 0) {
    return { valid: false, response: badRequest("No supported fields provided") } as const;
  }

  return { valid: true, updates } as const;
}

export async function listSavedWork(request: Request) {
  const authorization = await requireSavedWorkAccess();

  if (!authorization.authorized) {
    return authorization.response;
  }

  const limit = parseLimit(request);

  if (!limit) {
    return badRequest("Limit must be between 1 and 100");
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("saved_work")
      .select("id, title, work_type, schema_version, created_at, updated_at")
      .eq("owner_user_id", authorization.context.ownerUserId)
      .eq("is_deleted", false)
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      savedWork: ((data ?? []) as SavedWorkMetadataRow[]).map(toSavedWorkMetadata),
    });
  } catch (error) {
    console.error("GET /api/saved-work error:", error);

    return serverError("Unable to load Saved Work");
  }
}

export async function createSavedWork(request: Request) {
  const authorization = await requireSavedWorkAccess();

  if (!authorization.authorized) {
    return authorization.response;
  }

  const parsed = await parseSavedWorkCreateInput(request);

  if (!parsed.valid) {
    return parsed.response;
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("saved_work")
      .insert({
        owner_user_id: authorization.context.ownerUserId,
        title: parsed.input.title,
        work_type: parsed.input.workType,
        payload: parsed.input.payload,
        schema_version: parsed.input.schemaVersion,
      })
      .select(savedWorkSelectFields)
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ savedWork: toSavedWorkDetail(data as SavedWorkRow) }, { status: 201 });
  } catch (error) {
    console.error("POST /api/saved-work error:", error);

    return serverError("Unable to create Saved Work");
  }
}

export async function getSavedWork(savedWorkId: string) {
  const authorization = await requireSavedWorkAccess();

  if (!authorization.authorized) {
    return authorization.response;
  }

  if (!uuidPattern.test(savedWorkId)) {
    return notFound();
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("saved_work")
      .select(savedWorkSelectFields)
      .eq("id", savedWorkId)
      .eq("owner_user_id", authorization.context.ownerUserId)
      .eq("is_deleted", false)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return notFound();
    }

    return NextResponse.json({ savedWork: toSavedWorkDetail(data as SavedWorkRow) });
  } catch (error) {
    console.error("GET /api/saved-work/[id] error:", error);

    return serverError("Unable to load Saved Work");
  }
}

export async function updateSavedWork(request: Request, savedWorkId: string) {
  const authorization = await requireSavedWorkAccess();

  if (!authorization.authorized) {
    return authorization.response;
  }

  if (!uuidPattern.test(savedWorkId)) {
    return notFound();
  }

  const parsed = await parseSavedWorkPatchInput(request);

  if (!parsed.valid) {
    return parsed.response;
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("saved_work")
      .update(parsed.updates)
      .eq("id", savedWorkId)
      .eq("owner_user_id", authorization.context.ownerUserId)
      .eq("is_deleted", false)
      .select(savedWorkSelectFields)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return notFound();
    }

    return NextResponse.json({ savedWork: toSavedWorkDetail(data as SavedWorkRow) });
  } catch (error) {
    console.error("PATCH /api/saved-work/[id] error:", error);

    return serverError("Unable to update Saved Work");
  }
}

export async function deleteSavedWork(savedWorkId: string) {
  const authorization = await requireSavedWorkAccess();

  if (!authorization.authorized) {
    return authorization.response;
  }

  if (!uuidPattern.test(savedWorkId)) {
    return notFound();
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("saved_work")
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
      })
      .eq("id", savedWorkId)
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
    console.error("DELETE /api/saved-work/[id] error:", error);

    return serverError("Unable to delete Saved Work");
  }
}
