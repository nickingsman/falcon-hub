import { NextResponse } from "next/server";
import {
  dsiActivityFields,
  dsiSelectFields,
  validateDsiActivityCounts,
  type DsiEntryRow,
} from "@/lib/dsi";
import { getAuthenticatedUserProfile } from "@/lib/auth";
import {
  getMalaysiaTodayDateString,
  getMalaysiaYesterdayDateString,
  isValidDateString,
} from "@/lib/malaysia-date";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

type DsiAuthContext = {
  userId: string;
  memberId: string;
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
