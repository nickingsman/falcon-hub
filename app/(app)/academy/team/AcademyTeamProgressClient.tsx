"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { AcademyProgressStatus } from "@/lib/academy";

type TeamProgressStatus = AcademyProgressStatus | "untracked";

type TeamCourseProgress = {
  courseId: string;
  title: string;
  status: TeamProgressStatus;
  percentage: number | null;
  trackableLessonCount: number;
  completedLessonCount: number;
};

type TeamMemberProgress = {
  memberId: string;
  memberName: string;
  position: string | null;
  overall: {
    status: TeamProgressStatus;
    percentage: number | null;
    completedCourses: number;
    startedCourses: number;
    trackableCourseCount: number;
    untrackedCourseCount: number;
  };
  courses: TeamCourseProgress[];
};

type TeamProgressResponse = {
  summary: {
    memberCount: number;
    publishedCourseCount: number;
    trackableCourseCount: number;
    averageProgressPercent: number | null;
  };
  members: TeamMemberProgress[];
};

type LoadState = "loading" | "ready" | "error";

const statusLabels: Record<TeamProgressStatus, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  completed: "Completed",
  untracked: "Untracked",
};

const statusStyles: Record<TeamProgressStatus, string> = {
  not_started: "border-zinc-200 bg-zinc-50 text-zinc-600",
  in_progress: "border-amber-200 bg-amber-50 text-amber-800",
  completed: "border-emerald-200 bg-emerald-50 text-emerald-800",
  untracked: "border-zinc-200 bg-white text-zinc-500",
};

function formatPercent(value: number | null) {
  return value === null ? "--" : `${value}%`;
}

function ProgressBar({ value }: { value: number | null }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
      <div
        className="h-full rounded-full bg-[#087F6B] transition-all"
        style={{ width: `${Math.max(0, Math.min(100, value ?? 0))}%` }}
      />
    </div>
  );
}

export default function AcademyTeamProgressClient() {
  const [data, setData] = useState<TeamProgressResponse | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [expandedMemberIds, setExpandedMemberIds] = useState<Set<string>>(new Set());

  const loadTeamProgress = useCallback(async () => {
    setLoadState("loading");
    setErrorMessage("");

    try {
      const response = await fetch("/api/academy/team-progress", {
        cache: "no-store",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to load team training progress");
      }

      setData(result);
      setLoadState("ready");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to load team training progress",
      );
      setLoadState("error");
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadTeamProgress();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadTeamProgress]);

  const summaryCards = useMemo(() => {
    const summary = data?.summary;

    return [
      { label: "Team Members", value: summary?.memberCount ?? "--" },
      { label: "Published Courses", value: summary?.publishedCourseCount ?? "--" },
      { label: "Trackable Courses", value: summary?.trackableCourseCount ?? "--" },
      {
        label: "Average Progress",
        value: summary ? formatPercent(summary.averageProgressPercent) : "--",
      },
    ];
  }, [data]);

  function toggleMember(memberId: string) {
    setExpandedMemberIds((current) => {
      const next = new Set(current);
      if (next.has(memberId)) {
        next.delete(memberId);
      } else {
        next.add(memberId);
      }

      return next;
    });
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <section className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-[0_12px_34px_rgba(15,23,42,0.05)] sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#087F6B]">
          Falcon Academy
        </p>
        <div className="mt-3 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">
              Team Training Progress
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600 sm:text-base">
              Factual Academy progress for the members you are authorized to view.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/academy"
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-zinc-300 px-5 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2"
            >
              Academy Library
            </Link>
            <button
              type="button"
              onClick={() => void loadTeamProgress()}
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-zinc-950 px-5 text-sm font-semibold text-white transition hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2"
            >
              Refresh
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map((card) => (
          <article
            key={card.label}
            className="rounded-[20px] border border-zinc-200 bg-white p-4 shadow-[0_10px_26px_rgba(15,23,42,0.04)]"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
              {card.label}
            </p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">
              {card.value}
            </p>
          </article>
        ))}
      </section>

      {loadState === "loading" ? (
        <section className="rounded-[24px] border border-zinc-200 bg-white p-6 text-sm text-zinc-500">
          Loading team training progress...
        </section>
      ) : null}

      {loadState === "error" ? (
        <section className="rounded-[24px] border border-red-200 bg-red-50 p-6">
          <h2 className="text-base font-semibold text-red-900">
            Unable to load team training progress
          </h2>
          <p className="mt-2 text-sm text-red-700">{errorMessage}</p>
        </section>
      ) : null}

      {loadState === "ready" && data?.members.length === 0 ? (
        <section className="rounded-[24px] border border-dashed border-zinc-300 bg-white p-8 text-center">
          <h2 className="text-lg font-semibold text-zinc-950">No team members available</h2>
          <p className="mt-2 text-sm text-zinc-500">
            Active downline members will appear here when they are available.
          </p>
        </section>
      ) : null}

      {loadState === "ready" && data && data.summary.publishedCourseCount === 0 ? (
        <section className="rounded-[24px] border border-dashed border-zinc-300 bg-white p-8 text-center">
          <h2 className="text-lg font-semibold text-zinc-950">No published Academy courses yet</h2>
          <p className="mt-2 text-sm text-zinc-500">
            Published training courses will appear here once they are ready.
          </p>
        </section>
      ) : null}

      {loadState === "ready" &&
      data &&
      data.summary.publishedCourseCount > 0 &&
      data.summary.trackableCourseCount === 0 ? (
        <section className="rounded-[24px] border border-amber-200 bg-amber-50 p-6">
          <h2 className="text-base font-semibold text-amber-950">
            Progress tracking unavailable
          </h2>
          <p className="mt-2 text-sm leading-6 text-amber-800">
            Training content is available, but progress tracking is unavailable for these lessons.
          </p>
        </section>
      ) : null}

      {loadState === "ready" && data && data.members.length > 0 ? (
        <section className="space-y-4">
          {data.members.map((member) => {
            const isExpanded = expandedMemberIds.has(member.memberId);

            return (
              <article
                key={member.memberId}
                className="rounded-[24px] border border-zinc-200 bg-white p-5 shadow-[0_10px_28px_rgba(15,23,42,0.04)] sm:p-6"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="break-words text-xl font-semibold text-zinc-950">
                      {member.memberName}
                    </h2>
                    {member.position ? (
                      <p className="mt-1 text-sm text-zinc-500">{member.position}</p>
                    ) : null}
                  </div>
                  <span
                    className={`inline-flex w-fit rounded-full border px-3 py-1 text-xs font-semibold ${statusStyles[member.overall.status]}`}
                  >
                    {statusLabels[member.overall.status]}
                  </span>
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-[1.3fr_0.7fr] sm:items-end">
                  <div>
                    <div className="flex items-end justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                          Overall Training
                        </p>
                        <p className="mt-1 text-3xl font-semibold tracking-tight text-zinc-950">
                          {formatPercent(member.overall.percentage)}
                        </p>
                      </div>
                      <div className="text-right text-sm text-zinc-600">
                        <p>
                          <span className="font-semibold text-zinc-950">
                            {member.overall.completedCourses}
                          </span>{" "}
                          Completed
                        </p>
                        <p>
                          <span className="font-semibold text-zinc-950">
                            {member.overall.startedCourses}
                          </span>{" "}
                          Started
                        </p>
                      </div>
                    </div>
                    <div className="mt-3">
                      <ProgressBar value={member.overall.percentage} />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleMember(member.memberId)}
                    className="inline-flex min-h-10 items-center justify-center rounded-full border border-zinc-300 px-4 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 sm:justify-self-end"
                  >
                    {isExpanded ? "Hide Courses" : "View Courses"}
                  </button>
                </div>

                {isExpanded ? (
                  <div className="mt-5 space-y-3 border-t border-zinc-100 pt-5">
                    {member.courses.map((course) => (
                      <div
                        key={course.courseId}
                        className="rounded-[18px] border border-zinc-200 bg-zinc-50 p-4"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <h3 className="break-words text-sm font-semibold text-zinc-950">
                              {course.title}
                            </h3>
                            <p className="mt-1 text-xs text-zinc-500">
                              {course.trackableLessonCount > 0
                                ? `${course.completedLessonCount} of ${course.trackableLessonCount} trackable lessons completed`
                                : "Progress tracking unavailable for this course"}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 sm:flex-col sm:items-end">
                            <span
                              className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusStyles[course.status]}`}
                            >
                              {statusLabels[course.status]}
                            </span>
                            <span className="text-sm font-semibold text-zinc-950">
                              {formatPercent(course.percentage)}
                            </span>
                          </div>
                        </div>
                        {course.percentage !== null ? (
                          <div className="mt-3">
                            <ProgressBar value={course.percentage} />
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}
              </article>
            );
          })}
        </section>
      ) : null}
    </main>
  );
}
