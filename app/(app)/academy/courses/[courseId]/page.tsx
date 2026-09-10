"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAppPermissions } from "@/app/(app)/components/AppPermissionProvider";
import { getAcademyProgressStatus, type AcademyProgressStatus } from "@/lib/academy";

type AcademyVideoSourceType = "youtube" | "vimeo" | "google_drive" | "external";
type LoadState = "loading" | "ready" | "error";

type AcademyCourse = {
  id: string;
  title: string;
  description: string | null;
  coverImageUrl: string | null;
  progress?: CourseProgress;
};

type AcademyLesson = {
  id: string;
  courseId: string;
  title: string;
  description: string | null;
  videoSourceType: AcademyVideoSourceType;
  externalVideoUrl: string | null;
  durationSeconds: number | null;
  progress: LessonProgress;
};

type LessonProgress = {
  lastPositionSeconds: number;
  maxWatchedSeconds: number;
  learningPercentage: number | null;
  isCompleted: boolean;
  completedAt: string | null;
};

type CourseProgress = {
  status: AcademyProgressStatus | "untracked";
  percentage: number | null;
  trackableLessonCount: number;
  completedLessonCount: number;
};

type CourseResponse = {
  course?: AcademyCourse;
  lessons?: AcademyLesson[];
  error?: string;
};

const videoSourceLabels: Record<AcademyVideoSourceType, string> = {
  youtube: "YouTube",
  vimeo: "Vimeo",
  google_drive: "Google Drive",
  external: "External Video",
};

const progressLabels: Record<AcademyProgressStatus | "untracked", string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  completed: "Completed",
  untracked: "Playback Only",
};

function formatDuration(durationSeconds: number | null) {
  if (!durationSeconds) return "Duration TBC";
  const minutes = Math.floor(durationSeconds / 60);
  const seconds = durationSeconds % 60;

  if (minutes === 0) return `${seconds}s`;
  if (seconds === 0) return `${minutes}m`;

  return `${minutes}m ${seconds}s`;
}

export default function AcademyCoursePage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { role } = useAppPermissions();
  const canManageAcademy = role === "super_admin" || role === "admin";
  const [courseId, setCourseId] = useState<string | null>(null);
  const [course, setCourse] = useState<AcademyCourse | null>(null);
  const [lessons, setLessons] = useState<AcademyLesson[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    void params.then(({ courseId: nextCourseId }) => {
      if (isMounted) setCourseId(nextCourseId);
    });

    return () => {
      isMounted = false;
    };
  }, [params]);

  const loadCourse = useCallback(async () => {
    if (!courseId) return;

    setLoadState("loading");
    setErrorMessage("");

    try {
      const response = await fetch(`/api/academy/courses/${courseId}`, {
        cache: "no-store",
      });
      const result = (await response.json()) as CourseResponse;

      if (!response.ok || !result.course) {
        throw new Error(result.error || "Unable to load Academy course");
      }

      setCourse(result.course);
      setLessons(result.lessons ?? []);
      setLoadState("ready");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load Academy course");
      setLoadState("error");
    }
  }, [courseId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadCourse();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadCourse]);

  if (loadState === "loading") {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="rounded-[24px] border border-zinc-200 bg-white p-6 text-sm text-zinc-500">
          Loading course...
        </div>
      </main>
    );
  }

  if (loadState === "error" || !course) {
    return (
      <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
        <section className="rounded-[24px] border border-red-200 bg-red-50 p-6">
          <h1 className="text-xl font-semibold text-red-900">Course unavailable</h1>
          <p className="mt-2 text-sm text-red-700">{errorMessage}</p>
          <Link
            href="/academy"
            className="mt-5 inline-flex min-h-10 items-center rounded-full bg-white px-4 text-sm font-semibold text-red-800"
          >
            Back to Falcon Academy
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 pb-24 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/academy" className="text-sm font-semibold text-zinc-500 hover:text-zinc-950">
          Back to Falcon Academy
        </Link>
        {canManageAcademy ? (
          <Link
            href={`/academy/manage/${course.id}`}
            className="inline-flex min-h-10 items-center justify-center rounded-full border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2"
          >
            Edit Course
          </Link>
        ) : null}
      </div>

      <section className="overflow-hidden rounded-[28px] border border-zinc-200 bg-white shadow-[0_12px_34px_rgba(15,23,42,0.05)]">
        {course.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={course.coverImageUrl}
            alt={`${course.title} cover`}
            className="aspect-[16/9] w-full object-cover"
          />
        ) : null}
        <div className="p-6 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#087F6B]">
            {lessons.length} {lessons.length === 1 ? "Lesson" : "Lessons"}
          </p>
          <h1 className="mt-3 break-words text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">
            {course.title}
          </h1>
          {course.description ? (
            <p className="mt-4 max-w-3xl text-sm leading-6 text-zinc-600 sm:text-base">
              {course.description}
            </p>
          ) : null}
          {course.progress ? (
            <div className="mt-6 max-w-md">
              <div className="flex items-center justify-between gap-3 text-sm font-semibold text-zinc-700">
                <span>Course Progress</span>
                <span>{progressLabels[course.progress.status]}</span>
              </div>
              {course.progress.percentage !== null ? (
                <>
                  <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-zinc-100">
                    <div
                      className="h-full rounded-full bg-[#087F6B]"
                      style={{ width: `${course.progress.percentage}%` }}
                    />
                  </div>
                  <p className="mt-2 text-sm font-semibold text-zinc-600">
                    {course.progress.percentage}% complete
                  </p>
                </>
              ) : (
                <p className="mt-2 text-sm leading-6 text-zinc-500">
                  Progress tracking is unavailable for this course source.
                </p>
              )}
            </div>
          ) : null}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-zinc-950">Lessons</h2>
        {lessons.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-zinc-300 bg-white p-8 text-center">
            <h3 className="text-lg font-semibold text-zinc-950">No lessons available</h3>
            <p className="mt-2 text-sm text-zinc-500">
              Lessons will appear here when this course is ready.
            </p>
          </div>
        ) : null}

        {lessons.map((lesson, index) => (
          (() => {
            const progressStatus = getAcademyProgressStatus(lesson.progress);
            const percentage = lesson.progress.learningPercentage;

            return (
          <article
            key={lesson.id}
            className="rounded-[24px] border border-zinc-200 bg-white p-5 shadow-[0_10px_28px_rgba(15,23,42,0.04)]"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                  Lesson {index + 1}
                </p>
                <h3 className="mt-2 break-words text-lg font-semibold text-zinc-950">
                  {lesson.title}
                </h3>
                {lesson.description ? (
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-zinc-600">
                    {lesson.description}
                  </p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-zinc-600">
                  <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1">
                    {videoSourceLabels[lesson.videoSourceType]}
                  </span>
                  <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1">
                    {formatDuration(lesson.durationSeconds)}
                  </span>
                  {lesson.videoSourceType === "youtube" && percentage !== null ? (
                    <span className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-[#087F6B]">
                      {progressLabels[progressStatus]} · {percentage}%
                    </span>
                  ) : (
                    <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1">
                      {lesson.videoSourceType === "youtube"
                        ? progressLabels[progressStatus]
                        : "Progress unavailable"}
                    </span>
                  )}
                </div>
              </div>
              <Link
                href={`/academy/lessons/${lesson.id}`}
                className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-full bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2"
              >
                {progressStatus === "completed"
                  ? "Review Lesson"
                  : progressStatus === "in_progress"
                    ? "Continue Lesson"
                    : "Watch Lesson"}
              </Link>
            </div>
          </article>
            );
          })()
        ))}
      </section>
    </main>
  );
}
