import { NextResponse } from "next/server";
import { getAuthenticatedUserProfile } from "@/lib/auth";
import { getMalaysiaTodayDateString } from "@/lib/malaysia-date";
import {
  matchNearestFalconLocation,
  validateLocationInput,
  type FalconLocationCandidate,
  type LocationInput,
} from "@/lib/location-matching";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

type AttendanceAuthContext = {
  authUserId: string;
  memberId: string;
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
