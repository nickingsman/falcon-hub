import { NextResponse } from "next/server";
import {
  isEmploymentType,
  isMemberPosition,
  isMemberStatus,
} from "@/lib/member-options";
import {
  getLeaderAssignmentError,
  type HierarchyMember,
} from "@/lib/member-hierarchy";
import {
  parseDownlineReassignments,
  toResignationRpcAssignments,
} from "@/lib/member-resignation";
import { requireMembersApiWriteAccess } from "@/lib/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import { createSupabaseSsrClient } from "@/lib/supabase-ssr";

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
  downlineReassignments?: unknown;
};

type CurrentMember = {
  full_name: string | null;
  display_name: string | null;
  email: string | null;
  phone: string | null;
  birthday: string | null;
  employment_type: string | null;
  position: string | null;
  leader_id: string | null;
  join_date: string | null;
  status: string | null;
};

function hasNonStatusChanges(current: CurrentMember, next: Awaited<ReturnType<typeof buildMemberPayload>>) {
  return (
    current.full_name !== next.full_name ||
    current.display_name !== next.display_name ||
    current.email !== next.email ||
    current.phone !== next.phone ||
    current.birthday !== next.birthday ||
    current.employment_type !== next.employment_type ||
    current.position !== next.position ||
    current.leader_id !== next.leader_id ||
    current.join_date !== next.join_date
  );
}

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

async function validateLeaderAssignment(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  memberId: string,
  leaderId: string | null,
) {
  if (!leaderId) return;

  const { data, error } = await supabase
    .from("users")
    .select("id, leader_id, status")
    .eq("is_deleted", false);

  if (error) {
    throw new Error(error.message);
  }

  const validationError = getLeaderAssignmentError(
    (data ?? []) as HierarchyMember[],
    memberId,
    leaderId,
  );

  if (validationError) {
    throw new Error(validationError);
  }
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
    const requestPayload = (await request.json()) as MemberPayload;
    const payload = await buildMemberPayload(supabase, requestPayload);

    const { data: currentMember, error: currentMemberError } = await supabase
      .from("users")
      .select(memberSelectFields)
      .eq("id", id)
      .eq("is_deleted", false)
      .maybeSingle();

    if (currentMemberError) throw currentMemberError;
    if (!currentMember) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    if (currentMember.status === "Resigned" && payload.status !== "Resigned") {
      return NextResponse.json(
        { error: "A Resigned member cannot be reactivated through Team Members." },
        { status: 409 },
      );
    }

    if (currentMember.status !== "Resigned" && payload.status === "Resigned") {
      if (currentMember.status !== "Active") {
        return NextResponse.json(
          { error: "Only an Active member can be resigned." },
          { status: 409 },
        );
      }
      if (hasNonStatusChanges(currentMember as CurrentMember, payload)) {
        return NextResponse.json(
          { error: "Save other member changes before resigning this member." },
          { status: 409 },
        );
      }

      const assignments = parseDownlineReassignments(
        requestPayload.downlineReassignments ?? [],
      );
      const authenticatedSupabase = await createSupabaseSsrClient();
      const { error: resignationError } = await authenticatedSupabase.rpc(
        "resign_falconhub_member",
        {
          p_member_id: id,
          p_downline_reassignments: toResignationRpcAssignments(assignments),
        },
      );
      if (resignationError) throw resignationError;

      const { data: resignedMember, error: resignedMemberError } = await supabase
        .from("users")
        .select(memberSelectFields)
        .eq("id", id)
        .eq("is_deleted", false)
        .maybeSingle();
      if (resignedMemberError) throw resignedMemberError;
      return NextResponse.json({ data: resignedMember }, { status: 200 });
    }

    await validateLeaderAssignment(supabase, id, payload.leader_id);

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
    const errorRecord = error && typeof error === "object"
      ? error as { code?: unknown; message?: unknown }
      : null;
    const message = error instanceof Error
      ? error.message
      : typeof errorRecord?.message === "string"
        ? errorRecord.message
        : "Unable to update member";
    const code = typeof errorRecord?.code === "string" ? errorRecord.code : "";
    const status = code === "P0002"
      ? 404
      : code === "42501"
        ? 403
        : code === "23514"
          ? 409
          : error instanceof Error
            ? 400
            : 500;

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
