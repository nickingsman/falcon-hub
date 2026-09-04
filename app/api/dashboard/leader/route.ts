import { NextResponse } from "next/server";
import { getAuthenticatedUserProfile, type UserProfile } from "@/lib/auth";
import {
  getMalaysiaThisWeekRange,
  getMalaysiaTodayDateString,
} from "@/lib/malaysia-date";
import { getScopedHierarchyMembers, type HierarchyMember } from "@/lib/member-hierarchy";
import { canManageMembers } from "@/lib/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

type LeaderDashboardMemberRow = HierarchyMember & {
  full_name: string | null;
  position: string | null;
};

type DsiDashboardRow = {
  member_id: string;
  new_leads_contact: number;
  appointment_made: number;
  turn_up_appt: number;
  unit_closed: number;
};

type AttendanceDashboardRow = {
  member_id: string;
  checked_out_at: string | null;
  current_location_name: string;
  current_location_source: "falcon_location" | "reverse_geocoded" | "coordinates";
};

function unauthorized() {
  return NextResponse.json({ error: "Authentication required" }, { status: 401 });
}

function forbidden(message = "Leader dashboard is not available for this role") {
  return NextResponse.json({ error: message }, { status: 403 });
}

function serverError() {
  return NextResponse.json({ error: "Unable to load leader dashboard" }, { status: 500 });
}

function getMemberDisplay(member: LeaderDashboardMemberRow) {
  return {
    memberName: member.full_name || "Unnamed member",
    position: member.position,
  };
}

function toSafePresenceLocation(row: AttendanceDashboardRow) {
  if (row.current_location_source === "falcon_location") {
    return row.current_location_name || "Falcon Location";
  }

  return "Other Locations";
}

function groupPresence(rows: AttendanceDashboardRow[]) {
  const groups = new Map<string, number>();

  for (const row of rows) {
    const locationName = toSafePresenceLocation(row);
    groups.set(locationName, (groups.get(locationName) ?? 0) + 1);
  }

  return Array.from(groups.entries())
    .map(([locationName, count]) => ({ locationName, count }))
    .sort((a, b) => b.count - a.count || a.locationName.localeCompare(b.locationName));
}

function sumDsiRows(rows: DsiDashboardRow[]) {
  return rows.reduce(
    (total, row) => ({
      newLeadsContact: total.newLeadsContact + row.new_leads_contact,
      appointmentMade: total.appointmentMade + row.appointment_made,
      turnUpAppt: total.turnUpAppt + row.turn_up_appt,
      unitClosed: total.unitClosed + row.unit_closed,
    }),
    {
      newLeadsContact: 0,
      appointmentMade: 0,
      turnUpAppt: 0,
      unitClosed: 0,
    },
  );
}

function getVisibleMembers(profile: UserProfile, members: LeaderDashboardMemberRow[]) {
  if (canManageMembers(profile)) {
    return members;
  }

  return getScopedHierarchyMembers(members, profile.member_id as string);
}

export async function GET() {
  const authContext = await getAuthenticatedUserProfile();

  if (!authContext) {
    return unauthorized();
  }

  if (!authContext.profile || authContext.profile.status !== "active") {
    return forbidden("Active user profile is required");
  }

  if (authContext.profile.role === "agent") {
    return forbidden();
  }

  if (!authContext.profile.member_id) {
    return forbidden("Linked member profile is required");
  }

  try {
    const supabase = createSupabaseAdminClient();
    const today = getMalaysiaTodayDateString();
    const thisWeek = getMalaysiaThisWeekRange();
    const { data: memberRows, error: memberError } = await supabase
      .from("users")
      .select("id, full_name, position, leader_id, status")
      .eq("is_deleted", false)
      .eq("status", "Active")
      .order("full_name", { ascending: true });

    if (memberError) {
      throw memberError;
    }

    const activeMembers = (memberRows ?? []) as LeaderDashboardMemberRow[];
    const currentMember = activeMembers.find(
      (member) => member.id === authContext.profile?.member_id,
    );

    if (!currentMember) {
      return forbidden("Active linked member is required");
    }

    const visibleMembers = getVisibleMembers(authContext.profile, activeMembers);
    const visibleMemberIds = visibleMembers.map((member) => member.id);

    const [
      { data: todayDsiRows, error: todayDsiError },
      { data: weekDsiRows, error: weekDsiError },
      { data: todayAttendanceRows, error: todayAttendanceError },
    ] = visibleMemberIds.length
      ? await Promise.all([
          supabase
            .from("daily_sales_index_entries")
            .select("member_id, new_leads_contact, appointment_made, turn_up_appt, unit_closed")
            .in("member_id", visibleMemberIds)
            .eq("activity_date", today),
          supabase
            .from("daily_sales_index_entries")
            .select("member_id, new_leads_contact, appointment_made, turn_up_appt, unit_closed")
            .in("member_id", visibleMemberIds)
            .gte("activity_date", thisWeek.from)
            .lte("activity_date", thisWeek.to),
          supabase
            .from("attendance_sessions")
            .select("member_id, checked_out_at, current_location_name, current_location_source")
            .in("member_id", visibleMemberIds)
            .eq("attendance_date", today),
        ])
      : [
          { data: [], error: null },
          { data: [], error: null },
          { data: [], error: null },
        ];

    if (todayDsiError) {
      throw todayDsiError;
    }

    if (weekDsiError) {
      throw weekDsiError;
    }

    if (todayAttendanceError) {
      throw todayAttendanceError;
    }

    const todayDsi = (todayDsiRows ?? []) as DsiDashboardRow[];
    const weekDsi = (weekDsiRows ?? []) as DsiDashboardRow[];
    const todayAttendance = (todayAttendanceRows ?? []) as AttendanceDashboardRow[];
    const todayDsiMemberIds = new Set(todayDsi.map((row) => row.member_id));
    const todayAttendanceMemberIds = new Set(todayAttendance.map((row) => row.member_id));
    const currentPresence = todayAttendance.filter((row) => !row.checked_out_at);
    const todayActivity = sumDsiRows(todayDsi);
    const weekActivity = sumDsiRows(weekDsi);
    const appointmentWithoutTurnUpMemberIds = new Set(
      todayDsi
        .filter((row) => row.appointment_made > 0 && row.turn_up_appt === 0)
        .map((row) => row.member_id),
    );

    return NextResponse.json({
      date: today,
      timezone: "Asia/Kuala_Lumpur",
      user: getMemberDisplay(currentMember),
      teamToday: {
        teamMembers: visibleMembers.length,
        dsiSubmitted: todayDsiMemberIds.size,
        checkedInToday: todayAttendanceMemberIds.size,
        currentlyCheckedIn: currentPresence.length,
      },
      todayActivity,
      needsAttention: {
        dsiNotSubmitted: visibleMembers
          .filter((member) => !todayDsiMemberIds.has(member.id))
          .map(getMemberDisplay),
        noCheckInRecord: visibleMembers
          .filter((member) => !todayAttendanceMemberIds.has(member.id))
          .map(getMemberDisplay),
        appointmentWithoutTurnUp: {
          memberCount: appointmentWithoutTurnUpMemberIds.size,
        },
      },
      teamPresence: {
        totalCheckedIn: currentPresence.length,
        groups: groupPresence(currentPresence),
      },
      teamWeek: {
        recordedDsiDays: weekDsi.length,
        appointmentMade: weekActivity.appointmentMade,
        turnUpAppt: weekActivity.turnUpAppt,
        unitClosed: weekActivity.unitClosed,
      },
    });
  } catch (error) {
    console.error("GET /api/dashboard/leader error:", error);

    return serverError();
  }
}
