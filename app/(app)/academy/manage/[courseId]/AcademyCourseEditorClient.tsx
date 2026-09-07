"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type AcademyCourseStatus = "draft" | "published" | "archived";
type AcademyVideoSourceType = "youtube" | "vimeo" | "google_drive" | "external";
type LoadState = "loading" | "ready" | "error";

type AcademyCourse = {
  id: string;
  title: string;
  description: string | null;
  status: AcademyCourseStatus;
  sortOrder: number;
  coverImageUrl: string | null;
  publishedAt: string | null;
  updatedAt: string;
  lessonCount: number;
};

type AcademyLesson = {
  id: string;
  courseId: string;
  title: string;
  description: string | null;
  videoSourceType: AcademyVideoSourceType;
  externalVideoUrl: string | null;
  durationSeconds: number | null;
  sortOrder: number;
  updatedAt: string;
};

type CourseForm = {
  title: string;
  description: string;
  sortOrder: string;
  coverImageUrl: string;
};

type LessonForm = {
  title: string;
  description: string;
  videoSourceType: AcademyVideoSourceType;
  externalVideoUrl: string;
  durationMinutes: string;
  durationSeconds: string;
};

type CourseDetailResponse = {
  course?: AcademyCourse;
  lessons?: AcademyLesson[];
  error?: string;
};

const videoSourceOptions: Array<{ value: AcademyVideoSourceType; label: string }> = [
  { value: "youtube", label: "YouTube" },
  { value: "vimeo", label: "Vimeo" },
  { value: "google_drive", label: "Google Drive" },
  { value: "external", label: "Other" },
];

const statusLabels: Record<AcademyCourseStatus, string> = {
  draft: "Draft",
  published: "Published",
  archived: "Archived",
};

const statusStyles: Record<AcademyCourseStatus, string> = {
  draft: "border-zinc-200 bg-zinc-50 text-zinc-700",
  published: "border-teal-200 bg-teal-50 text-teal-800",
  archived: "border-amber-200 bg-amber-50 text-amber-800",
};

const emptyLessonForm: LessonForm = {
  title: "",
  description: "",
  videoSourceType: "youtube",
  externalVideoUrl: "",
  durationMinutes: "",
  durationSeconds: "",
};

function toCourseForm(course: AcademyCourse): CourseForm {
  return {
    title: course.title,
    description: course.description ?? "",
    sortOrder: String(course.sortOrder),
    coverImageUrl: course.coverImageUrl ?? "",
  };
}

function toLessonForm(lesson: AcademyLesson): LessonForm {
  const durationSeconds = lesson.durationSeconds ?? 0;

  return {
    title: lesson.title,
    description: lesson.description ?? "",
    videoSourceType: lesson.videoSourceType,
    externalVideoUrl: lesson.externalVideoUrl ?? "",
    durationMinutes: lesson.durationSeconds === null ? "" : String(Math.floor(durationSeconds / 60)),
    durationSeconds: lesson.durationSeconds === null ? "" : String(durationSeconds % 60),
  };
}

function getLessonDuration(form: LessonForm) {
  const minutes = Number(form.durationMinutes || 0);
  const seconds = Number(form.durationSeconds || 0);

  if (!Number.isFinite(minutes) || !Number.isFinite(seconds) || minutes < 0 || seconds < 0) {
    return undefined;
  }

  if (seconds > 59) return undefined;

  const totalSeconds = Math.floor(minutes) * 60 + Math.floor(seconds);

  return totalSeconds > 0 ? totalSeconds : null;
}

function lessonPayload(form: LessonForm, sortOrder?: number) {
  const durationSeconds = getLessonDuration(form);

  if (durationSeconds === undefined) return null;

  return {
    title: form.title,
    description: form.description,
    videoSourceType: form.videoSourceType,
    externalVideoUrl: form.externalVideoUrl,
    durationSeconds,
    ...(sortOrder !== undefined ? { sortOrder } : {}),
  };
}

function formatDuration(durationSeconds: number | null) {
  if (!durationSeconds) return "-";
  const minutes = Math.floor(durationSeconds / 60);
  const seconds = durationSeconds % 60;

  if (minutes === 0) return `${seconds}s`;
  if (seconds === 0) return `${minutes}m`;

  return `${minutes}m ${seconds}s`;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kuala_Lumpur",
  }).format(date);
}

export default function AcademyCourseEditorClient({ courseId }: { courseId: string }) {
  const [course, setCourse] = useState<AcademyCourse | null>(null);
  const [lessons, setLessons] = useState<AcademyLesson[]>([]);
  const [courseForm, setCourseForm] = useState<CourseForm | null>(null);
  const [lessonForm, setLessonForm] = useState<LessonForm>(emptyLessonForm);
  const [editingLesson, setEditingLesson] = useState<AcademyLesson | null>(null);
  const [showLessonForm, setShowLessonForm] = useState(false);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [savingCourse, setSavingCourse] = useState(false);
  const [savingLesson, setSavingLesson] = useState(false);
  const [lessonActionId, setLessonActionId] = useState<string | null>(null);

  const hasLessonWithoutVideo = useMemo(
    () => lessons.some((lesson) => !lesson.externalVideoUrl),
    [lessons],
  );

  const loadCourse = useCallback(async () => {
    setLoadState("loading");
    setErrorMessage("");

    try {
      const response = await fetch(`/api/academy/courses/${courseId}?mode=management`, {
        cache: "no-store",
      });
      const result = (await response.json()) as CourseDetailResponse;

      if (!response.ok || !result.course) {
        throw new Error(result.error || "Unable to load Academy course");
      }

      setCourse(result.course);
      setLessons(result.lessons ?? []);
      setCourseForm(toCourseForm(result.course));
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

  async function saveCourse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!courseForm) return;

    setSavingCourse(true);
    setErrorMessage("");
    setMessage("");

    try {
      const response = await fetch(`/api/academy/courses/${courseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: courseForm.title,
          description: courseForm.description,
          sortOrder: Number(courseForm.sortOrder || 0),
          coverImageUrl: courseForm.coverImageUrl,
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to save course");
      }

      setMessage("Course details saved.");
      await loadCourse();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to save course");
    } finally {
      setSavingCourse(false);
    }
  }

  async function updateCourseStatus(status: AcademyCourseStatus) {
    if (!course) return;

    if (status === "published") {
      if (lessons.length === 0) {
        setErrorMessage("Add at least one lesson before publishing.");
        return;
      }

      const warning = hasLessonWithoutVideo
        ? "\n\nOne or more lessons has no video URL yet."
        : "";
      const confirmed = window.confirm(
        `Publish this course?\n\nPublished courses will become visible to Falcon Academy learners.${warning}`,
      );
      if (!confirmed) return;
    }

    setSavingCourse(true);
    setErrorMessage("");
    setMessage("");

    try {
      const response = await fetch(`/api/academy/courses/${courseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to update course status");
      }

      setMessage(status === "draft" ? "Course unpublished." : `Course marked as ${statusLabels[status]}.`);
      await loadCourse();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update course status");
    } finally {
      setSavingCourse(false);
    }
  }

  function openAddLesson() {
    setEditingLesson(null);
    setLessonForm(emptyLessonForm);
    setShowLessonForm(true);
    setErrorMessage("");
    setMessage("");
  }

  function openEditLesson(lesson: AcademyLesson) {
    setEditingLesson(lesson);
    setLessonForm(toLessonForm(lesson));
    setShowLessonForm(true);
    setErrorMessage("");
    setMessage("");
  }

  async function saveLesson(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload = lessonPayload(
      lessonForm,
      editingLesson ? undefined : (lessons.length + 1) * 10,
    );
    if (!payload) {
      setErrorMessage("Duration must use valid minutes and 0-59 seconds.");
      return;
    }

    setSavingLesson(true);
    setErrorMessage("");
    setMessage("");

    try {
      const endpoint = editingLesson
        ? `/api/academy/lessons/${editingLesson.id}`
        : `/api/academy/courses/${courseId}/lessons`;
      const response = await fetch(endpoint, {
        method: editingLesson ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to save lesson");
      }

      setShowLessonForm(false);
      setEditingLesson(null);
      setLessonForm(emptyLessonForm);
      setMessage(editingLesson ? "Lesson saved." : "Lesson added.");
      await loadCourse();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to save lesson");
    } finally {
      setSavingLesson(false);
    }
  }

  async function deleteLesson(lesson: AcademyLesson) {
    const confirmed = window.confirm(`Delete "${lesson.title}" from this course?`);
    if (!confirmed) return;

    setLessonActionId(lesson.id);
    setErrorMessage("");
    setMessage("");

    try {
      const response = await fetch(`/api/academy/lessons/${lesson.id}`, {
        method: "DELETE",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to delete lesson");
      }

      setMessage("Lesson deleted.");
      await loadCourse();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to delete lesson");
    } finally {
      setLessonActionId(null);
    }
  }

  async function moveLesson(lessonId: string, direction: "up" | "down") {
    const currentIndex = lessons.findIndex((lesson) => lesson.id === lessonId);
    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= lessons.length) return;

    const reordered = [...lessons];
    const [movedLesson] = reordered.splice(currentIndex, 1);
    reordered.splice(targetIndex, 0, movedLesson);

    setLessonActionId(lessonId);
    setErrorMessage("");
    setMessage("");

    try {
      await Promise.all(
        reordered.map((lesson, index) =>
          fetch(`/api/academy/lessons/${lesson.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sortOrder: (index + 1) * 10 }),
          }).then(async (response) => {
            if (!response.ok) {
              const result = await response.json();
              throw new Error(result.error || "Unable to reorder lessons");
            }
          }),
        ),
      );

      setMessage("Lesson order saved.");
      await loadCourse();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to reorder lessons");
    } finally {
      setLessonActionId(null);
    }
  }

  if (loadState === "loading") {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="rounded-[24px] border border-zinc-200 bg-white p-6 text-sm text-zinc-500">
          Loading course...
        </div>
      </main>
    );
  }

  if (loadState === "error" || !course || !courseForm) {
    return (
      <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
        <section className="rounded-[24px] border border-red-200 bg-red-50 p-6">
          <h1 className="text-xl font-semibold text-red-900">Unable to load course</h1>
          <p className="mt-2 text-sm text-red-700">{errorMessage}</p>
          <Link
            href="/academy/manage"
            className="mt-5 inline-flex min-h-10 items-center rounded-full bg-white px-4 text-sm font-semibold text-red-800"
          >
            Back to Academy Management
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 pb-24 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link href="/academy/manage" className="text-sm font-semibold text-zinc-500 hover:text-zinc-950">
            Back to Academy Management
          </Link>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusStyles[course.status]}`}>
              {statusLabels[course.status]}
            </span>
            <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-semibold text-zinc-600">
              {lessons.length} {lessons.length === 1 ? "lesson" : "lessons"}
            </span>
          </div>
          <h1 className="mt-3 break-words text-3xl font-semibold tracking-tight text-zinc-950">
            {course.title}
          </h1>
          <p className="mt-2 text-sm text-zinc-500">Updated {formatDateTime(course.updatedAt)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {course.status === "published" ? (
            <button
              type="button"
              disabled={savingCourse}
              onClick={() => updateCourseStatus("draft")}
              className="min-h-11 rounded-full border border-zinc-300 px-5 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50 disabled:opacity-60"
            >
              Unpublish
            </button>
          ) : (
            <button
              type="button"
              disabled={savingCourse || course.status === "archived"}
              onClick={() => updateCourseStatus("published")}
              className="min-h-11 rounded-full border border-teal-200 px-5 text-sm font-semibold text-[#087F6B] transition hover:bg-teal-50 disabled:opacity-50"
            >
              Publish
            </button>
          )}
          {course.status !== "archived" ? (
            <button
              type="button"
              disabled={savingCourse}
              onClick={() => updateCourseStatus("archived")}
              className="min-h-11 rounded-full border border-amber-200 px-5 text-sm font-semibold text-amber-800 transition hover:bg-amber-50 disabled:opacity-60"
            >
              Archive
            </button>
          ) : null}
        </div>
      </div>

      {message ? (
        <div className="rounded-[20px] border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-800">
          {message}
        </div>
      ) : null}
      {errorMessage ? (
        <div className="rounded-[20px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <form
          onSubmit={saveCourse}
          className="rounded-[24px] border border-zinc-200 bg-white p-5 shadow-[0_10px_28px_rgba(15,23,42,0.04)] sm:p-6"
        >
          <h2 className="text-lg font-semibold text-zinc-950">Course Details</h2>
          <div className="mt-5 space-y-4">
            <label className="block">
              <span className="text-sm font-semibold text-zinc-800">Course Title *</span>
              <input
                value={courseForm.title}
                onChange={(event) =>
                  setCourseForm((current) => current && { ...current, title: event.target.value })
                }
                className="mt-2 min-h-11 w-full rounded-2xl border border-zinc-200 px-4 text-sm outline-none transition focus:border-zinc-900"
                required
                maxLength={160}
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-zinc-800">Description</span>
              <textarea
                value={courseForm.description}
                onChange={(event) =>
                  setCourseForm((current) => current && { ...current, description: event.target.value })
                }
                className="mt-2 min-h-28 w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm outline-none transition focus:border-zinc-900"
                maxLength={1200}
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-semibold text-zinc-800">Sort Order</span>
                <input
                  type="number"
                  min={0}
                  value={courseForm.sortOrder}
                  onChange={(event) =>
                    setCourseForm((current) => current && { ...current, sortOrder: event.target.value })
                  }
                  className="mt-2 min-h-11 w-full rounded-2xl border border-zinc-200 px-4 text-sm outline-none transition focus:border-zinc-900"
                />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-zinc-800">Cover Image URL</span>
                <input
                  type="url"
                  value={courseForm.coverImageUrl}
                  onChange={(event) =>
                    setCourseForm((current) => current && { ...current, coverImageUrl: event.target.value })
                  }
                  className="mt-2 min-h-11 w-full rounded-2xl border border-zinc-200 px-4 text-sm outline-none transition focus:border-zinc-900"
                  placeholder="https://"
                />
              </label>
            </div>
          </div>
          <div className="mt-5 flex justify-end">
            <button
              type="submit"
              disabled={savingCourse}
              className="min-h-11 rounded-full bg-zinc-950 px-5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingCourse ? "Saving..." : "Save Course"}
            </button>
          </div>
        </form>

        <aside className="rounded-[24px] border border-zinc-200 bg-zinc-50 p-5">
          <h2 className="text-lg font-semibold text-zinc-950">Publishing</h2>
          <p className="mt-3 text-sm leading-6 text-zinc-600">
            Publish only when the course is ready for learners. A course needs at least one active lesson.
          </p>
          {hasLessonWithoutVideo ? (
            <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              One or more lessons has no video URL.
            </p>
          ) : null}
        </aside>
      </section>

      <section className="rounded-[24px] border border-zinc-200 bg-white p-5 shadow-[0_10px_28px_rgba(15,23,42,0.04)] sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-950">Lessons</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Keep lessons ordered with simple Move Up and Move Down controls.
            </p>
          </div>
          <button
            type="button"
            onClick={openAddLesson}
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-zinc-950 px-5 text-sm font-semibold text-white transition hover:bg-zinc-800"
          >
            Add Lesson
          </button>
        </div>

        <div className="mt-5 space-y-3">
          {lessons.length === 0 ? (
            <div className="rounded-[20px] border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500">
              No lessons yet.
            </div>
          ) : null}

          {lessons.map((lesson, index) => (
            <article
              key={lesson.id}
              className="rounded-[20px] border border-zinc-200 bg-zinc-50 p-4"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                    Lesson {index + 1}
                  </p>
                  <h3 className="mt-2 break-words text-base font-semibold text-zinc-950">
                    {lesson.title}
                  </h3>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-zinc-600">
                    <span className="rounded-full border border-zinc-200 bg-white px-3 py-1">
                      {videoSourceOptions.find((option) => option.value === lesson.videoSourceType)?.label}
                    </span>
                    <span className="rounded-full border border-zinc-200 bg-white px-3 py-1">
                      {formatDuration(lesson.durationSeconds)}
                    </span>
                  </div>
                  {lesson.description ? (
                    <p className="mt-3 text-sm leading-6 text-zinc-600">{lesson.description}</p>
                  ) : null}
                  {lesson.externalVideoUrl ? (
                    <a
                      href={lesson.externalVideoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex text-sm font-semibold text-[#087F6B] hover:text-teal-900"
                    >
                      Open Video
                    </a>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2 lg:justify-end">
                  <button
                    type="button"
                    disabled={index === 0 || lessonActionId === lesson.id}
                    onClick={() => moveLesson(lesson.id, "up")}
                    className="min-h-10 rounded-full border border-zinc-300 px-4 text-sm font-semibold text-zinc-800 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Move Up
                  </button>
                  <button
                    type="button"
                    disabled={index === lessons.length - 1 || lessonActionId === lesson.id}
                    onClick={() => moveLesson(lesson.id, "down")}
                    className="min-h-10 rounded-full border border-zinc-300 px-4 text-sm font-semibold text-zinc-800 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Move Down
                  </button>
                  <button
                    type="button"
                    onClick={() => openEditLesson(lesson)}
                    className="min-h-10 rounded-full bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={lessonActionId === lesson.id}
                    onClick={() => deleteLesson(lesson)}
                    className="min-h-10 rounded-full border border-zinc-200 px-4 text-sm font-semibold text-zinc-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:opacity-60"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {showLessonForm ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/40 px-4 py-6 sm:items-center">
          <form
            onSubmit={saveLesson}
            className="flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl"
          >
            <div className="border-b border-zinc-100 px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#087F6B]">
                    Academy Lesson
                  </p>
                  <h2 className="mt-1 text-xl font-semibold text-zinc-950">
                    {editingLesson ? "Edit Lesson" : "Add Lesson"}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowLessonForm(false)}
                  disabled={savingLesson}
                  className="rounded-full border border-zinc-200 px-3 py-1.5 text-sm font-semibold text-zinc-600 transition hover:bg-zinc-50"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="space-y-4 overflow-y-auto px-5 py-4">
              <label className="block">
                <span className="text-sm font-semibold text-zinc-800">Lesson Title *</span>
                <input
                  value={lessonForm.title}
                  onChange={(event) =>
                    setLessonForm((current) => ({ ...current, title: event.target.value }))
                  }
                  className="mt-2 min-h-11 w-full rounded-2xl border border-zinc-200 px-4 text-sm outline-none transition focus:border-zinc-900"
                  required
                  maxLength={160}
                />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-zinc-800">Description</span>
                <textarea
                  value={lessonForm.description}
                  onChange={(event) =>
                    setLessonForm((current) => ({ ...current, description: event.target.value }))
                  }
                  className="mt-2 min-h-24 w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm outline-none transition focus:border-zinc-900"
                  maxLength={1200}
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-semibold text-zinc-800">Video Source</span>
                  <select
                    value={lessonForm.videoSourceType}
                    onChange={(event) =>
                      setLessonForm((current) => ({
                        ...current,
                        videoSourceType: event.target.value as AcademyVideoSourceType,
                      }))
                    }
                    className="mt-2 min-h-11 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-sm outline-none transition focus:border-zinc-900"
                  >
                    {videoSourceOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-zinc-800">Video URL</span>
                  <input
                    type="url"
                    value={lessonForm.externalVideoUrl}
                    onChange={(event) =>
                      setLessonForm((current) => ({ ...current, externalVideoUrl: event.target.value }))
                    }
                    className="mt-2 min-h-11 w-full rounded-2xl border border-zinc-200 px-4 text-sm outline-none transition focus:border-zinc-900"
                    placeholder="https://"
                  />
                </label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-semibold text-zinc-800">Duration Minutes</span>
                  <input
                    type="number"
                    min={0}
                    value={lessonForm.durationMinutes}
                    onChange={(event) =>
                      setLessonForm((current) => ({ ...current, durationMinutes: event.target.value }))
                    }
                    className="mt-2 min-h-11 w-full rounded-2xl border border-zinc-200 px-4 text-sm outline-none transition focus:border-zinc-900"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-zinc-800">Duration Seconds</span>
                  <input
                    type="number"
                    min={0}
                    max={59}
                    value={lessonForm.durationSeconds}
                    onChange={(event) =>
                      setLessonForm((current) => ({ ...current, durationSeconds: event.target.value }))
                    }
                    className="mt-2 min-h-11 w-full rounded-2xl border border-zinc-200 px-4 text-sm outline-none transition focus:border-zinc-900"
                  />
                </label>
              </div>
            </div>

            <div className="flex flex-col gap-2 border-t border-zinc-100 px-5 py-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setShowLessonForm(false)}
                disabled={savingLesson}
                className="min-h-11 rounded-full border border-zinc-300 px-5 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingLesson}
                className="min-h-11 rounded-full bg-zinc-950 px-5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingLesson ? "Saving..." : editingLesson ? "Save Lesson" : "Add Lesson"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </main>
  );
}
