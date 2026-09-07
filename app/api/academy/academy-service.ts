import { NextResponse } from "next/server";
import {
  deriveAcademyProgressSummary,
  isAcademyCourseStatus,
  isAcademyProgressCompleted,
  isAcademyVideoSourceType,
  normalizeHttpsUrl,
  normalizeNonNegativeInteger,
  normalizePositiveInteger,
  type AcademyCourseStatus,
  type AcademyProgressSummary,
  type AcademyProgressStatus,
  type AcademyVideoSourceType,
} from "@/lib/academy";
import { getAuthenticatedUserProfile, type UserProfile } from "@/lib/auth";
import { getScopedHierarchyMembers, type HierarchyMember } from "@/lib/member-hierarchy";
import { hasRole } from "@/lib/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

type SupabaseAdminClient = ReturnType<typeof createSupabaseAdminClient>;

type AcademyAuthContext = {
  authUserId: string;
  profile: UserProfile;
  memberId: string;
};

type AcademyAdminContext = {
  authUserId: string;
  profile: UserProfile;
};

type AcademyCourseRow = {
  id: string;
  title: string;
  description: string | null;
  status: AcademyCourseStatus;
  sort_order: number;
  cover_image_url: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

type AcademyLessonRow = {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  video_source_type: AcademyVideoSourceType;
  external_video_url: string | null;
  duration_seconds: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type AcademyProgressRow = {
  id: string;
  member_id: string;
  lesson_id: string;
  last_position_seconds: number;
  max_watched_seconds: number;
  started_at: string | null;
  last_watched_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

type AcademyTeamMemberRow = HierarchyMember & {
  full_name: string | null;
  position: string | null;
};

type AcademyCourseProgressSummary = {
  status: AcademyProgressStatus | "untracked";
  percentage: number | null;
  trackableLessonCount: number;
  completedLessonCount: number;
};

type AcademyCourseInput = {
  title: string;
  description: string | null;
  status: AcademyCourseStatus;
  sortOrder: number;
  coverImageUrl: string | null;
};

type AcademyLessonInput = {
  title: string;
  description: string | null;
  videoSourceType: AcademyVideoSourceType;
  externalVideoUrl: string | null;
  durationSeconds: number | null;
  sortOrder: number;
};

const courseSelectFields = `
  id,
  title,
  description,
  status,
  sort_order,
  cover_image_url,
  published_at,
  created_at,
  updated_at
`;

const lessonSelectFields = `
  id,
  course_id,
  title,
  description,
  video_source_type,
  external_video_url,
  duration_seconds,
  sort_order,
  created_at,
  updated_at
`;

const progressSelectFields = `
  id,
  member_id,
  lesson_id,
  last_position_seconds,
  max_watched_seconds,
  started_at,
  last_watched_at,
  completed_at,
  created_at,
  updated_at
`;

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const academyProgressAdvanceToleranceSeconds = 45;

function unauthorized() {
  return NextResponse.json({ error: "Authentication required" }, { status: 401 });
}

function forbidden(message = "Active user profile is required") {
  return NextResponse.json({ error: message }, { status: 403 });
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function notFound(message = "Academy content not found") {
  return NextResponse.json({ error: message }, { status: 404 });
}

function serverError(message = "Unable to process Academy request") {
  return NextResponse.json({ error: message }, { status: 500 });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeUuid(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();

  return uuidPattern.test(trimmed) ? trimmed : null;
}

function normalizeRequiredText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();

  if (!trimmed || trimmed.length > maxLength) return null;

  return trimmed;
}

function normalizeOptionalText(value: unknown, maxLength: number) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();

  if (!trimmed) return null;

  return trimmed.length <= maxLength ? trimmed : undefined;
}

async function parseJsonBody(request: Request) {
  try {
    const body = await request.json();

    if (!isRecord(body)) {
      return { valid: false, response: badRequest("Request body must be a JSON object") } as const;
    }

    return { valid: true, body } as const;
  } catch {
    return { valid: false, response: badRequest("Request body must be valid JSON") } as const;
  }
}

function hasUnsupportedFields(body: Record<string, unknown>, allowedFields: string[]) {
  const allowed = new Set(allowedFields);
  return Object.keys(body).some((field) => !allowed.has(field));
}

async function requireAcademyLearnerAccess(): Promise<
  | { authorized: true; supabase: SupabaseAdminClient; context: AcademyAuthContext }
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
    return { authorized: false, response: serverError("Unable to verify Academy access") };
  }

  if (!member) {
    return { authorized: false, response: forbidden("Active linked member is required") };
  }

  return {
    authorized: true,
    supabase,
    context: {
      authUserId: authContext.user.id,
      profile: authContext.profile,
      memberId: authContext.profile.member_id,
    },
  };
}

async function requireAcademyAdminAccess(): Promise<
  | { authorized: true; supabase: SupabaseAdminClient; context: AcademyAdminContext }
  | { authorized: false; response: NextResponse }
> {
  const authContext = await getAuthenticatedUserProfile();

  if (!authContext) {
    return { authorized: false, response: unauthorized() };
  }

  if (!authContext.profile || authContext.profile.status !== "active") {
    return { authorized: false, response: forbidden() };
  }

  if (!hasRole(authContext.profile, ["super_admin", "admin"])) {
    return { authorized: false, response: forbidden("Academy content management is restricted") };
  }

  return {
    authorized: true,
    supabase: createSupabaseAdminClient(),
    context: {
      authUserId: authContext.user.id,
      profile: authContext.profile,
    },
  };
}

async function requireAcademyTeamProgressAccess(): Promise<
  | {
      authorized: true;
      supabase: SupabaseAdminClient;
      context: AcademyAdminContext;
      visibleMembers: AcademyTeamMemberRow[];
    }
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
    return { authorized: false, response: forbidden("Team training progress is not available for this role") };
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("users")
    .select("id, full_name, position, leader_id, status")
    .eq("is_deleted", false)
    .eq("status", "Active")
    .order("full_name", { ascending: true });

  if (error) {
    return { authorized: false, response: serverError("Unable to load Academy team members") };
  }

  const activeMembers = (data ?? []) as AcademyTeamMemberRow[];

  if (hasRole(authContext.profile, ["super_admin", "admin"])) {
    return {
      authorized: true,
      supabase,
      context: {
        authUserId: authContext.user.id,
        profile: authContext.profile,
      },
      visibleMembers: activeMembers,
    };
  }

  if (!authContext.profile.member_id) {
    return { authorized: false, response: forbidden("Linked member profile is required") };
  }

  const currentMember = activeMembers.find((member) => member.id === authContext.profile?.member_id);

  if (!currentMember) {
    return { authorized: false, response: forbidden("Active linked member is required") };
  }

  return {
    authorized: true,
    supabase,
    context: {
      authUserId: authContext.user.id,
      profile: authContext.profile,
    },
    visibleMembers: getScopedHierarchyMembers(activeMembers, currentMember.id).filter(
      (member) => member.id !== currentMember.id,
    ),
  };
}

function toCourseResponse(
  row: AcademyCourseRow,
  progress?: AcademyCourseProgressSummary,
) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    sortOrder: row.sort_order,
    coverImageUrl: row.cover_image_url,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(progress ? { progress } : {}),
  };
}

function toCourseManagementResponse(
  row: AcademyCourseRow,
  lessonCount = 0,
  progress?: AcademyCourseProgressSummary,
) {
  return {
    ...toCourseResponse(row, progress),
    lessonCount,
  };
}

function toProgressResponse(
  row: AcademyProgressRow | null | undefined,
  durationSeconds: number | null | undefined,
): AcademyProgressSummary {
  return deriveAcademyProgressSummary({
    durationSeconds,
    lastPositionSeconds: row?.last_position_seconds ?? 0,
    maxWatchedSeconds: row?.max_watched_seconds ?? 0,
    completedAt: row?.completed_at ?? null,
    startedAt: row?.started_at ?? null,
    lastWatchedAt: row?.last_watched_at ?? null,
  });
}

function deriveCourseProgress(
  lessons: AcademyLessonRow[],
  progressByLessonId: Map<string, AcademyProgressRow>,
): AcademyCourseProgressSummary {
  const trackableLessons = lessons.filter(
    (lesson) => lesson.video_source_type === "youtube" && Boolean(lesson.duration_seconds),
  );

  if (trackableLessons.length === 0) {
    return {
      status: "untracked",
      percentage: null,
      trackableLessonCount: 0,
      completedLessonCount: 0,
    };
  }

  const lessonSummaries = trackableLessons.map((lesson) =>
    toProgressResponse(progressByLessonId.get(lesson.id) ?? null, lesson.duration_seconds),
  );
  const percentage = Math.round(
    lessonSummaries.reduce((total, progress) => total + (progress.learningPercentage ?? 0), 0) /
      trackableLessons.length,
  );
  const completedLessonCount = lessonSummaries.filter((progress) => progress.isCompleted).length;

  return {
    status:
      completedLessonCount === trackableLessons.length
        ? "completed"
        : percentage > 0
          ? "in_progress"
          : "not_started",
    percentage,
    trackableLessonCount: trackableLessons.length,
    completedLessonCount,
  };
}

function getCourseProgressForMember(
  lessons: AcademyLessonRow[],
  progressByLessonId: Map<string, AcademyProgressRow>,
) {
  return deriveCourseProgress(lessons, progressByLessonId);
}

function deriveMemberOverallProgress(
  courses: AcademyCourseRow[],
  lessonsByCourseId: Map<string, AcademyLessonRow[]>,
  progressByLessonId: Map<string, AcademyProgressRow>,
) {
  const courseProgress = courses.map((course) => ({
    course,
    progress: getCourseProgressForMember(
      lessonsByCourseId.get(course.id) ?? [],
      progressByLessonId,
    ),
  }));
  const trackableCourses = courseProgress.filter(
    ({ progress }) => progress.trackableLessonCount > 0,
  );
  const untrackedCourseCount = courseProgress.length - trackableCourses.length;

  if (trackableCourses.length === 0) {
    return {
      status: "untracked" as const,
      percentage: null,
      completedCourses: 0,
      startedCourses: 0,
      trackableCourseCount: 0,
      untrackedCourseCount,
    };
  }

  const percentage = Math.round(
    trackableCourses.reduce((total, { progress }) => total + (progress.percentage ?? 0), 0) /
      trackableCourses.length,
  );
  const completedCourses = trackableCourses.filter(
    ({ progress }) => progress.status === "completed",
  ).length;
  const startedCourses = trackableCourses.filter(
    ({ progress }) => progress.status === "in_progress" || progress.status === "completed",
  ).length;

  return {
    status:
      completedCourses === trackableCourses.length
        ? "completed"
        : percentage > 0
          ? "in_progress"
          : "not_started",
    percentage,
    completedCourses,
    startedCourses,
    trackableCourseCount: trackableCourses.length,
    untrackedCourseCount,
  };
}

function toLessonResponse(
  row: AcademyLessonRow,
  progress?: AcademyProgressRow | null,
) {
  return {
    id: row.id,
    courseId: row.course_id,
    title: row.title,
    description: row.description,
    videoSourceType: row.video_source_type,
    externalVideoUrl: row.external_video_url,
    durationSeconds: row.duration_seconds,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    progress: toProgressResponse(progress ?? null, row.duration_seconds),
  };
}

function toLessonManagementResponse(row: AcademyLessonRow) {
  return {
    id: row.id,
    courseId: row.course_id,
    title: row.title,
    description: row.description,
    videoSourceType: row.video_source_type,
    externalVideoUrl: row.external_video_url,
    durationSeconds: row.duration_seconds,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getPublishedCourse(
  supabase: SupabaseAdminClient,
  courseId: string,
) {
  return supabase
    .from("academy_courses")
    .select(courseSelectFields)
    .eq("id", courseId)
    .eq("is_deleted", false)
    .eq("status", "published")
    .maybeSingle();
}

async function getActiveLessonWithPublishedCourse(
  supabase: SupabaseAdminClient,
  lessonId: string,
) {
  const lessonResult = await supabase
    .from("academy_lessons")
    .select(lessonSelectFields)
    .eq("id", lessonId)
    .eq("is_deleted", false)
    .maybeSingle();

  if (lessonResult.error || !lessonResult.data) return lessonResult;

  const courseResult = await getPublishedCourse(supabase, lessonResult.data.course_id);
  if (courseResult.error) {
    return { data: null, error: courseResult.error };
  }

  if (!courseResult.data) {
    return { data: null, error: null };
  }

  return lessonResult;
}

async function getLessonProgress(
  supabase: SupabaseAdminClient,
  memberId: string,
  lessonIds: string[],
) {
  if (lessonIds.length === 0) {
    return {
      error: null,
      progressByLessonId: new Map<string, AcademyProgressRow>(),
    };
  }

  const { data, error } = await supabase
    .from("academy_lesson_progress")
    .select(progressSelectFields)
    .eq("member_id", memberId)
    .in("lesson_id", lessonIds);

  if (error) {
    return { error, progressByLessonId: new Map<string, AcademyProgressRow>() };
  }

  return {
    error: null,
    progressByLessonId: new Map(
      ((data ?? []) as AcademyProgressRow[]).map((progress) => [progress.lesson_id, progress]),
    ),
  };
}

function parseCourseInput(
  body: Record<string, unknown>,
  existing?: AcademyCourseRow,
) {
  if (
    hasUnsupportedFields(body, [
      "title",
      "description",
      "status",
      "sortOrder",
      "coverImageUrl",
    ])
  ) {
    return { valid: false, response: badRequest("Unsupported fields provided") } as const;
  }

  const title =
    body.title === undefined && existing ? existing.title : normalizeRequiredText(body.title, 160);
  if (!title) {
    return { valid: false, response: badRequest("Course title is required") } as const;
  }

  const description =
    body.description === undefined && existing
      ? existing.description
      : normalizeOptionalText(body.description, 1200);
  if (description === undefined) {
    return { valid: false, response: badRequest("Description must be 1200 characters or fewer") } as const;
  }

  const status =
    body.status === undefined ? existing?.status ?? "draft" : body.status;
  if (!isAcademyCourseStatus(status)) {
    return { valid: false, response: badRequest("Course status is invalid") } as const;
  }

  const sortOrder =
    body.sortOrder === undefined && existing
      ? existing.sort_order
      : normalizeNonNegativeInteger(body.sortOrder ?? 0);
  if (sortOrder === undefined || sortOrder === null) {
    return { valid: false, response: badRequest("Sort order must be a non-negative integer") } as const;
  }

  const coverImageUrl =
    body.coverImageUrl === undefined && existing
      ? existing.cover_image_url
      : normalizeHttpsUrl(body.coverImageUrl);
  if (coverImageUrl === undefined) {
    return { valid: false, response: badRequest("Cover image URL must be a valid HTTPS URL") } as const;
  }

  return {
    valid: true,
    input: {
      title,
      description,
      status,
      sortOrder,
      coverImageUrl,
    },
  } as const;
}

function parseLessonInput(
  body: Record<string, unknown>,
  existing?: AcademyLessonRow,
) {
  if (
    hasUnsupportedFields(body, [
      "title",
      "description",
      "videoSourceType",
      "externalVideoUrl",
      "durationSeconds",
      "sortOrder",
    ])
  ) {
    return { valid: false, response: badRequest("Unsupported fields provided") } as const;
  }

  const title =
    body.title === undefined && existing ? existing.title : normalizeRequiredText(body.title, 160);
  if (!title) {
    return { valid: false, response: badRequest("Lesson title is required") } as const;
  }

  const description =
    body.description === undefined && existing
      ? existing.description
      : normalizeOptionalText(body.description, 1200);
  if (description === undefined) {
    return { valid: false, response: badRequest("Description must be 1200 characters or fewer") } as const;
  }

  const videoSourceType =
    body.videoSourceType === undefined
      ? existing?.video_source_type ?? "external"
      : body.videoSourceType;
  if (!isAcademyVideoSourceType(videoSourceType)) {
    return { valid: false, response: badRequest("Video source type is invalid") } as const;
  }

  const externalVideoUrl =
    body.externalVideoUrl === undefined && existing
      ? existing.external_video_url
      : normalizeHttpsUrl(body.externalVideoUrl);
  if (externalVideoUrl === undefined) {
    return { valid: false, response: badRequest("External video URL must be a valid HTTPS URL") } as const;
  }

  const durationSeconds =
    body.durationSeconds === undefined && existing
      ? existing.duration_seconds
      : normalizePositiveInteger(body.durationSeconds);
  if (durationSeconds === undefined) {
    return { valid: false, response: badRequest("Duration must be a positive integer") } as const;
  }

  const sortOrder =
    body.sortOrder === undefined && existing
      ? existing.sort_order
      : normalizeNonNegativeInteger(body.sortOrder ?? 0);
  if (sortOrder === undefined || sortOrder === null) {
    return { valid: false, response: badRequest("Sort order must be a non-negative integer") } as const;
  }

  return {
    valid: true,
    input: {
      title,
      description,
      videoSourceType,
      externalVideoUrl,
      durationSeconds,
      sortOrder,
    },
  } as const;
}

function courseMutationPayload(input: AcademyCourseInput, authUserId: string, existing?: AcademyCourseRow) {
  const becamePublished = input.status === "published" && existing?.status !== "published";

  return {
    title: input.title,
    description: input.description,
    status: input.status,
    sort_order: input.sortOrder,
    cover_image_url: input.coverImageUrl,
    published_at:
      input.status === "published"
        ? existing?.published_at ?? (becamePublished ? new Date().toISOString() : null)
        : existing?.published_at ?? null,
    updated_by: authUserId,
  };
}

function lessonMutationPayload(input: AcademyLessonInput, authUserId: string) {
  return {
    title: input.title,
    description: input.description,
    video_source_type: input.videoSourceType,
    external_video_url: input.externalVideoUrl,
    duration_seconds: input.durationSeconds,
    sort_order: input.sortOrder,
    updated_by: authUserId,
  };
}

async function getCourseLessonCounts(
  supabase: SupabaseAdminClient,
  courseIds: string[],
) {
  if (courseIds.length === 0) {
    return {
      error: null,
      lessonCountByCourseId: new Map<string, number>(),
    };
  }

  const { data, error } = await supabase
    .from("academy_lessons")
    .select("course_id")
    .in("course_id", courseIds)
    .eq("is_deleted", false);

  if (error) {
    return { error, lessonCountByCourseId: new Map<string, number>() };
  }

  const lessonCountByCourseId = new Map<string, number>();
  for (const lesson of (data ?? []) as Array<{ course_id: string }>) {
    lessonCountByCourseId.set(
      lesson.course_id,
      (lessonCountByCourseId.get(lesson.course_id) ?? 0) + 1,
    );
  }

  return { error: null, lessonCountByCourseId };
}

async function getCourseLessons(
  supabase: SupabaseAdminClient,
  courseIds: string[],
) {
  if (courseIds.length === 0) {
    return {
      error: null,
      lessonsByCourseId: new Map<string, AcademyLessonRow[]>(),
      lessons: [] as AcademyLessonRow[],
    };
  }

  const { data, error } = await supabase
    .from("academy_lessons")
    .select(lessonSelectFields)
    .in("course_id", courseIds)
    .eq("is_deleted", false)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    return {
      error,
      lessonsByCourseId: new Map<string, AcademyLessonRow[]>(),
      lessons: [] as AcademyLessonRow[],
    };
  }

  const lessons = (data ?? []) as AcademyLessonRow[];
  const lessonsByCourseId = new Map<string, AcademyLessonRow[]>();

  for (const lesson of lessons) {
    lessonsByCourseId.set(lesson.course_id, [
      ...(lessonsByCourseId.get(lesson.course_id) ?? []),
      lesson,
    ]);
  }

  return { error: null, lessonsByCourseId, lessons };
}

async function validateCourseCanPublish(
  supabase: SupabaseAdminClient,
  courseId: string,
) {
  const { count, error } = await supabase
    .from("academy_lessons")
    .select("id", { count: "exact", head: true })
    .eq("course_id", courseId)
    .eq("is_deleted", false);

  if (error) {
    return { valid: false, response: serverError("Unable to verify course lessons") } as const;
  }

  if ((count ?? 0) < 1) {
    return {
      valid: false,
      response: badRequest("A course needs at least one active lesson before publishing"),
    } as const;
  }

  return { valid: true } as const;
}

export async function listAcademyCourses(request?: Request) {
  const isManagementMode =
    request ? new URL(request.url).searchParams.get("mode") === "management" : false;

  if (isManagementMode) {
    const access = await requireAcademyAdminAccess();
    if (!access.authorized) return access.response;

    const { data, error } = await access.supabase
      .from("academy_courses")
      .select(courseSelectFields)
      .eq("is_deleted", false)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      return serverError("Unable to load Academy courses");
    }

    const courseRows = (data ?? []) as AcademyCourseRow[];
    const countResult = await getCourseLessonCounts(
      access.supabase,
      courseRows.map((course) => course.id),
    );

    if ("error" in countResult && countResult.error) {
      return serverError("Unable to load Academy lesson counts");
    }

    return NextResponse.json({
      courses: courseRows.map((course) =>
        toCourseManagementResponse(
          course,
          countResult.lessonCountByCourseId.get(course.id) ?? 0,
        ),
      ),
    });
  }

  const access = await requireAcademyLearnerAccess();
  if (!access.authorized) return access.response;

  const { data, error } = await access.supabase
    .from("academy_courses")
    .select(courseSelectFields)
    .eq("is_deleted", false)
    .eq("status", "published")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    return serverError("Unable to load Academy courses");
  }

  const courseRows = (data ?? []) as AcademyCourseRow[];
  const lessonsResult = await getCourseLessons(
    access.supabase,
    courseRows.map((course) => course.id),
  );

  if (lessonsResult.error) {
    return serverError("Unable to load Academy lessons");
  }

  const progressResult = await getLessonProgress(
    access.supabase,
    access.context.memberId,
    lessonsResult.lessons.map((lesson) => lesson.id),
  );

  if (progressResult.error) {
    return serverError("Unable to load Academy progress");
  }

  return NextResponse.json({
    courses: courseRows.map((course) =>
      toCourseManagementResponse(
        course,
        lessonsResult.lessonsByCourseId.get(course.id)?.length ?? 0,
        deriveCourseProgress(
          lessonsResult.lessonsByCourseId.get(course.id) ?? [],
          progressResult.progressByLessonId,
        ),
      ),
    ),
  });
}

export async function getAcademyTeamProgress() {
  const access = await requireAcademyTeamProgressAccess();
  if (!access.authorized) return access.response;

  const { data: courses, error: courseError } = await access.supabase
    .from("academy_courses")
    .select(courseSelectFields)
    .eq("is_deleted", false)
    .eq("status", "published")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (courseError) {
    return serverError("Unable to load Academy courses");
  }

  const courseRows = (courses ?? []) as AcademyCourseRow[];
  const lessonsResult = await getCourseLessons(
    access.supabase,
    courseRows.map((course) => course.id),
  );

  if (lessonsResult.error) {
    return serverError("Unable to load Academy lessons");
  }

  const memberIds = access.visibleMembers.map((member) => member.id);
  const lessonIds = lessonsResult.lessons.map((lesson) => lesson.id);
  const progressRows =
    memberIds.length > 0 && lessonIds.length > 0
      ? await access.supabase
          .from("academy_lesson_progress")
          .select(progressSelectFields)
          .in("member_id", memberIds)
          .in("lesson_id", lessonIds)
      : { data: [], error: null };

  if (progressRows.error) {
    return serverError("Unable to load Academy team progress");
  }

  const progressByMemberId = new Map<string, Map<string, AcademyProgressRow>>();

  for (const progress of (progressRows.data ?? []) as AcademyProgressRow[]) {
    const memberProgress =
      progressByMemberId.get(progress.member_id) ?? new Map<string, AcademyProgressRow>();
    memberProgress.set(progress.lesson_id, progress);
    progressByMemberId.set(progress.member_id, memberProgress);
  }

  const members = access.visibleMembers.map((member) => {
    const memberProgressByLessonId =
      progressByMemberId.get(member.id) ?? new Map<string, AcademyProgressRow>();
    const overall = deriveMemberOverallProgress(
      courseRows,
      lessonsResult.lessonsByCourseId,
      memberProgressByLessonId,
    );

    return {
      memberId: member.id,
      memberName: member.full_name || "Unnamed member",
      position: member.position,
      overall,
      courses: courseRows.map((course) => {
        const progress = getCourseProgressForMember(
          lessonsResult.lessonsByCourseId.get(course.id) ?? [],
          memberProgressByLessonId,
        );

        return {
          courseId: course.id,
          title: course.title,
          status: progress.status,
          percentage: progress.percentage,
          trackableLessonCount: progress.trackableLessonCount,
          completedLessonCount: progress.completedLessonCount,
        };
      }),
    };
  });
  const membersWithTrackableProgress = members.filter(
    (member) => member.overall.percentage !== null,
  );
  const averageProgressPercent =
    membersWithTrackableProgress.length === 0
      ? null
      : Math.round(
          membersWithTrackableProgress.reduce(
            (total, member) => total + (member.overall.percentage ?? 0),
            0,
          ) / membersWithTrackableProgress.length,
        );
  const trackableCourseCount = courseRows.filter((course) =>
    (lessonsResult.lessonsByCourseId.get(course.id) ?? []).some(
      (lesson) => lesson.video_source_type === "youtube" && Boolean(lesson.duration_seconds),
    ),
  ).length;

  return NextResponse.json({
    summary: {
      memberCount: members.length,
      publishedCourseCount: courseRows.length,
      trackableCourseCount,
      averageProgressPercent,
    },
    members,
  });
}

export async function createAcademyCourse(request: Request) {
  const access = await requireAcademyAdminAccess();
  if (!access.authorized) return access.response;

  const parsed = await parseJsonBody(request);
  if (!parsed.valid) return parsed.response;

  const normalized = parseCourseInput(parsed.body);
  if (!normalized.valid) return normalized.response;

  const { data, error } = await access.supabase
    .from("academy_courses")
    .insert({
      ...courseMutationPayload(normalized.input, access.context.authUserId),
      created_by: access.context.authUserId,
    })
    .select(courseSelectFields)
    .single();

  if (error) {
    return serverError("Unable to create Academy course");
  }

  return NextResponse.json({ course: toCourseResponse(data as AcademyCourseRow) }, { status: 201 });
}

export async function getAcademyCourse(courseId: string) {
  const access = await requireAcademyLearnerAccess();
  if (!access.authorized) return access.response;

  const normalizedCourseId = normalizeUuid(courseId);
  if (!normalizedCourseId) {
    return badRequest("Course ID is invalid");
  }

  const { data: course, error: courseError } = await getPublishedCourse(
    access.supabase,
    normalizedCourseId,
  );

  if (courseError) {
    return serverError("Unable to load Academy course");
  }

  if (!course) {
    return notFound("Academy course not found");
  }

  const { data: lessons, error: lessonsError } = await access.supabase
    .from("academy_lessons")
    .select(lessonSelectFields)
    .eq("course_id", normalizedCourseId)
    .eq("is_deleted", false)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (lessonsError) {
    return serverError("Unable to load Academy lessons");
  }

  const lessonRows = (lessons ?? []) as AcademyLessonRow[];
  const progressResult = await getLessonProgress(
    access.supabase,
    access.context.memberId,
    lessonRows.map((lesson) => lesson.id),
  );

  if (progressResult.error) {
    return serverError("Unable to load Academy progress");
  }

  return NextResponse.json({
    course: toCourseResponse(
      course as AcademyCourseRow,
      deriveCourseProgress(lessonRows, progressResult.progressByLessonId),
    ),
    lessons: lessonRows.map((lesson) =>
      toLessonResponse(lesson, progressResult.progressByLessonId.get(lesson.id) ?? null),
    ),
  });
}

export async function getAcademyCourseForManagement(courseId: string) {
  const access = await requireAcademyAdminAccess();
  if (!access.authorized) return access.response;

  const normalizedCourseId = normalizeUuid(courseId);
  if (!normalizedCourseId) {
    return badRequest("Course ID is invalid");
  }

  const { data: course, error: courseError } = await access.supabase
    .from("academy_courses")
    .select(courseSelectFields)
    .eq("id", normalizedCourseId)
    .eq("is_deleted", false)
    .maybeSingle();

  if (courseError) {
    return serverError("Unable to load Academy course");
  }

  if (!course) {
    return notFound("Academy course not found");
  }

  const { data: lessons, error: lessonsError } = await access.supabase
    .from("academy_lessons")
    .select(lessonSelectFields)
    .eq("course_id", normalizedCourseId)
    .eq("is_deleted", false)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (lessonsError) {
    return serverError("Unable to load Academy lessons");
  }

  return NextResponse.json({
    course: toCourseManagementResponse(
      course as AcademyCourseRow,
      ((lessons ?? []) as AcademyLessonRow[]).length,
    ),
    lessons: ((lessons ?? []) as AcademyLessonRow[]).map(toLessonManagementResponse),
  });
}

export async function updateAcademyCourse(courseId: string, request: Request) {
  const access = await requireAcademyAdminAccess();
  if (!access.authorized) return access.response;

  const normalizedCourseId = normalizeUuid(courseId);
  if (!normalizedCourseId) {
    return badRequest("Course ID is invalid");
  }

  const parsed = await parseJsonBody(request);
  if (!parsed.valid) return parsed.response;

  const { data: existing, error: existingError } = await access.supabase
    .from("academy_courses")
    .select(courseSelectFields)
    .eq("id", normalizedCourseId)
    .eq("is_deleted", false)
    .maybeSingle();

  if (existingError) {
    return serverError("Unable to load Academy course");
  }

  if (!existing) {
    return notFound("Academy course not found");
  }

  const normalized = parseCourseInput(parsed.body, existing as AcademyCourseRow);
  if (!normalized.valid) return normalized.response;

  if (normalized.input.status === "published") {
    const publishValidation = await validateCourseCanPublish(access.supabase, normalizedCourseId);
    if (!publishValidation.valid) return publishValidation.response;
  }

  const { data, error } = await access.supabase
    .from("academy_courses")
    .update(courseMutationPayload(normalized.input, access.context.authUserId, existing as AcademyCourseRow))
    .eq("id", normalizedCourseId)
    .eq("is_deleted", false)
    .select(courseSelectFields)
    .single();

  if (error) {
    return serverError("Unable to update Academy course");
  }

  return NextResponse.json({ course: toCourseResponse(data as AcademyCourseRow) });
}

export async function deleteAcademyCourse(courseId: string) {
  const access = await requireAcademyAdminAccess();
  if (!access.authorized) return access.response;

  const normalizedCourseId = normalizeUuid(courseId);
  if (!normalizedCourseId) {
    return badRequest("Course ID is invalid");
  }

  const { data, error } = await access.supabase
    .from("academy_courses")
    .update({
      is_deleted: true,
      deleted_at: new Date().toISOString(),
      updated_by: access.context.authUserId,
    })
    .eq("id", normalizedCourseId)
    .eq("is_deleted", false)
    .select("id")
    .maybeSingle();

  if (error) {
    return serverError("Unable to delete Academy course");
  }

  if (!data) {
    return notFound("Academy course not found");
  }

  return NextResponse.json({ ok: true });
}

export async function createAcademyLesson(courseId: string, request: Request) {
  const access = await requireAcademyAdminAccess();
  if (!access.authorized) return access.response;

  const normalizedCourseId = normalizeUuid(courseId);
  if (!normalizedCourseId) {
    return badRequest("Course ID is invalid");
  }

  const parsed = await parseJsonBody(request);
  if (!parsed.valid) return parsed.response;

  const { data: course, error: courseError } = await access.supabase
    .from("academy_courses")
    .select("id")
    .eq("id", normalizedCourseId)
    .eq("is_deleted", false)
    .maybeSingle();

  if (courseError) {
    return serverError("Unable to verify Academy course");
  }

  if (!course) {
    return notFound("Academy course not found");
  }

  const normalized = parseLessonInput(parsed.body);
  if (!normalized.valid) return normalized.response;

  const { data, error } = await access.supabase
    .from("academy_lessons")
    .insert({
      course_id: normalizedCourseId,
      ...lessonMutationPayload(normalized.input, access.context.authUserId),
      created_by: access.context.authUserId,
    })
    .select(lessonSelectFields)
    .single();

  if (error) {
    return serverError("Unable to create Academy lesson");
  }

  return NextResponse.json({ lesson: toLessonResponse(data as AcademyLessonRow) }, { status: 201 });
}

export async function getAcademyLesson(lessonId: string) {
  const access = await requireAcademyLearnerAccess();
  if (!access.authorized) return access.response;

  const normalizedLessonId = normalizeUuid(lessonId);
  if (!normalizedLessonId) {
    return badRequest("Lesson ID is invalid");
  }

  const { data: lesson, error: lessonError } = await getActiveLessonWithPublishedCourse(
    access.supabase,
    normalizedLessonId,
  );

  if (lessonError) {
    return serverError("Unable to load Academy lesson");
  }

  if (!lesson) {
    return notFound("Academy lesson not found");
  }

  const progressResult = await getLessonProgress(access.supabase, access.context.memberId, [
    normalizedLessonId,
  ]);

  if (progressResult.error) {
    return serverError("Unable to load Academy progress");
  }

  const lessonRow = lesson as AcademyLessonRow;

  return NextResponse.json({
    lesson: toLessonResponse(
      lessonRow,
      progressResult.progressByLessonId.get(lessonRow.id) ?? null,
    ),
  });
}

export async function updateAcademyLesson(lessonId: string, request: Request) {
  const access = await requireAcademyAdminAccess();
  if (!access.authorized) return access.response;

  const normalizedLessonId = normalizeUuid(lessonId);
  if (!normalizedLessonId) {
    return badRequest("Lesson ID is invalid");
  }

  const parsed = await parseJsonBody(request);
  if (!parsed.valid) return parsed.response;

  const { data: existing, error: existingError } = await access.supabase
    .from("academy_lessons")
    .select(lessonSelectFields)
    .eq("id", normalizedLessonId)
    .eq("is_deleted", false)
    .maybeSingle();

  if (existingError) {
    return serverError("Unable to load Academy lesson");
  }

  if (!existing) {
    return notFound("Academy lesson not found");
  }

  const normalized = parseLessonInput(parsed.body, existing as AcademyLessonRow);
  if (!normalized.valid) return normalized.response;

  const { data, error } = await access.supabase
    .from("academy_lessons")
    .update(lessonMutationPayload(normalized.input, access.context.authUserId))
    .eq("id", normalizedLessonId)
    .eq("is_deleted", false)
    .select(lessonSelectFields)
    .single();

  if (error) {
    return serverError("Unable to update Academy lesson");
  }

  return NextResponse.json({ lesson: toLessonResponse(data as AcademyLessonRow) });
}

export async function deleteAcademyLesson(lessonId: string) {
  const access = await requireAcademyAdminAccess();
  if (!access.authorized) return access.response;

  const normalizedLessonId = normalizeUuid(lessonId);
  if (!normalizedLessonId) {
    return badRequest("Lesson ID is invalid");
  }

  const { data, error } = await access.supabase
    .from("academy_lessons")
    .update({
      is_deleted: true,
      deleted_at: new Date().toISOString(),
      updated_by: access.context.authUserId,
    })
    .eq("id", normalizedLessonId)
    .eq("is_deleted", false)
    .select("id")
    .maybeSingle();

  if (error) {
    return serverError("Unable to delete Academy lesson");
  }

  if (!data) {
    return notFound("Academy lesson not found");
  }

  return NextResponse.json({ ok: true });
}

export async function updateAcademyLessonProgress(lessonId: string, request: Request) {
  const access = await requireAcademyLearnerAccess();
  if (!access.authorized) return access.response;

  const normalizedLessonId = normalizeUuid(lessonId);
  if (!normalizedLessonId) {
    return badRequest("Lesson ID is invalid");
  }

  const parsed = await parseJsonBody(request);
  if (!parsed.valid) return parsed.response;

  const forbiddenFields = [
    "memberId",
    "member_id",
    "learningPercentage",
    "completionPercentage",
    "completed",
    "completedAt",
    "completed_at",
  ];
  if (forbiddenFields.some((field) => Object.hasOwn(parsed.body, field))) {
    return badRequest("Progress completion fields are server-derived");
  }

  if (
    hasUnsupportedFields(parsed.body, [
      "lastPositionSeconds",
      "maxWatchedSeconds",
      "observedDurationSeconds",
    ])
  ) {
    return badRequest("Unsupported fields provided");
  }

  const lastPositionInput = normalizeNonNegativeInteger(parsed.body.lastPositionSeconds);
  const maxWatchedInput = normalizeNonNegativeInteger(parsed.body.maxWatchedSeconds);
  const observedDurationInput = normalizePositiveInteger(parsed.body.observedDurationSeconds);

  if (
    lastPositionInput === undefined ||
    maxWatchedInput === undefined ||
    observedDurationInput === undefined
  ) {
    return badRequest("Progress values must be non-negative integers");
  }

  const { data: lesson, error: lessonError } = await getActiveLessonWithPublishedCourse(
    access.supabase,
    normalizedLessonId,
  );

  if (lessonError) {
    return serverError("Unable to verify Academy lesson");
  }

  if (!lesson) {
    return notFound("Academy lesson not found");
  }

  const lessonRow = lesson as AcademyLessonRow;
  const durationSeconds = lessonRow.duration_seconds;
  const maxAllowedProgress =
    durationSeconds && durationSeconds > 0 ? Math.floor(durationSeconds) + 5 : null;

  const clampProgress = (value: number) =>
    maxAllowedProgress === null ? value : Math.min(value, maxAllowedProgress);

  const { data: existing, error: existingError } = await access.supabase
    .from("academy_lesson_progress")
    .select(progressSelectFields)
    .eq("member_id", access.context.memberId)
    .eq("lesson_id", normalizedLessonId)
    .maybeSingle();

  if (existingError) {
    return serverError("Unable to load Academy progress");
  }

  const existingProgress = existing as AcademyProgressRow | null;
  const nextLastPosition = clampProgress(
    lastPositionInput ?? existingProgress?.last_position_seconds ?? 0,
  );
  const previousMaxWatched = existingProgress?.max_watched_seconds ?? 0;
  const reportedMaxWatched = maxWatchedInput ?? lastPositionInput ?? previousMaxWatched;
  const allowedMaxWatched = previousMaxWatched + academyProgressAdvanceToleranceSeconds;
  const nextMaxWatched = clampProgress(
    Math.max(previousMaxWatched, Math.min(reportedMaxWatched, allowedMaxWatched)),
  );
  const now = new Date().toISOString();
  const completedNow = isAcademyProgressCompleted(nextMaxWatched, durationSeconds);
  const completedAt = existingProgress?.completed_at ?? (completedNow ? now : null);

  const { data: savedProgress, error: saveError } = await access.supabase
    .from("academy_lesson_progress")
    .upsert(
      {
        member_id: access.context.memberId,
        lesson_id: normalizedLessonId,
        last_position_seconds: nextLastPosition,
        max_watched_seconds: nextMaxWatched,
        started_at: existingProgress?.started_at ?? now,
        last_watched_at: now,
        completed_at: completedAt,
      },
      { onConflict: "member_id,lesson_id" },
    )
    .select(progressSelectFields)
    .single();

  if (saveError) {
    return serverError("Unable to update Academy progress");
  }

  return NextResponse.json({
    progress: toProgressResponse(savedProgress as AcademyProgressRow, durationSeconds),
  });
}
