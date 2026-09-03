import { NextResponse } from "next/server";
import {
  dsiActivityFields,
  dsiSelectFields,
  validateDsiActivityCounts,
  type DsiEntryRow,
} from "@/lib/dsi";
import { getAuthenticatedUserProfile } from "@/lib/auth";
import type { UserProfile } from "@/lib/auth";
import {
  getInclusiveDateRange,
  getInclusiveDayCount,
  getMalaysiaTodayDateString,
  getMalaysiaYesterdayDateString,
  isValidDateString,
} from "@/lib/malaysia-date";
import {
  getActiveMemberCount,
  getScopedHierarchyMembers,
  type HierarchyMember,
} from "@/lib/member-hierarchy";
import { canManageMembers } from "@/lib/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

type DsiAuthContext = {
  userId: string;
  memberId: string;
};

type TeamDsiMemberRow = HierarchyMember & {
  member_code: number | null;
  full_name: string | null;
  position: string | null;
};

type TeamDsiAuthContext = {
  userId: string;
  profile: UserProfile;
};

function unauthorized() {
  return NextResponse.json({ error: "Authentication required" }, { status: 401 });
}

function forbidden(message = "Active linked member profile is required") {
  return NextResponse.json({ error: message }, { status: 403 });
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function serverError(message = "Unable to verify DSI access") {
  return NextResponse.json({ error: message }, { status: 500 });
}

async function requireOwnDsiAccess(): Promise<
  | { authorized: true; context: DsiAuthContext }
  | { authorized: false; response: NextResponse }
> {
  const authContext = await getAuthenticatedUserProfile();

  if (!authContext) {
    return { authorized: false, response: unauthorized() };
  }

  if (!authContext.profile || authContext.profile.status !== "active") {
    return { authorized: false, response: forbidden() };
  }

  if (!authContext.profile.member_id) {
    return { authorized: false, response: forbidden("Linked member profile is required") };
  }

  const supabase = createSupabaseAdminClient();
  const { data: member, error: memberError } = await supabase
    .from("users")
    .select("id")
    .eq("id", authContext.profile.member_id)
    .eq("is_deleted", false)
    .eq("status", "Active")
    .maybeSingle();

  if (memberError) {
    return { authorized: false, response: serverError() };
  }

  if (!member) {
    return { authorized: false, response: forbidden("Active linked member is required") };
  }

  return {
    authorized: true,
    context: {
      userId: authContext.user.id,
      memberId: authContext.profile.member_id,
    },
  };
}

async function requireTeamDsiAccess(): Promise<
  | { authorized: true; context: TeamDsiAuthContext }
  | { authorized: false; response: NextResponse }
> {
  const authContext = await getAuthenticatedUserProfile();

  if (!authContext) {
    return { authorized: false, response: unauthorized() };
  }

  if (!authContext.profile || authContext.profile.status !== "active") {
    return { authorized: false, response: forbidden() };
  }

  if (authContext.profile.role === "agent") {
    return { authorized: false, response: forbidden("Team DSI is not available for this role") };
  }

  if (authContext.profile.role === "leader" && !authContext.profile.member_id) {
    return { authorized: false, response: forbidden("Linked member profile is required") };
  }

  return {
    authorized: true,
    context: {
      userId: authContext.user.id,
      profile: authContext.profile,
    },
  };
}

function toSafeDsiEntry(row: DsiEntryRow) {
  return {
    id: row.id,
    activityDate: row.activity_date,
    activities: Object.fromEntries(
      dsiActivityFields.map((field) => [field, row[field]]),
    ),
    submittedAt: row.submitted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function validateWritableDate(activityDate: string) {
  if (!isValidDateString(activityDate)) {
    return "Activity date must use YYYY-MM-DD format";
  }

  const today = getMalaysiaTodayDateString();
  const yesterday = getMalaysiaYesterdayDateString();

  if (activityDate === today || activityDate === yesterday) {
    return null;
  }

  if (activityDate > today) {
    return "Future DSI dates cannot be submitted";
  }

  return "Only today and yesterday can be submitted";
}

function validateHistoryRange(from: string | null, to: string | null) {
  if (!from || !to) {
    return "From and To dates are required";
  }

  if (!isValidDateString(from) || !isValidDateString(to)) {
    return "Dates must use YYYY-MM-DD format";
  }

  if (from > to) {
    return "From date must be before or equal to To date";
  }

  if (to > getMalaysiaTodayDateString()) {
    return "Future DSI dates cannot be requested";
  }

  if (getInclusiveDayCount(from, to) > 90) {
    return "DSI history range cannot exceed 90 days";
  }

  return null;
}

function toSafeTeamDsiEntry(row: DsiEntryRow) {
  return {
    id: row.id,
    memberId: row.member_id,
    activityDate: row.activity_date,
    activities: Object.fromEntries(
      dsiActivityFields.map((field) => [field, row[field]]),
    ),
    submittedAt: row.submitted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getOwnDsiForDate(activityDate: string) {
  if (!isValidDateString(activityDate)) {
    return badRequest("Activity date must use YYYY-MM-DD format");
  }

  const authorization = await requireOwnDsiAccess();

  if (!authorization.authorized) {
    return authorization.response;
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("daily_sales_index_entries")
      .select(dsiSelectFields)
      .eq("member_id", authorization.context.memberId)
      .eq("activity_date", activityDate)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return NextResponse.json({
        status: "not_submitted",
        activityDate,
        entry: null,
      });
    }

    return NextResponse.json({
      status: "submitted",
      activityDate,
      entry: toSafeDsiEntry(data as DsiEntryRow),
    });
  } catch (error) {
    console.error("GET own DSI error:", error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load DSI" },
      { status: 500 },
    );
  }
}

export async function upsertOwnDsiForDate(request: Request, activityDate: string) {
  const dateError = validateWritableDate(activityDate);

  if (dateError) {
    return badRequest(dateError);
  }

  const authorization = await requireOwnDsiAccess();

  if (!authorization.authorized) {
    return authorization.response;
  }

  try {
    const counts = validateDsiActivityCounts(await request.json());
    const supabase = createSupabaseAdminClient();
    const { data: existing, error: existingError } = await supabase
      .from("daily_sales_index_entries")
      .select("id")
      .eq("member_id", authorization.context.memberId)
      .eq("activity_date", activityDate)
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    const payload = {
      ...counts,
      updated_by: authorization.context.userId,
    };

    if (existing) {
      const { data, error } = await supabase
        .from("daily_sales_index_entries")
        .update(payload)
        .eq("id", existing.id)
        .eq("member_id", authorization.context.memberId)
        .select(dsiSelectFields)
        .single();

      if (error) {
        throw error;
      }

      return NextResponse.json({
        status: "submitted",
        activityDate,
        entry: toSafeDsiEntry(data as DsiEntryRow),
      });
    }

    const { data, error } = await supabase
      .from("daily_sales_index_entries")
      .insert({
        member_id: authorization.context.memberId,
        activity_date: activityDate,
        ...counts,
        created_by: authorization.context.userId,
        updated_by: authorization.context.userId,
      })
      .select(dsiSelectFields)
      .single();

    if (error) {
      if (error.code === "23505") {
        const { data: retryData, error: retryError } = await supabase
          .from("daily_sales_index_entries")
          .update(payload)
          .eq("member_id", authorization.context.memberId)
          .eq("activity_date", activityDate)
          .select(dsiSelectFields)
          .single();

        if (retryError) {
          throw retryError;
        }

        return NextResponse.json({
          status: "submitted",
          activityDate,
          entry: toSafeDsiEntry(retryData as DsiEntryRow),
        });
      }

      throw error;
    }

    return NextResponse.json({
      status: "submitted",
      activityDate,
      entry: toSafeDsiEntry(data as DsiEntryRow),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save DSI";
    const status =
      message === "DSI activity counts are required" ||
      message.includes("must be a non-negative integer")
        ? 400
        : 500;

    if (status === 500) {
      console.error("PUT own DSI error:", error);
    }

    return NextResponse.json({ error: message }, { status });
  }
}

export async function getOwnDsiHistory(request: Request) {
  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const rangeError = validateHistoryRange(from, to);

  if (rangeError) {
    return badRequest(rangeError);
  }

  const authorization = await requireOwnDsiAccess();

  if (!authorization.authorized) {
    return authorization.response;
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("daily_sales_index_entries")
      .select(dsiSelectFields)
      .eq("member_id", authorization.context.memberId)
      .gte("activity_date", from as string)
      .lte("activity_date", to as string)
      .order("activity_date", { ascending: true });

    if (error) {
      throw error;
    }

    const rows = (data ?? []) as DsiEntryRow[];

    return NextResponse.json({
      from,
      to,
      dates: getInclusiveDateRange(from as string, to as string),
      entries: rows.map(toSafeDsiEntry),
    });
  } catch (error) {
    console.error("GET own DSI history error:", error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load DSI history" },
      { status: 500 },
    );
  }
}

export async function getTeamDsiHistory(request: Request) {
  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const rangeError = validateHistoryRange(from, to);

  if (rangeError) {
    return badRequest(rangeError);
  }

  const authorization = await requireTeamDsiAccess();

  if (!authorization.authorized) {
    return authorization.response;
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data: memberRows, error: memberError } = await supabase
      .from("users")
      .select("id, member_code, full_name, position, leader_id, status")
      .eq("is_deleted", false)
      .eq("status", "Active")
      .order("full_name", { ascending: true });

    if (memberError) {
      throw memberError;
    }

    const activeMembers = (memberRows ?? []) as TeamDsiMemberRow[];
    const visibleMembers = canManageMembers(authorization.context.profile)
      ? activeMembers
      : getScopedHierarchyMembers(
          activeMembers,
          authorization.context.profile.member_id as string,
        );
    const memberIds = visibleMembers.map((member) => member.id);
    const { data: dsiRows, error: dsiError } = memberIds.length
      ? await supabase
          .from("daily_sales_index_entries")
          .select(dsiSelectFields)
          .in("member_id", memberIds)
          .gte("activity_date", from as string)
          .lte("activity_date", to as string)
          .order("activity_date", { ascending: true })
      : { data: [], error: null };

    if (dsiError) {
      throw dsiError;
    }

    const dates = getInclusiveDateRange(from as string, to as string);

    return NextResponse.json({
      from,
      to,
      dates,
      members: visibleMembers.map((member) => ({
        id: member.id,
        memberCode: member.member_code,
        fullName: member.full_name || "Unnamed member",
        position: member.position,
        leaderId: member.leader_id,
      })),
      summary: {
        teamMembers: visibleMembers.length,
        expectedMemberDays: visibleMembers.length * dates.length,
        activeMembers: getActiveMemberCount(visibleMembers),
      },
      entries: ((dsiRows ?? []) as DsiEntryRow[]).map(toSafeTeamDsiEntry),
    });
  } catch (error) {
    console.error("GET team DSI history error:", error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load Team DSI" },
      { status: 500 },
    );
  }
}
