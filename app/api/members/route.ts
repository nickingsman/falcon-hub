import { NextResponse } from "next/server";
import {
  isEmploymentType,
  isMemberPosition,
  isMemberStatus,
} from "@/lib/member-options";
import {
  getActiveMemberCount,
  getScopedHierarchyMembers,
} from "@/lib/member-hierarchy";
import {
  canManageMembers,
  requireMembersApiReadAccess,
  requireMembersApiWriteAccess,
} from "@/lib/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

const memberSelectFields = `
  id,
  member_code,
  full_name,
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
  email?: unknown;
  phone?: unknown;
  birthday?: unknown;
  employment_type?: unknown;
  position?: unknown;
  leader_id?: unknown;
  join_date?: unknown;
  status?: unknown;
};

type MemberDirectoryRow = {
  id: string;
  member_code: number | null;
  full_name: string | null;
  chinese_name: string | null;
  email: string | null;
  phone: string | null;
  birthday: string | null;
  join_date: string | null;
  position: string | null;
  employment_type: string | null;
  status: string | null;
  leader_id: string | null;
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

export async function GET() {
  const authorization = await requireMembersApiReadAccess();

  if (!authorization.authorized) {
    return authorization.response;
  }

  try {
    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from("users")
      .select(memberSelectFields)
      .eq("is_deleted", false)
      .order("join_date", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    const members = (data ?? []) as MemberDirectoryRow[];
    const falconHubActiveMembers = getActiveMemberCount(members);

    if (canManageMembers(authorization.profile)) {
      return NextResponse.json(
        {
          members,
          summary: {
            falconHubActiveMembers,
            myActiveTeam: falconHubActiveMembers,
          },
        },
        { status: 200 }
      );
    }

    if (!authorization.profile.member_id) {
      return NextResponse.json(
        { error: "Linked member profile is required" },
        { status: 403 }
      );
    }

    const scopedMembers = getScopedHierarchyMembers(
      members,
      authorization.profile.member_id,
    );

    return NextResponse.json(
      {
        members: scopedMembers,
        summary: {
          falconHubActiveMembers,
          myActiveTeam: getActiveMemberCount(scopedMembers),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("GET /api/members error:", error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to load members",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const authorization = await requireMembersApiWriteAccess();

  if (!authorization.authorized) {
    return authorization.response;
  }

  try {
    const supabase = createSupabaseAdminClient();
    const payload = await buildMemberPayload(supabase, await request.json());

    const { data, error } = await supabase
      .from("users")
      .insert([payload])
      .select(memberSelectFields);

    if (error) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create member";
    const status = error instanceof Error ? 400 : 500;

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status }
    );
  }
}
