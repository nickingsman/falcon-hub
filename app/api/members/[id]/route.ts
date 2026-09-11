import { NextResponse } from "next/server";
import {
  isEmploymentType,
  isMemberPosition,
  isMemberStatus,
} from "@/lib/member-options";
import { requireMembersApiWriteAccess } from "@/lib/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

const memberSelectFields = `
  id,
  member_code,
  full_name,
  display_name,
  chinese_name,
  email,
  phone,
  birthday,
  join_date,
  position,
  employment_type,
  status,
  leader_id
`;

type MemberPayload = {
  full_name?: unknown;
  display_name?: unknown;
  email?: unknown;
  phone?: unknown;
  birthday?: unknown;
  employment_type?: unknown;
  position?: unknown;
  leader_id?: unknown;
  join_date?: unknown;
  status?: unknown;
};

function optionalText(value: unknown) {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();

  return trimmed || null;
}

function requiredText(value: unknown, label: string) {
  const text = optionalText(value);

  if (!text) {
    throw new Error(`${label} is required`);
  }

  return text;
}

function optionalDisplayName(value: unknown) {
  const displayName = optionalText(value);
  if (displayName && displayName.length > 80) {
    throw new Error("Display Name must be 80 characters or fewer");
  }
  return displayName;
}

function optionalDate(value: unknown, label: string) {
  const text = optionalText(value);

  if (!text) return null;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(Date.parse(text))) {
    throw new Error(`${label} must be a valid date`);
  }

  return text;
}

async function validateLeaderId(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  leaderId: string | null,
) {
  if (!leaderId) return null;

  const { data, error } = await supabase
    .from("users")
    .select("id")
    .eq("id", leaderId)
    .eq("is_deleted", false)
    .eq("status", "Active")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Leader must be an active member");
  }

  return leaderId;
}

async function buildMemberPayload(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  payload: MemberPayload,
) {
  const employmentType = requiredText(payload.employment_type, "Employment type");

  if (!isEmploymentType(employmentType)) {
    throw new Error("Employment type is invalid");
  }

  const position = requiredText(payload.position, "Position");

  if (!isMemberPosition(position)) {
    throw new Error("Position is invalid");
  }

  const status = requiredText(payload.status ?? "Active", "Status");

  if (!isMemberStatus(status)) {
    throw new Error("Status is invalid");
  }

  const leaderId = await validateLeaderId(
    supabase,
    optionalText(payload.leader_id),
  );

  return {
    full_name: requiredText(payload.full_name, "Full name"),
    display_name: optionalDisplayName(payload.display_name),
    email: optionalText(payload.email),
    phone: optionalText(payload.phone),
    birthday: optionalDate(payload.birthday, "Birthday"),
    employment_type: employmentType,
    position,
    leader_id: leaderId,
    join_date: optionalDate(payload.join_date, "Join date"),
    status,
  };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authorization = await requireMembersApiWriteAccess();

  if (!authorization.authorized) {
    return authorization.response;
  }

  try {
    const { id } = await params;
    const supabase = createSupabaseAdminClient();
    const payload = await buildMemberPayload(supabase, await request.json());

    const { data, error } = await supabase
      .from("users")
      .update(payload)
      .eq("id", id)
      .eq("is_deleted", false)
      .select(memberSelectFields)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { data },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update member";
    const status = error instanceof Error ? 400 : 500;

    return NextResponse.json(
      { error: message },
      { status }
    );
  }
}
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authorization = await requireMembersApiWriteAccess();

  if (!authorization.authorized) {
    return authorization.response;
  }

  try {
    const { id } = await params;

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("users")
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("is_deleted", false)
      .select("id")
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { message: "Member deleted successfully." },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to delete member",
      },
      { status: 500 }
    );
  }
}
