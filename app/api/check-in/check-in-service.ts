import { NextResponse } from "next/server";
import { getAuthenticatedUserProfile, type UserProfile } from "@/lib/auth";
import {
  getInclusiveDateRange,
  getInclusiveDayCount,
  getMalaysiaTodayDateString,
  isValidDateString,
} from "@/lib/malaysia-date";
import {
  getScopedHierarchyMembers,
  type HierarchyMember,
} from "@/lib/member-hierarchy";
import {
  matchNearestFalconLocation,
  validateLocationInput,
  type FalconLocationCandidate,
  type LocationInput,
} from "@/lib/location-matching";
import { canManageMembers } from "@/lib/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

type AttendanceAuthContext = {
  authUserId: string;
  memberId: string;
};

type AttendanceHistoryAuthContext = {
  authUserId: string;
  profile: UserProfile;
};

type AttendanceSessionRow = {
  id: string;
  member_id: string;
  attendance_date: string;
  checked_in_at: string;
  check_in_latitude: number;
  check_in_longitude: number;
  check_in_accuracy_meters: number;
  check_in_location_name: string;
  check_in_location_source: LocationSource;
  check_in_falcon_location_id: string | null;
  current_latitude: number;
  current_longitude: number;
  current_accuracy_meters: number;
  current_location_name: string;
  current_location_source: LocationSource;
  current_falcon_location_id: string | null;
  location_updated_at: string;
  checked_out_at: string | null;
  check_out_latitude: number | null;
  check_out_longitude: number | null;
  check_out_accuracy_meters: number | null;
  check_out_location_name: string | null;
  check_out_location_source: LocationSource | null;
  check_out_falcon_location_id: string | null;
  created_at: string;
  updated_at: string;
};

type PresenceSessionRow = {
  id: string;
  member_id: string;
  checked_in_at: string;
  current_location_name: string;
  current_location_source: LocationSource;
  current_falcon_location_id: string | null;
  location_updated_at: string;
  users:
    | {
        full_name: string | null;
        position: string | null;
      }
    | {
        full_name: string | null;
        position: string | null;
      }[]
    | null;
};

type AttendanceHistoryMemberRow = HierarchyMember & {
  full_name: string | null;
  position: string | null;
};

type LocationSource = "falcon_location" | "reverse_geocoded" | "coordinates";

const attendanceSelectFields = `
  id,
  member_id,
  attendance_date,
  checked_in_at,
  check_in_latitude,
  check_in_longitude,
  check_in_accuracy_meters,
  check_in_location_name,
  check_in_location_source,
  check_in_falcon_location_id,
  current_latitude,
  current_longitude,
  current_accuracy_meters,
  current_location_name,
  current_location_source,
  current_falcon_location_id,
  location_updated_at,
  checked_out_at,
  check_out_latitude,
  check_out_longitude,
  check_out_accuracy_meters,
  check_out_location_name,
  check_out_location_source,
  check_out_falcon_location_id,
  created_at,
  updated_at
`;

const attendanceHistorySelectFields = `
  id,
  member_id,
  attendance_date,
  checked_in_at,
  checked_out_at,
  check_in_location_name,
  current_location_name,
  check_out_location_name,
  location_updated_at,
  users!inner(
    full_name,
    position
  )
`;

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function unauthorized() {
  return NextResponse.json({ error: "Authentication required" }, { status: 401 });
}

function forbidden(message = "Active linked member profile is required") {
  return NextResponse.json({ error: message }, { status: 403 });
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function conflict(message: string) {
  return NextResponse.json({ error: message }, { status: 409 });
}

function serverError(message = "Unable to process check-in request") {
  return NextResponse.json({ error: message }, { status: 500 });
}

async function requireAttendanceAccess(): Promise<
  | { authorized: true; context: AttendanceAuthContext }
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
    return { authorized: false, response: serverError("Unable to verify member profile") };
  }

  if (!member) {
    return { authorized: false, response: forbidden("Active linked member is required") };
  }

  return {
    authorized: true,
    context: {
      authUserId: authContext.user.id,
      memberId: authContext.profile.member_id,
    },
  };
}

async function requireAttendanceHistoryAccess(): Promise<
  | { authorized: true; context: AttendanceHistoryAuthContext }
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
    return { authorized: false, response: forbidden("Attendance history is not available for this role") };
  }

  if (authContext.profile.role === "leader" && !authContext.profile.member_id) {
    return { authorized: false, response: forbidden("Linked member profile is required") };
  }

  return {
    authorized: true,
    context: {
      authUserId: authContext.user.id,
      profile: authContext.profile,
    },
  };
}

async function parseLocation(request: Request) {
  try {
    return validateLocationInput(await request.json());
  } catch (error) {
    return error instanceof Error ? error.message : "Location is invalid";
  }
}

async function resolveLocation(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  location: LocationInput,
) {
  const { data, error } = await supabase
    .from("falcon_locations")
    .select("id, name, latitude, longitude, match_radius_meters")
    .eq("is_active", true);

  if (error) {
    throw error;
  }

  const candidates = (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    matchRadiusMeters: Number(row.match_radius_meters),
  })) satisfies FalconLocationCandidate[];
  const match = matchNearestFalconLocation(location, candidates);

  if (match) {
    return {
      name: match.name,
      source: match.source,
      falconLocationId: match.id,
      distanceMeters: match.distanceMeters,
    };
  }

  return {
    name: "Location captured",
    source: "coordinates" as const,
    falconLocationId: null,
    distanceMeters: null,
  };
}

function toOwnAttendanceResponse(row: AttendanceSessionRow | null, attendanceDate: string) {
  if (!row) {
    return {
      status: "not_checked_in",
      attendanceDate,
      session: null,
    };
  }

  return {
    status: row.checked_out_at ? "completed" : "checked_in",
    attendanceDate: row.attendance_date,
    session: {
      id: row.id,
      checkedInAt: row.checked_in_at,
      checkedOutAt: row.checked_out_at,
      locationUpdatedAt: row.location_updated_at,
      checkIn: {
        latitude: row.check_in_latitude,
        longitude: row.check_in_longitude,
        accuracyMeters: row.check_in_accuracy_meters,
        locationName: row.check_in_location_name,
        locationSource: row.check_in_location_source,
        falconLocationId: row.check_in_falcon_location_id,
      },
      current: {
        latitude: row.current_latitude,
        longitude: row.current_longitude,
        accuracyMeters: row.current_accuracy_meters,
        locationName: row.current_location_name,
        locationSource: row.current_location_source,
        falconLocationId: row.current_falcon_location_id,
      },
      checkOut: row.checked_out_at
        ? {
            latitude: row.check_out_latitude,
            longitude: row.check_out_longitude,
            accuracyMeters: row.check_out_accuracy_meters,
            locationName: row.check_out_location_name,
            locationSource: row.check_out_location_source,
            falconLocationId: row.check_out_falcon_location_id,
          }
        : null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    },
  };
}

function firstJoinedUser(row: PresenceSessionRow) {
  return Array.isArray(row.users) ? row.users[0] : row.users;
}

function firstJoinedAttendanceMember(
  row: AttendanceSessionRow & {
    users:
      | {
          full_name: string | null;
          position: string | null;
        }
      | {
          full_name: string | null;
          position: string | null;
        }[]
      | null;
  },
) {
  return Array.isArray(row.users) ? row.users[0] : row.users;
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
    return "Future attendance dates cannot be requested";
  }

  if (getInclusiveDayCount(from, to) > 90) {
    return "Attendance history range cannot exceed 90 days";
  }

  return null;
}

function validateOptionalMemberId(memberId: string | null) {
  if (!memberId) return null;

  return uuidPattern.test(memberId) ? null : "Member filter is invalid";
}

async function getAuthorizedAttendanceMembers(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  profile: UserProfile,
) {
  const { data, error } = await supabase
    .from("users")
    .select("id, full_name, position, leader_id, status")
    .eq("is_deleted", false)
    .eq("status", "Active")
    .order("full_name", { ascending: true });

  if (error) {
    throw error;
  }

  const activeMembers = (data ?? []) as AttendanceHistoryMemberRow[];

  if (canManageMembers(profile)) {
    return activeMembers;
  }

  return getScopedHierarchyMembers(activeMembers, profile.member_id as string);
}

function toAuthorizedMemberResponse(member: AttendanceHistoryMemberRow) {
  return {
    memberId: member.id,
    memberName: member.full_name || "Unnamed member",
    position: member.position,
  };
}

function getSessionStatus(row: Pick<AttendanceSessionRow, "checked_out_at">) {
  return row.checked_out_at ? "completed" : "checked_in";
}

function getDurationMinutes(
  checkedInAt: string,
  checkedOutAt: string | null,
) {
  if (!checkedOutAt) return null;

  const durationMs = new Date(checkedOutAt).getTime() - new Date(checkedInAt).getTime();

  if (!Number.isFinite(durationMs) || durationMs < 0) return null;

  return Math.round(durationMs / 60000);
}

function toAttendanceHistorySession(
  row: AttendanceSessionRow & {
    users:
      | {
          full_name: string | null;
          position: string | null;
        }
      | {
          full_name: string | null;
          position: string | null;
        }[]
      | null;
  },
) {
  const member = firstJoinedAttendanceMember(row);

  return {
    sessionId: row.id,
    memberId: row.member_id,
    memberName: member?.full_name || "Unnamed member",
    position: member?.position ?? null,
    attendanceDate: row.attendance_date,
    status: getSessionStatus(row),
    checkedInAt: row.checked_in_at,
    checkedOutAt: row.checked_out_at,
    durationMinutes: getDurationMinutes(row.checked_in_at, row.checked_out_at),
    checkInLocationName: row.check_in_location_name,
    currentLocationName: row.current_location_name,
    checkOutLocationName: row.check_out_location_name,
    locationUpdatedAt: row.location_updated_at,
  };
}

function toLocationAudit(event: {
  locationName: string | null;
  locationSource: LocationSource | null;
  falconLocationId: string | null;
  latitude: number | null;
  longitude: number | null;
  accuracyMeters: number | null;
  timestamp: string | null;
}) {
  if (!event.timestamp) return null;

  return {
    locationName: event.locationName,
    locationSource: event.locationSource,
    falconLocationId: event.falconLocationId,
    latitude: event.latitude,
    longitude: event.longitude,
    accuracyMeters: event.accuracyMeters,
    timestamp: event.timestamp,
  };
}

export async function getOwnTodayAttendance() {
  const authorization = await requireAttendanceAccess();

  if (!authorization.authorized) {
    return authorization.response;
  }

  try {
    const supabase = createSupabaseAdminClient();
    const attendanceDate = getMalaysiaTodayDateString();
    const { data, error } = await supabase
      .from("attendance_sessions")
      .select(attendanceSelectFields)
      .eq("member_id", authorization.context.memberId)
      .eq("attendance_date", attendanceDate)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return NextResponse.json(
      toOwnAttendanceResponse((data as AttendanceSessionRow | null) ?? null, attendanceDate),
    );
  } catch (error) {
    console.error("GET own attendance error:", error);

    return serverError("Unable to load today's check-in");
  }
}

export async function checkIn(request: Request) {
  const authorization = await requireAttendanceAccess();

  if (!authorization.authorized) {
    return authorization.response;
  }

  const location = await parseLocation(request);

  if (typeof location === "string") {
    return badRequest(location);
  }

  try {
    const supabase = createSupabaseAdminClient();
    const attendanceDate = getMalaysiaTodayDateString();
    const resolvedLocation = await resolveLocation(supabase, location);
    const { data, error } = await supabase
      .from("attendance_sessions")
      .insert({
        member_id: authorization.context.memberId,
        attendance_date: attendanceDate,
        check_in_latitude: location.latitude,
        check_in_longitude: location.longitude,
        check_in_accuracy_meters: location.accuracyMeters,
        check_in_location_name: resolvedLocation.name,
        check_in_location_source: resolvedLocation.source,
        check_in_falcon_location_id: resolvedLocation.falconLocationId,
        current_latitude: location.latitude,
        current_longitude: location.longitude,
        current_accuracy_meters: location.accuracyMeters,
        current_location_name: resolvedLocation.name,
        current_location_source: resolvedLocation.source,
        current_falcon_location_id: resolvedLocation.falconLocationId,
        created_by: authorization.context.authUserId,
        updated_by: authorization.context.authUserId,
      })
      .select(attendanceSelectFields)
      .single();

    if (error) {
      if (error.code === "23505") {
        return conflict("You have already checked in today");
      }

      throw error;
    }

    return NextResponse.json(
      toOwnAttendanceResponse(data as AttendanceSessionRow, attendanceDate),
      { status: 201 },
    );
  } catch (error) {
    console.error("POST check-in error:", error);

    return serverError("Unable to check in");
  }
}

export async function updateCurrentLocation(request: Request) {
  const authorization = await requireAttendanceAccess();

  if (!authorization.authorized) {
    return authorization.response;
  }

  const location = await parseLocation(request);

  if (typeof location === "string") {
    return badRequest(location);
  }

  try {
    const supabase = createSupabaseAdminClient();
    const attendanceDate = getMalaysiaTodayDateString();
    const { data: existing, error: existingError } = await supabase
      .from("attendance_sessions")
      .select("id, checked_out_at")
      .eq("member_id", authorization.context.memberId)
      .eq("attendance_date", attendanceDate)
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    if (!existing) {
      return conflict("Check in before updating location");
    }

    if (existing.checked_out_at) {
      return conflict("This check-in session has already been checked out");
    }

    const resolvedLocation = await resolveLocation(supabase, location);
    const { data, error } = await supabase
      .from("attendance_sessions")
      .update({
        current_latitude: location.latitude,
        current_longitude: location.longitude,
        current_accuracy_meters: location.accuracyMeters,
        current_location_name: resolvedLocation.name,
        current_location_source: resolvedLocation.source,
        current_falcon_location_id: resolvedLocation.falconLocationId,
        location_updated_at: new Date().toISOString(),
        updated_by: authorization.context.authUserId,
      })
      .eq("id", existing.id)
      .eq("member_id", authorization.context.memberId)
      .is("checked_out_at", null)
      .select(attendanceSelectFields)
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json(
      toOwnAttendanceResponse(data as AttendanceSessionRow, attendanceDate),
    );
  } catch (error) {
    console.error("POST check-in location error:", error);

    return serverError("Unable to update location");
  }
}

export async function checkOut(request: Request) {
  const authorization = await requireAttendanceAccess();

  if (!authorization.authorized) {
    return authorization.response;
  }

  const location = await parseLocation(request);

  if (typeof location === "string") {
    return badRequest(location);
  }

  try {
    const supabase = createSupabaseAdminClient();
    const attendanceDate = getMalaysiaTodayDateString();
    const { data: existing, error: existingError } = await supabase
      .from("attendance_sessions")
      .select("id, checked_out_at")
      .eq("member_id", authorization.context.memberId)
      .eq("attendance_date", attendanceDate)
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    if (!existing) {
      return conflict("Check in before checking out");
    }

    if (existing.checked_out_at) {
      return conflict("You have already checked out today");
    }

    const resolvedLocation = await resolveLocation(supabase, location);
    const { data, error } = await supabase
      .from("attendance_sessions")
      .update({
        checked_out_at: new Date().toISOString(),
        check_out_latitude: location.latitude,
        check_out_longitude: location.longitude,
        check_out_accuracy_meters: location.accuracyMeters,
        check_out_location_name: resolvedLocation.name,
        check_out_location_source: resolvedLocation.source,
        check_out_falcon_location_id: resolvedLocation.falconLocationId,
        current_latitude: location.latitude,
        current_longitude: location.longitude,
        current_accuracy_meters: location.accuracyMeters,
        current_location_name: resolvedLocation.name,
        current_location_source: resolvedLocation.source,
        current_falcon_location_id: resolvedLocation.falconLocationId,
        location_updated_at: new Date().toISOString(),
        updated_by: authorization.context.authUserId,
      })
      .eq("id", existing.id)
      .eq("member_id", authorization.context.memberId)
      .is("checked_out_at", null)
      .select(attendanceSelectFields)
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json(
      toOwnAttendanceResponse(data as AttendanceSessionRow, attendanceDate),
    );
  } catch (error) {
    console.error("POST check-out error:", error);

    return serverError("Unable to check out");
  }
}

export async function getTeamPresence() {
  const authorization = await requireAttendanceAccess();

  if (!authorization.authorized) {
    return authorization.response;
  }

  try {
    const supabase = createSupabaseAdminClient();
    const attendanceDate = getMalaysiaTodayDateString();
    const { data, error } = await supabase
      .from("attendance_sessions")
      .select(`
        id,
        member_id,
        checked_in_at,
        current_location_name,
        current_location_source,
        current_falcon_location_id,
        location_updated_at,
        users!inner(
          full_name,
          position
        )
      `)
      .eq("attendance_date", attendanceDate)
      .is("checked_out_at", null)
      .eq("users.is_deleted", false)
      .eq("users.status", "Active")
      .order("location_updated_at", { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({
      attendanceDate,
      presence: ((data ?? []) as PresenceSessionRow[]).map((row) => {
        const member = firstJoinedUser(row);

        return {
          sessionId: row.id,
          memberId: row.member_id,
          memberName: member?.full_name || "Unnamed member",
          position: member?.position ?? null,
          locationName: row.current_location_name,
          locationSource: row.current_location_source,
          falconLocationId: row.current_falcon_location_id,
          checkedInAt: row.checked_in_at,
          locationUpdatedAt: row.location_updated_at,
        };
      }),
    });
  } catch (error) {
    console.error("GET team presence error:", error);

    return serverError("Unable to load team presence");
  }
}

export async function getAttendanceHistory(request: Request) {
  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const memberId = url.searchParams.get("memberId");
  const rangeError = validateHistoryRange(from, to);
  const memberFilterError = validateOptionalMemberId(memberId);

  if (rangeError) {
    return badRequest(rangeError);
  }

  if (memberFilterError) {
    return badRequest(memberFilterError);
  }

  const authorization = await requireAttendanceHistoryAccess();

  if (!authorization.authorized) {
    return authorization.response;
  }

  try {
    const supabase = createSupabaseAdminClient();
    const authorizedMembers = await getAuthorizedAttendanceMembers(
      supabase,
      authorization.context.profile,
    );
    const authorizedMemberIds = new Set(authorizedMembers.map((member) => member.id));

    if (memberId && !authorizedMemberIds.has(memberId)) {
      return forbidden("Member is outside your attendance history scope");
    }

    const scopedMembers = memberId
      ? authorizedMembers.filter((member) => member.id === memberId)
      : authorizedMembers;
    const scopedMemberIds = scopedMembers.map((member) => member.id);
    const { data: sessions, error: sessionsError } = scopedMemberIds.length
      ? await supabase
          .from("attendance_sessions")
          .select(attendanceHistorySelectFields)
          .in("member_id", scopedMemberIds)
          .gte("attendance_date", from as string)
          .lte("attendance_date", to as string)
          .order("attendance_date", { ascending: false })
          .order("checked_in_at", { ascending: false })
      : { data: [], error: null };

    if (sessionsError) {
      throw sessionsError;
    }

    return NextResponse.json({
      from,
      to,
      timezone: "Asia/Kuala_Lumpur",
      dates: getInclusiveDateRange(from as string, to as string),
      authorizedMembers: scopedMembers.map(toAuthorizedMemberResponse),
      sessions: (
        (sessions ?? []) as Array<
          AttendanceSessionRow & {
            users:
              | {
                  full_name: string | null;
                  position: string | null;
                }
              | {
                  full_name: string | null;
                  position: string | null;
                }[]
              | null;
          }
        >
      ).map(toAttendanceHistorySession),
    });
  } catch (error) {
    console.error("GET attendance history error:", error);

    return serverError("Unable to load attendance history");
  }
}

export async function getAttendanceSessionAudit(sessionId: string) {
  const normalizedSessionId = sessionId.trim();

  if (!uuidPattern.test(normalizedSessionId)) {
    return badRequest("Attendance session is invalid");
  }

  const authorization = await requireAttendanceHistoryAccess();

  if (!authorization.authorized) {
    return authorization.response;
  }

  try {
    const supabase = createSupabaseAdminClient();
    const authorizedMembers = await getAuthorizedAttendanceMembers(
      supabase,
      authorization.context.profile,
    );
    const authorizedMemberIds = new Set(authorizedMembers.map((member) => member.id));
    const { data, error } = await supabase
      .from("attendance_sessions")
      .select(attendanceSelectFields)
      .eq("id", normalizedSessionId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return NextResponse.json({ error: "Attendance session not found" }, { status: 404 });
    }

    const row = data as AttendanceSessionRow;

    if (!authorizedMemberIds.has(row.member_id)) {
      return forbidden("Attendance session is outside your scope");
    }

    const member = authorizedMembers.find((item) => item.id === row.member_id);

    return NextResponse.json({
      sessionId: row.id,
      memberId: row.member_id,
      memberName: member?.full_name || "Unnamed member",
      position: member?.position ?? null,
      attendanceDate: row.attendance_date,
      status: getSessionStatus(row),
      checkedInAt: row.checked_in_at,
      checkedOutAt: row.checked_out_at,
      durationMinutes: getDurationMinutes(row.checked_in_at, row.checked_out_at),
      locationUpdatedAt: row.location_updated_at,
      locationAudit: {
        checkIn: toLocationAudit({
          locationName: row.check_in_location_name,
          locationSource: row.check_in_location_source,
          falconLocationId: row.check_in_falcon_location_id,
          latitude: row.check_in_latitude,
          longitude: row.check_in_longitude,
          accuracyMeters: row.check_in_accuracy_meters,
          timestamp: row.checked_in_at,
        }),
        current: toLocationAudit({
          locationName: row.current_location_name,
          locationSource: row.current_location_source,
          falconLocationId: row.current_falcon_location_id,
          latitude: row.current_latitude,
          longitude: row.current_longitude,
          accuracyMeters: row.current_accuracy_meters,
          timestamp: row.location_updated_at,
        }),
        checkOut: toLocationAudit({
          locationName: row.check_out_location_name,
          locationSource: row.check_out_location_source,
          falconLocationId: row.check_out_falcon_location_id,
          latitude: row.check_out_latitude,
          longitude: row.check_out_longitude,
          accuracyMeters: row.check_out_accuracy_meters,
          timestamp: row.checked_out_at,
        }),
      },
    });
  } catch (error) {
    console.error("GET attendance session audit error:", error);

    return serverError("Unable to load attendance session audit");
  }
}
