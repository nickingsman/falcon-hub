"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAppPermissions } from "@/app/(app)/components/AppPermissionProvider";
import type { AcademyProgressStatus } from "@/lib/academy";

type AcademyCourse = {
  id: string;
  title: string;
  description: string | null;
  coverImageUrl: string | null;
  lessonCount: number;
  progress?: {
    status: AcademyProgressStatus | "untracked";
    percentage: number | null;
    trackableLessonCount: number;
    completedLessonCount: number;
  };
};

type LoadState = "loading" | "ready" | "error";

const progressLabels: Record<AcademyProgressStatus | "untracked", string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  completed: "Completed",
  untracked: "Playback Only",
};

function getCourseActionLabel(course: AcademyCourse) {
  if (course.progress?.status === "completed") return "Review Course";
  if (course.progress?.status === "in_progress") return "Continue Course";

  return "Start Course";
}

export default function AcademyPage() {
  const { role } = useAppPermissions();
  const [courses, setCourses] = useState<AcademyCourse[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const canViewTeamProgress =
    role === "super_admin" || role === "admin" || role === "leader";
  const canManageAcademy = role === "super_admin" || role === "admin";

  const loadCourses = useCallback(async () => {
    setLoadState("loading");
    setErrorMessage("");

    try {
      const response = await fetch("/api/academy/courses", {
        cache: "no-store",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to load Academy courses");
      }

      setCourses(result.courses ?? []);
      setLoadState("ready");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load Academy courses");
      setLoadState("error");
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadCourses();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadCourses]);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <section className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-[0_12px_34px_rgba(15,23,42,0.05)] sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#087F6B]">
          Learning
        </p>
        <div className="mt-3 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">
              Falcon Academy
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600 sm:text-base">
              Internal learning and training for Falcon members.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {canViewTeamProgress ? (
              <Link
                href="/academy/team"
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-zinc-300 px-5 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2"
              >
                Team Progress
              </Link>
            ) : null}
            {canManageAcademy ? (
              <Link
                href="/academy/manage"
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-zinc-950 px-5 text-sm font-semibold text-white transition hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2"
              >
                Manage Academy
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-zinc-950">Course Library</h2>
            <p className="mt-1 text-sm text-zinc-500">Published Academy courses ready for learning.</p>
          </div>
          <button
            type="button"
            onClick={() => void loadCourses()}
            className="hidden min-h-10 rounded-full border border-zinc-300 px-4 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 sm:inline-flex sm:items-center"
          >
            Refresh
          </button>
        </div>

        {loadState === "loading" ? (
          <div className="rounded-[24px] border border-zinc-200 bg-white p-6 text-sm text-zinc-500">
            Loading courses...
          </div>
        ) : null}

        {loadState === "error" ? (
          <div className="rounded-[24px] border border-red-200 bg-red-50 p-6">
            <h2 className="text-base font-semibold text-red-900">Unable to load Falcon Academy</h2>
            <p className="mt-2 text-sm text-red-700">{errorMessage}</p>
          </div>
        ) : null}

        {loadState === "ready" && courses.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-zinc-300 bg-white p-8 text-center">
            <h2 className="text-lg font-semibold text-zinc-950">No published courses yet</h2>
            <p className="mt-2 text-sm text-zinc-500">
              Published learning content will appear here when it is ready.
            </p>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          {courses.map((course) => (
            <article
              key={course.id}
              className="overflow-hidden rounded-[24px] border border-zinc-200 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.04)]"
            >
              {course.coverImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={course.coverImageUrl}
                  alt={`${course.title} cover`}
                  className="aspect-[16/9] w-full object-cover"
                />
              ) : (
                <div className="flex aspect-[16/9] items-center justify-center bg-zinc-100 text-sm font-semibold text-zinc-400">
                  Falcon Academy
                </div>
              )}
              <div className="p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#087F6B]">
                  {course.lessonCount} {course.lessonCount === 1 ? "Lesson" : "Lessons"}
                </p>
                <h3 className="mt-2 break-words text-xl font-semibold text-zinc-950">
                  {course.title}
                </h3>
                {course.description ? (
                  <p className="mt-2 line-clamp-3 text-sm leading-6 text-zinc-600">
                    {course.description}
                  </p>
                ) : null}
                {course.progress ? (
                  <div className="mt-4">
                    <div className="flex items-center justify-between gap-3 text-xs font-semibold text-zinc-600">
                      <span>{progressLabels[course.progress.status]}</span>
                      {course.progress.percentage !== null ? (
                        <span>{course.progress.percentage}%</span>
                      ) : null}
                    </div>
                    {course.progress.percentage !== null ? (
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-100">
                        <div
                          className="h-full rounded-full bg-[#087F6B]"
                          style={{ width: `${course.progress.percentage}%` }}
                        />
                      </div>
                    ) : (
                      <p className="mt-2 text-xs leading-5 text-zinc-500">
                        Progress tracking is unavailable for this course source.
                      </p>
                    )}
                  </div>
                ) : null}
                <Link
                  href={`/academy/courses/${course.id}`}
                  className="mt-5 inline-flex min-h-10 items-center justify-center rounded-full bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2"
                >
                  {getCourseActionLabel(course)}
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
