"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getAcademyProgressStatus, type AcademyProgressStatus } from "@/lib/academy";
import { getAcademyVideoEmbed } from "@/lib/academy-video";
import YouTubeProgressPlayer from "./YouTubeProgressPlayer";

type AcademyVideoSourceType = "youtube" | "vimeo" | "google_drive" | "external";
type LoadState = "loading" | "ready" | "error";

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
  startedAt?: string | null;
  lastWatchedAt?: string | null;
};

type AcademyCourse = {
  id: string;
  title: string;
  description: string | null;
};

type LessonResponse = {
  lesson?: AcademyLesson;
  error?: string;
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

const progressLabels: Record<AcademyProgressStatus, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  completed: "Completed",
};

function formatDuration(durationSeconds: number | null) {
  if (!durationSeconds) return "Duration TBC";
  const minutes = Math.floor(durationSeconds / 60);
  const seconds = durationSeconds % 60;

  if (minutes === 0) return `${seconds}s`;
  if (seconds === 0) return `${minutes}m`;

  return `${minutes}m ${seconds}s`;
}

function formatPlaybackTime(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;

  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

export default function AcademyLessonPage({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}) {
  const [lessonId, setLessonId] = useState<string | null>(null);
  const [lesson, setLesson] = useState<AcademyLesson | null>(null);
  const [course, setCourse] = useState<AcademyCourse | null>(null);
  const [courseLessons, setCourseLessons] = useState<AcademyLesson[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    void params.then(({ lessonId: nextLessonId }) => {
      if (isMounted) setLessonId(nextLessonId);
    });

    return () => {
      isMounted = false;
    };
  }, [params]);

  const loadLesson = useCallback(async () => {
    if (!lessonId) return;

    setLoadState("loading");
    setErrorMessage("");

    try {
      const lessonResponse = await fetch(`/api/academy/lessons/${lessonId}`, {
        cache: "no-store",
      });
      const lessonResult = (await lessonResponse.json()) as LessonResponse;

      if (!lessonResponse.ok || !lessonResult.lesson) {
        throw new Error(lessonResult.error || "Unable to load Academy lesson");
      }

      const courseResponse = await fetch(`/api/academy/courses/${lessonResult.lesson.courseId}`, {
        cache: "no-store",
      });
      const courseResult = (await courseResponse.json()) as CourseResponse;

      if (!courseResponse.ok || !courseResult.course) {
        throw new Error(courseResult.error || "Unable to load Academy course");
      }

      setLesson(lessonResult.lesson);
      setCourse(courseResult.course);
      setCourseLessons(courseResult.lessons ?? []);
      setLoadState("ready");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load Academy lesson");
      setLoadState("error");
    }
  }, [lessonId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadLesson();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadLesson]);

  const lessonNumber = useMemo(() => {
    if (!lesson) return null;
    const index = courseLessons.findIndex((item) => item.id === lesson.id);

    return index >= 0 ? index + 1 : null;
  }, [courseLessons, lesson]);

  const videoEmbed = useMemo(
    () => (lesson ? getAcademyVideoEmbed(lesson.videoSourceType, lesson.externalVideoUrl) : null),
    [lesson],
  );
  const progressStatus = useMemo(
    () => getAcademyProgressStatus(lesson?.progress),
    [lesson?.progress],
  );
  const supportsTracking = lesson?.videoSourceType === "youtube" && videoEmbed?.mode === "embed";
  const resumePosition = lesson?.progress.lastPositionSeconds ?? 0;

  if (loadState === "loading") {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="rounded-[24px] border border-zinc-200 bg-white p-6 text-sm text-zinc-500">
          Loading lesson...
        </div>
      </main>
    );
  }

  if (loadState === "error" || !lesson || !course || !videoEmbed) {
    return (
      <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
        <section className="rounded-[24px] border border-red-200 bg-red-50 p-6">
          <h1 className="text-xl font-semibold text-red-900">Lesson unavailable</h1>
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
      <Link
        href={`/academy/courses/${course.id}`}
        className="text-sm font-semibold text-zinc-500 hover:text-zinc-950"
      >
        Back to Course
      </Link>

      <section className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)] sm:p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#087F6B]">
          {course.title}
        </p>
        <h1 className="mt-3 break-words text-3xl font-semibold tracking-tight text-zinc-950">
          {lessonNumber ? `Lesson ${lessonNumber}: ` : ""}
          {lesson.title}
        </h1>
        {lesson.description ? (
          <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600 sm:text-base">
            {lesson.description}
          </p>
        ) : null}
      </section>

      <section className="overflow-hidden rounded-[28px] border border-zinc-200 bg-white shadow-[0_12px_34px_rgba(15,23,42,0.05)]">
        <div className="aspect-video w-full bg-zinc-950">
          {videoEmbed.mode === "embed" ? (
            videoEmbed.provider === "youtube" ? (
              <YouTubeProgressPlayer
                lessonId={lesson.id}
                title={lesson.title}
                embedUrl={videoEmbed.embedUrl}
                initialProgress={lesson.progress}
                onProgressSaved={(progress) =>
                  setLesson((current) => (current ? { ...current, progress } : current))
                }
              />
            ) : (
              <iframe
                src={videoEmbed.embedUrl}
                title={`${lesson.title} video`}
                className="h-full w-full"
                allow="fullscreen; picture-in-picture"
                allowFullScreen
              />
            )
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-4 px-5 text-center">
              <p className="text-sm font-semibold text-white">Open this lesson video externally.</p>
              {videoEmbed.externalUrl ? (
                <a
                  href={videoEmbed.externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-10 items-center justify-center rounded-full bg-white px-4 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-100"
                >
                  Open Video
                </a>
              ) : (
                <p className="text-sm text-zinc-300">Video URL is unavailable.</p>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-[24px] border border-zinc-200 bg-white p-5 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
              Lesson Progress
            </p>
            <h2 className="mt-2 text-xl font-semibold text-zinc-950">
              {supportsTracking ? progressLabels[progressStatus] : "Playback Only"}
            </h2>
            {supportsTracking && lesson.progress.learningPercentage !== null ? (
              <p className="mt-1 text-sm font-semibold text-zinc-600">
                {lesson.progress.learningPercentage}% complete
              </p>
            ) : (
              <p className="mt-1 text-sm leading-6 text-zinc-500">
                Progress tracking is unavailable for this video source.
              </p>
            )}
          </div>
          {supportsTracking && resumePosition > 5 && progressStatus !== "completed" ? (
            <p className="rounded-full border border-teal-200 bg-teal-50 px-4 py-2 text-sm font-semibold text-[#087F6B]">
              Resume from {formatPlaybackTime(resumePosition)}
            </p>
          ) : null}
        </div>
        {supportsTracking && lesson.progress.learningPercentage !== null ? (
          <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-zinc-100">
            <div
              className="h-full rounded-full bg-[#087F6B]"
              style={{ width: `${lesson.progress.learningPercentage}%` }}
            />
          </div>
        ) : null}
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-[20px] border border-zinc-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
            Video Source
          </p>
          <p className="mt-2 text-sm font-semibold text-zinc-950">
            {videoSourceLabels[lesson.videoSourceType]}
          </p>
        </div>
        <div className="rounded-[20px] border border-zinc-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
            Duration
          </p>
          <p className="mt-2 text-sm font-semibold text-zinc-950">
            {formatDuration(lesson.durationSeconds)}
          </p>
        </div>
      </section>
    </main>
  );
}
