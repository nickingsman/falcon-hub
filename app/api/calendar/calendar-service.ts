import { NextResponse } from "next/server";
import { getAuthenticatedUserProfile, type UserProfile } from "@/lib/auth";
import {
  addCalendarDays,
  getInclusiveDayCount,
  getMalaysiaTodayDateString,
  isValidDateString,
} from "@/lib/malaysia-date";
import { getScopedHierarchyMembers, type HierarchyMember } from "@/lib/member-hierarchy";
import { canManageMembers } from "@/lib/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

const calendarCategories = [
  "company_meeting",
  "team_meeting",
  "training",
  "roleplay",
  "recognition_event",
  "project_activity",
  "other",
] as const;

const calendarAudienceTypes = ["company", "team"] as const;

type CalendarCategory = (typeof calendarCategories)[number];
type CalendarAudienceType = (typeof calendarAudienceTypes)[number];

type CalendarMemberRow = HierarchyMember & {
  full_name: string | null;
  position: string | null;
};

type CalendarEventRow = {
  id: string;
  title: string;
  category: CalendarCategory;
  event_date: string;
  is_all_day: boolean;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  description: string | null;
  audience_type: CalendarAudienceType;
  target_team_member_id: string | null;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
};

type CalendarAuthContext = {
  authUserId: string;
  profile: UserProfile;
  member: CalendarMemberRow;
};

type CalendarEventInput = {
  title: string;
  category: CalendarCategory;
  eventDate: string;
  isAllDay: boolean;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  description: string | null;
  audienceType: CalendarAudienceType;
  targetTeamMemberId: string | null;
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

const calendarSelectFields = `
  id,
  title,
  category,
  event_date,
  is_all_day,
  start_time,
  end_time,
  location,
  description,
  audience_type,
  target_team_member_id,
  is_deleted,
  created_at,
  updated_at,
  created_by,
  updated_by
`;

function unauthorized() {
  return NextResponse.json({ error: "Authentication required" }, { status: 401 });
}

function forbidden(message = "You do not have permission to manage calendar events") {
  return NextResponse.json({ error: message }, { status: 403 });
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function notFound() {
  return NextResponse.json({ error: "Calendar event not found" }, { status: 404 });
}

function serverError(message = "Unable to process calendar event request") {
  return NextResponse.json({ error: message }, { status: 500 });
}

function normalizeText(value: unknown, maxLength: number) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return undefined;

  const trimmed = value.trim();
  if (!trimmed) return null;

  return trimmed.length <= maxLength ? trimmed : undefined;
}

function normalizeRequiredText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return undefined;

  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) return undefined;

  return trimmed;
}

function normalizeBoolean(value: unknown, fallback: boolean) {
  if (value === undefined) return fallback;
  return typeof value === "boolean" ? value : undefined;
}

function normalizeTime(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return undefined;

  const trimmed = value.trim();
  return timePattern.test(trimmed) ? trimmed : undefined;
}

function isCalendarCategory(value: unknown): value is CalendarCategory {
  return typeof value === "string" && calendarCategories.includes(value as CalendarCategory);
}

function isCalendarAudienceType(value: unknown): value is CalendarAudienceType {
  return typeof value === "string" && calendarAudienceTypes.includes(value as CalendarAudienceType);
}

async function requireCalendarAccess(): Promise<
  | { authorized: true; context: CalendarAuthContext }
  | { authorized: false; response: NextResponse }
> {
  const authContext = await getAuthenticatedUserProfile();

  if (!authContext) {
    return { authorized: false, response: unauthorized() };
  }

  if (!authContext.profile || authContext.profile.status !== "active") {
    return { authorized: false, response: forbidden("Active user profile is required") };
  }

  if (!authContext.profile.member_id) {
    return { authorized: false, response: forbidden("Linked member profile is required") };
  }

  const supabase = createSupabaseAdminClient();
  const { data: member, error: memberError } = await supabase
    .from("users")
    .select("id, full_name, position, leader_id, status")
    .eq("id", authContext.profile.member_id)
    .eq("is_deleted", false)
    .eq("status", "Active")
    .maybeSingle();

  if (memberError) {
    return { authorized: false, response: serverError("Unable to verify calendar access") };
  }

  if (!member) {
    return { authorized: false, response: forbidden("Active linked member is required") };
  }

  return {
    authorized: true,
    context: {
      authUserId: authContext.user.id,
      profile: authContext.profile,
      member: member as CalendarMemberRow,
    },
  };
}

async function getActiveCalendarMembers(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
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

  return (data ?? []) as CalendarMemberRow[];
}

function getMemberIdsInScope(members: CalendarMemberRow[], rootMemberId: string) {
  return new Set(getScopedHierarchyMembers(members, rootMemberId).map((member) => member.id));
}

function getManageableTeamRootIds(context: CalendarAuthContext, members: CalendarMemberRow[]) {
  if (canManageMembers(context.profile)) {
    return new Set(members.map((member) => member.id));
  }

  return getMemberIdsInScope(members, context.member.id);
}

function getReadableTeamRootIds(context: CalendarAuthContext, members: CalendarMemberRow[]) {
  if (canManageMembers(context.profile)) {
    return new Set(members.map((member) => member.id));
  }

  const ownTeamRootIds = getMemberIdsInScope(members, context.member.id);
  const containingTeamRootIds = members
    .filter((member) => getMemberIdsInScope(members, member.id).has(context.member.id))
    .map((member) => member.id);

  for (const memberId of containingTeamRootIds) {
    ownTeamRootIds.add(memberId);
  }

  return ownTeamRootIds;
}

function canManageCalendarEvent(
  context: CalendarAuthContext,
  event: Pick<CalendarEventRow, "audience_type" | "created_by">,
) {
  if (canManageMembers(context.profile)) {
    return true;
  }

  if (context.profile.role !== "leader") {
    return false;
  }

  if (event.audience_type !== "team") {
    return false;
  }

  return event.created_by === context.authUserId;
}

function canReadCalendarEvent(
  context: CalendarAuthContext,
  event: Pick<CalendarEventRow, "audience_type" | "target_team_member_id">,
  members: CalendarMemberRow[],
) {
  if (canManageMembers(context.profile)) {
    return true;
  }

  if (event.audience_type === "company") {
    return true;
  }

  return Boolean(
    event.target_team_member_id &&
      getReadableTeamRootIds(context, members).has(event.target_team_member_id),
  );
}

function validateDateRange(request: Request) {
  const url = new URL(request.url);
  const today = getMalaysiaTodayDateString();
  const from = url.searchParams.get("from") ?? today;
  const to = url.searchParams.get("to") ?? addCalendarDays(from, 60);

  if (!isValidDateString(from) || !isValidDateString(to)) {
    return { valid: false, error: "Dates must use YYYY-MM-DD format" } as const;
  }

  if (from > to) {
    return { valid: false, error: "From date must be before or equal to To date" } as const;
  }

  if (getInclusiveDayCount(from, to) > 180) {
    return { valid: false, error: "Calendar event range cannot exceed 180 days" } as const;
  }

  return { valid: true, from, to } as const;
}

function parseCalendarEventInput(
  body: Record<string, unknown>,
  existing?: CalendarEventRow,
):
  | { valid: true; input: CalendarEventInput }
  | { valid: false; response: NextResponse } {
  const title = Object.hasOwn(body, "title")
    ? normalizeRequiredText(body.title, 120)
    : existing?.title;
  const category = Object.hasOwn(body, "category") ? body.category : existing?.category;
  const eventDate = Object.hasOwn(body, "eventDate")
    ? body.eventDate
    : existing?.event_date;
  const isAllDay = normalizeBoolean(
    Object.hasOwn(body, "isAllDay") ? body.isAllDay : undefined,
    existing?.is_all_day ?? false,
  );
  const startTime = Object.hasOwn(body, "startTime")
    ? normalizeTime(body.startTime)
    : existing?.start_time ?? null;
  const endTime = Object.hasOwn(body, "endTime")
    ? normalizeTime(body.endTime)
    : existing?.end_time ?? null;
  const location = Object.hasOwn(body, "location")
    ? normalizeText(body.location, 160)
    : existing?.location ?? null;
  const description = Object.hasOwn(body, "description")
    ? normalizeText(body.description, 1200)
    : existing?.description ?? null;
  const audienceType = Object.hasOwn(body, "audienceType")
    ? body.audienceType
    : existing?.audience_type;
  const targetTeamMemberId = Object.hasOwn(body, "targetTeamMemberId")
    ? body.targetTeamMemberId
    : existing?.target_team_member_id ?? null;

  if (!title) {
    return { valid: false, response: badRequest("Title is required") };
  }

  if (!isCalendarCategory(category)) {
    return { valid: false, response: badRequest("Category is invalid") };
  }

  if (typeof eventDate !== "string" || !isValidDateString(eventDate)) {
    return { valid: false, response: badRequest("Event date must use YYYY-MM-DD format") };
  }

  if (isAllDay === undefined) {
    return { valid: false, response: badRequest("All-day value is invalid") };
  }

  if (startTime === undefined || endTime === undefined) {
    return { valid: false, response: badRequest("Event time must use HH:MM format") };
  }

  if (!isAllDay && !startTime) {
    return { valid: false, response: badRequest("Timed events require a start time") };
  }

  if (startTime && endTime && endTime < startTime) {
    return { valid: false, response: badRequest("End time cannot be earlier than start time") };
  }

  if (location === undefined || description === undefined) {
    return { valid: false, response: badRequest("Text fields are too long") };
  }

  if (!isCalendarAudienceType(audienceType)) {
    return { valid: false, response: badRequest("Audience type is invalid") };
  }

  if (audienceType === "company") {
    return {
      valid: true,
      input: {
        title,
        category,
        eventDate,
        isAllDay,
        startTime: isAllDay ? null : startTime,
        endTime: isAllDay ? null : endTime,
        location,
        description,
        audienceType,
        targetTeamMemberId: null,
      },
    };
  }

  if (typeof targetTeamMemberId !== "string" || !uuidPattern.test(targetTeamMemberId)) {
    return { valid: false, response: badRequest("Target team member is required") };
  }

  return {
    valid: true,
    input: {
      title,
      category,
      eventDate,
      isAllDay,
      startTime: isAllDay ? null : startTime,
      endTime: isAllDay ? null : endTime,
      location,
      description,
      audienceType,
      targetTeamMemberId,
    },
  };
}

function toCalendarEventResponse(
  row: CalendarEventRow,
  membersById: Map<string, CalendarMemberRow>,
  context: CalendarAuthContext,
) {
  const targetTeamMember = row.target_team_member_id
    ? membersById.get(row.target_team_member_id)
    : null;
  const canManage = canManageCalendarEvent(context, row);

  return {
    id: row.id,
    title: row.title,
    category: row.category,
    eventDate: row.event_date,
    isAllDay: row.is_all_day,
    startTime: row.start_time,
    endTime: row.end_time,
    location: row.location,
    description: row.description,
    audienceType: row.audience_type,
    targetTeam: targetTeamMember
      ? {
          memberId: targetTeamMember.id,
          memberName: targetTeamMember.full_name || "Unnamed member",
          position: targetTeamMember.position,
        }
      : null,
    canManage,
    canEdit: canManage,
    canDelete: canManage,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getCalendarEventById(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  eventId: string,
) {
  if (!uuidPattern.test(eventId)) {
    return { errorResponse: badRequest("Calendar event is invalid") } as const;
  }

  const { data, error } = await supabase
    .from("calendar_events")
    .select(calendarSelectFields)
    .eq("id", eventId)
    .eq("is_deleted", false)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return { errorResponse: notFound() } as const;
  }

  return { event: data as CalendarEventRow } as const;
}

export async function getCalendarEvents(request: Request) {
  const range = validateDateRange(request);

  if (!range.valid) {
    return badRequest(range.error);
  }

  const authorization = await requireCalendarAccess();

  if (!authorization.authorized) {
    return authorization.response;
  }

  try {
    const supabase = createSupabaseAdminClient();
    const members = await getActiveCalendarMembers(supabase);
    const membersById = new Map(members.map((member) => [member.id, member]));
    const { data, error } = await supabase
      .from("calendar_events")
      .select(calendarSelectFields)
      .eq("is_deleted", false)
      .gte("event_date", range.from)
      .lte("event_date", range.to)
      .order("event_date", { ascending: true })
      .order("start_time", { ascending: true, nullsFirst: true })
      .order("created_at", { ascending: true });

    if (error) {
      throw error;
    }

    const events = ((data ?? []) as CalendarEventRow[]).filter((event) =>
      canReadCalendarEvent(authorization.context, event, members),
    );

    return NextResponse.json({
      from: range.from,
      to: range.to,
      timezone: "Asia/Kuala_Lumpur",
      events: events.map((event) =>
        toCalendarEventResponse(event, membersById, authorization.context),
      ),
    });
  } catch (error) {
    console.error("GET calendar events error:", error);

    return serverError("Unable to load calendar events");
  }
}

export async function createCalendarEvent(request: Request) {
  const authorization = await requireCalendarAccess();

  if (!authorization.authorized) {
    return authorization.response;
  }

  if (authorization.context.profile.role === "agent") {
    return forbidden();
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const parsed = parseCalendarEventInput(body);

    if (!parsed.valid) {
      return parsed.response;
    }

    const supabase = createSupabaseAdminClient();
    const members = await getActiveCalendarMembers(supabase);
    const membersById = new Map(members.map((member) => [member.id, member]));

    if (parsed.input.audienceType === "company" && !canManageMembers(authorization.context.profile)) {
      return forbidden("Leader can only create team calendar events");
    }

    if (
      parsed.input.audienceType === "team" &&
      (!parsed.input.targetTeamMemberId ||
        !getManageableTeamRootIds(authorization.context, members).has(parsed.input.targetTeamMemberId))
    ) {
      return forbidden("Target team is outside your calendar scope");
    }

    const { data, error } = await supabase
      .from("calendar_events")
      .insert({
        title: parsed.input.title,
        category: parsed.input.category,
        event_date: parsed.input.eventDate,
        is_all_day: parsed.input.isAllDay,
        start_time: parsed.input.startTime,
        end_time: parsed.input.endTime,
        location: parsed.input.location,
        description: parsed.input.description,
        audience_type: parsed.input.audienceType,
        target_team_member_id: parsed.input.targetTeamMemberId,
        created_by: authorization.context.authUserId,
        updated_by: authorization.context.authUserId,
      })
      .select(calendarSelectFields)
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json(
      { event: toCalendarEventResponse(data as CalendarEventRow, membersById, authorization.context) },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST calendar event error:", error);

    return serverError("Unable to create calendar event");
  }
}

export async function updateCalendarEvent(request: Request, eventId: string) {
  const authorization = await requireCalendarAccess();

  if (!authorization.authorized) {
    return authorization.response;
  }

  if (authorization.context.profile.role === "agent") {
    return forbidden();
  }

  try {
    const supabase = createSupabaseAdminClient();
    const existingResult = await getCalendarEventById(supabase, eventId.trim());

    if ("errorResponse" in existingResult) {
      return existingResult.errorResponse;
    }

    const members = await getActiveCalendarMembers(supabase);

    if (!canManageCalendarEvent(authorization.context, existingResult.event)) {
      return forbidden();
    }

    const body = (await request.json()) as Record<string, unknown>;
    const parsed = parseCalendarEventInput(body, existingResult.event);

    if (!parsed.valid) {
      return parsed.response;
    }

    if (parsed.input.audienceType === "company" && !canManageMembers(authorization.context.profile)) {
      return forbidden("Leader cannot create or manage company-wide calendar events");
    }

    if (
      parsed.input.audienceType === "team" &&
      (!parsed.input.targetTeamMemberId ||
        !getManageableTeamRootIds(authorization.context, members).has(parsed.input.targetTeamMemberId))
    ) {
      return forbidden("Target team is outside your calendar scope");
    }

    const { data, error } = await supabase
      .from("calendar_events")
      .update({
        title: parsed.input.title,
        category: parsed.input.category,
        event_date: parsed.input.eventDate,
        is_all_day: parsed.input.isAllDay,
        start_time: parsed.input.startTime,
        end_time: parsed.input.endTime,
        location: parsed.input.location,
        description: parsed.input.description,
        audience_type: parsed.input.audienceType,
        target_team_member_id: parsed.input.targetTeamMemberId,
        updated_by: authorization.context.authUserId,
      })
      .eq("id", existingResult.event.id)
      .eq("is_deleted", false)
      .select(calendarSelectFields)
      .single();

    if (error) {
      throw error;
    }

    const membersById = new Map(members.map((member) => [member.id, member]));

    return NextResponse.json({
      event: toCalendarEventResponse(data as CalendarEventRow, membersById, authorization.context),
    });
  } catch (error) {
    console.error("PATCH calendar event error:", error);

    return serverError("Unable to update calendar event");
  }
}

export async function deleteCalendarEvent(eventId: string) {
  const authorization = await requireCalendarAccess();

  if (!authorization.authorized) {
    return authorization.response;
  }

  if (authorization.context.profile.role === "agent") {
    return forbidden();
  }

  try {
    const supabase = createSupabaseAdminClient();
    const existingResult = await getCalendarEventById(supabase, eventId.trim());

    if ("errorResponse" in existingResult) {
      return existingResult.errorResponse;
    }

    if (!canManageCalendarEvent(authorization.context, existingResult.event)) {
      return forbidden();
    }

    const { error } = await supabase
      .from("calendar_events")
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
        updated_by: authorization.context.authUserId,
      })
      .eq("id", existingResult.event.id)
      .eq("is_deleted", false);

    if (error) {
      throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE calendar event error:", error);

    return serverError("Unable to delete calendar event");
  }
}
