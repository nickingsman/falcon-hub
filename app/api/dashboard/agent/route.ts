import { NextResponse } from "next/server";
import { getAuthenticatedUserProfile } from "@/lib/auth";
import {
  getMalaysiaThisWeekRange,
  getMalaysiaTodayDateString,
} from "@/lib/malaysia-date";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import { getMemberDisplayName } from "@/lib/member-display";

type MemberRow = {
  id: string;
  full_name: string | null;
  display_name: string | null;
  position: string | null;
};

type AttendanceRow = {
  checked_in_at: string;
  checked_out_at: string | null;
  current_location_name: string;
};

type DsiDashboardRow = {
  submitted_at: string;
  new_leads_contact: number;
  appointment_made: number;
  turn_up_appt: number;
  unit_closed: number;
};

type PresenceRow = {
  current_location_name: string;
  current_location_source: "falcon_location" | "reverse_geocoded" | "coordinates";
};

function unauthorized() {
  return NextResponse.json({ error: "Authentication required" }, { status: 401 });
}

function forbidden(message = "Active linked member profile is required") {
  return NextResponse.json({ error: message }, { status: 403 });
}

function serverError() {
  return NextResponse.json({ error: "Unable to load agent dashboard" }, { status: 500 });
}

function toSafePresenceLocation(row: PresenceRow) {
  if (row.current_location_source === "falcon_location") {
    return row.current_location_name || "Falcon Location";
  }

  return "Other Locations";
}

function groupPresence(rows: PresenceRow[]) {
  const groups = new Map<string, number>();

  for (const row of rows) {
    const locationName = toSafePresenceLocation(row);
    groups.set(locationName, (groups.get(locationName) ?? 0) + 1);
  }

  return Array.from(groups.entries())
    .map(([locationName, count]) => ({ locationName, count }))
    .sort((a, b) => b.count - a.count || a.locationName.localeCompare(b.locationName));
}

export async function GET() {
  const authContext = await getAuthenticatedUserProfile();

  if (!authContext) {
    return unauthorized();
  }

  if (!authContext.profile || authContext.profile.status !== "active") {
    return forbidden();
  }

  if (!authContext.profile.member_id) {
    return forbidden("Linked member profile is required");
  }

  try {
    const supabase = createSupabaseAdminClient();
    const today = getMalaysiaTodayDateString();
    const thisWeek = getMalaysiaThisWeekRange();
    const { data: member, error: memberError } = await supabase
      .from("users")
      .select("id, full_name, display_name, position")
      .eq("id", authContext.profile.member_id)
      .eq("is_deleted", false)
      .eq("status", "Active")
      .maybeSingle();

    if (memberError) {
      throw memberError;
    }

    if (!member) {
      return forbidden("Active linked member is required");
    }

    const [
      { data: attendance, error: attendanceError },
      { data: todayDsi, error: todayDsiError },
      { data: weekDsi, error: weekDsiError },
      { data: presenceRows, error: presenceError },
    ] = await Promise.all([
      supabase
        .from("attendance_sessions")
        .select("checked_in_at, checked_out_at, current_location_name")
        .eq("member_id", authContext.profile.member_id)
        .eq("attendance_date", today)
        .maybeSingle(),
      supabase
        .from("daily_sales_index_entries")
        .select("submitted_at, new_leads_contact, appointment_made, turn_up_appt, unit_closed")
        .eq("member_id", authContext.profile.member_id)
        .eq("activity_date", today)
        .maybeSingle(),
      supabase
        .from("daily_sales_index_entries")
        .select("submitted_at, new_leads_contact, appointment_made, turn_up_appt, unit_closed")
        .eq("member_id", authContext.profile.member_id)
        .gte("activity_date", thisWeek.from)
        .lte("activity_date", thisWeek.to),
      supabase
        .from("attendance_sessions")
        .select(`
          current_location_name,
          current_location_source,
          users!inner(
            id
          )
        `)
        .eq("attendance_date", today)
        .is("checked_out_at", null)
        .eq("users.is_deleted", false)
        .eq("users.status", "Active"),
    ]);

    if (attendanceError) {
      throw attendanceError;
    }

    if (todayDsiError) {
      throw todayDsiError;
    }

    if (weekDsiError) {
      throw weekDsiError;
    }

    if (presenceError) {
      throw presenceError;
    }

    const attendanceRow = (attendance as AttendanceRow | null) ?? null;
    const todayDsiRow = (todayDsi as DsiDashboardRow | null) ?? null;
    const weekRows = (weekDsi ?? []) as DsiDashboardRow[];
    const safePresenceRows = (presenceRows ?? []) as PresenceRow[];

    return NextResponse.json({
      date: today,
      timezone: "Asia/Kuala_Lumpur",
      user: {
        memberName: getMemberDisplayName(member as MemberRow),
        position: (member as MemberRow).position,
      },
      attendance: attendanceRow
        ? {
            status: attendanceRow.checked_out_at ? "completed" : "checked_in",
            checkedInAt: attendanceRow.checked_in_at,
            checkedOutAt: attendanceRow.checked_out_at,
            currentLocationName: attendanceRow.current_location_name,
          }
        : {
            status: "not_checked_in",
            checkedInAt: null,
            checkedOutAt: null,
            currentLocationName: null,
          },
      todayDsi: todayDsiRow
        ? {
            status: "submitted",
            submittedAt: todayDsiRow.submitted_at,
            newLeadsContact: todayDsiRow.new_leads_contact,
            appointmentMade: todayDsiRow.appointment_made,
            turnUpAppt: todayDsiRow.turn_up_appt,
            unitClosed: todayDsiRow.unit_closed,
          }
        : {
            status: "not_submitted",
            submittedAt: null,
            newLeadsContact: 0,
            appointmentMade: 0,
            turnUpAppt: 0,
            unitClosed: 0,
          },
      myWeek: {
        recordedDsiDays: weekRows.length,
        appointmentMade: weekRows.reduce((total, row) => total + row.appointment_made, 0),
        turnUpAppt: weekRows.reduce((total, row) => total + row.turn_up_appt, 0),
        unitClosed: weekRows.reduce((total, row) => total + row.unit_closed, 0),
      },
      teamPresence: {
        totalCheckedIn: safePresenceRows.length,
        groups: groupPresence(safePresenceRows),
      },
    });
  } catch (error) {
    console.error("GET /api/dashboard/agent error:", error);

    return serverError();
  }
}
