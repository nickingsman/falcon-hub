"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type AcademyCourseStatus = "draft" | "published" | "archived";
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

type CourseForm = {
  title: string;
  description: string;
  sortOrder: string;
  coverImageUrl: string;
};

const emptyCourseForm: CourseForm = {
  title: "",
  description: "",
  sortOrder: "0",
  coverImageUrl: "",
};

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

function coursePayload(form: CourseForm) {
  return {
    title: form.title,
    description: form.description,
    sortOrder: Number(form.sortOrder || 0),
    coverImageUrl: form.coverImageUrl,
    status: "draft",
  };
}

export default function AcademyManageClient() {
  const router = useRouter();
  const [courses, setCourses] = useState<AcademyCourse[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CourseForm>(emptyCourseForm);
  const [saving, setSaving] = useState(false);
  const [actionCourseId, setActionCourseId] = useState<string | null>(null);

  const courseSummary = useMemo(() => {
    return courses.reduce(
      (summary, course) => ({
        total: summary.total + 1,
        published: summary.published + (course.status === "published" ? 1 : 0),
        draft: summary.draft + (course.status === "draft" ? 1 : 0),
      }),
      { total: 0, published: 0, draft: 0 },
    );
  }, [courses]);

  const loadCourses = useCallback(async () => {
    setLoadState("loading");
    setErrorMessage("");

    try {
      const response = await fetch("/api/academy/courses?mode=management", {
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

  async function handleCreateCourse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/academy/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(coursePayload(form)),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to create course");
      }

      router.push(`/academy/manage/${result.course.id}`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to create course");
    } finally {
      setSaving(false);
    }
  }

  async function updateCourseStatus(course: AcademyCourse, status: AcademyCourseStatus) {
    if (status === "published") {
      const confirmed = window.confirm(
        "Publish this course?\n\nPublished courses will become visible to Falcon Academy learners.",
      );
      if (!confirmed) return;
    }

    setActionCourseId(course.id);
    setErrorMessage("");

    try {
      const response = await fetch(`/api/academy/courses/${course.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to update course");
      }

      await loadCourses();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update course");
    } finally {
      setActionCourseId(null);
    }
  }

  async function deleteCourse(course: AcademyCourse) {
    const confirmed = window.confirm(
      `Delete course "${course.title}"?\n\nThis will remove the course and its lessons from management and learner views. Existing lesson progress is retained in the database.`,
    );
    if (!confirmed) return;

    setActionCourseId(course.id);
    setErrorMessage("");

    try {
      const response = await fetch(`/api/academy/courses/${course.id}`, {
        method: "DELETE",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to delete course");
      }

      await loadCourses();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to delete course");
    } finally {
      setActionCourseId(null);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#087F6B]">
            Falcon Academy
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">
            Course Management
          </h1>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Create, organize and publish internal Academy courses.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setForm(emptyCourseForm);
            setShowCreate(true);
            setErrorMessage("");
          }}
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-zinc-950 px-5 text-sm font-semibold text-white transition hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2"
        >
          Create Course
        </button>
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-[20px] border border-zinc-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
            Courses
          </p>
          <p className="mt-2 text-2xl font-semibold text-zinc-950">{courseSummary.total}</p>
        </div>
        <div className="rounded-[20px] border border-zinc-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
            Published
          </p>
          <p className="mt-2 text-2xl font-semibold text-[#087F6B]">{courseSummary.published}</p>
        </div>
        <div className="rounded-[20px] border border-zinc-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
            Drafts
          </p>
          <p className="mt-2 text-2xl font-semibold text-zinc-950">{courseSummary.draft}</p>
        </div>
      </section>

      {errorMessage ? (
        <div className="rounded-[20px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <section className="space-y-3">
        {loadState === "loading" ? (
          <div className="rounded-[24px] border border-zinc-200 bg-white p-6 text-sm text-zinc-500">
            Loading Academy courses...
          </div>
        ) : null}

        {loadState === "ready" && courses.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-zinc-300 bg-white p-8 text-center">
            <h2 className="text-lg font-semibold text-zinc-950">No courses yet</h2>
            <p className="mt-2 text-sm text-zinc-500">
              Create the first draft course to start building Falcon Academy.
            </p>
          </div>
        ) : null}

        {courses.map((course) => (
          <article
            key={course.id}
            className="rounded-[24px] border border-zinc-200 bg-white p-5 shadow-[0_10px_28px_rgba(15,23,42,0.04)]"
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusStyles[course.status]}`}
                  >
                    {statusLabels[course.status]}
                  </span>
                  <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-semibold text-zinc-600">
                    {course.lessonCount} {course.lessonCount === 1 ? "lesson" : "lessons"}
                  </span>
                </div>
                <h2 className="mt-3 break-words text-xl font-semibold text-zinc-950">
                  {course.title}
                </h2>
                {course.description ? (
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-zinc-600">
                    {course.description}
                  </p>
                ) : null}
                <p className="mt-3 text-xs text-zinc-400">
                  Updated {formatDateTime(course.updatedAt)}
                </p>
              </div>

              <div className="flex flex-wrap gap-2 lg:justify-end">
                <Link
                  href={`/academy/manage/${course.id}`}
                  className="inline-flex min-h-10 items-center justify-center rounded-full bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800"
                >
                  Edit
                </Link>
                {course.status === "published" ? (
                  <button
                    type="button"
                    disabled={actionCourseId === course.id}
                    onClick={() => updateCourseStatus(course, "draft")}
                    className="min-h-10 rounded-full border border-zinc-300 px-4 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Unpublish
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={actionCourseId === course.id || course.status === "archived"}
                    onClick={() => updateCourseStatus(course, "published")}
                    className="min-h-10 rounded-full border border-teal-200 px-4 text-sm font-semibold text-[#087F6B] transition hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Publish
                  </button>
                )}
                {course.status !== "archived" ? (
                  <button
                    type="button"
                    disabled={actionCourseId === course.id}
                    onClick={() => updateCourseStatus(course, "archived")}
                    className="min-h-10 rounded-full border border-amber-200 px-4 text-sm font-semibold text-amber-800 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Archive
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={actionCourseId === course.id}
                  onClick={() => deleteCourse(course)}
                  className="min-h-10 rounded-full border border-zinc-200 px-4 text-sm font-semibold text-zinc-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Delete
                </button>
              </div>
            </div>
          </article>
        ))}
      </section>

      {showCreate ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/40 px-4 py-6 sm:items-center">
          <form
            onSubmit={handleCreateCourse}
            className="flex max-h-[90dvh] w-full max-w-xl flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl"
          >
            <div className="border-b border-zinc-100 px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#087F6B]">
                    New Draft
                  </p>
                  <h2 className="mt-1 text-xl font-semibold text-zinc-950">Create Course</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  disabled={saving}
                  className="rounded-full border border-zinc-200 px-3 py-1.5 text-sm font-semibold text-zinc-600 transition hover:bg-zinc-50"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="space-y-4 overflow-y-auto px-5 py-4">
              <label className="block">
                <span className="text-sm font-semibold text-zinc-800">Course Title *</span>
                <input
                  value={form.title}
                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                  className="mt-2 min-h-11 w-full rounded-2xl border border-zinc-200 px-4 text-sm outline-none transition focus:border-zinc-900"
                  required
                  maxLength={160}
                />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-zinc-800">Description</span>
                <textarea
                  value={form.description}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, description: event.target.value }))
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
                    value={form.sortOrder}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, sortOrder: event.target.value }))
                    }
                    className="mt-2 min-h-11 w-full rounded-2xl border border-zinc-200 px-4 text-sm outline-none transition focus:border-zinc-900"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-zinc-800">Cover Image URL</span>
                  <input
                    type="url"
                    value={form.coverImageUrl}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, coverImageUrl: event.target.value }))
                    }
                    className="mt-2 min-h-11 w-full rounded-2xl border border-zinc-200 px-4 text-sm outline-none transition focus:border-zinc-900"
                    placeholder="https://"
                  />
                </label>
              </div>
            </div>
            <div className="flex flex-col gap-2 border-t border-zinc-100 px-5 py-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                disabled={saving}
                className="min-h-11 rounded-full border border-zinc-300 px-5 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="min-h-11 rounded-full bg-zinc-950 px-5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Creating..." : "Create Draft Course"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </main>
  );
}
