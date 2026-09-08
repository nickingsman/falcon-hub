"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  Button,
  EmptyState,
  SectionHeader,
  StatusBadge,
  buttonClassName,
} from "@/app/(app)/components/ui";

type SavedWorkType = "roi" | "project_comparison" | "progressive_interest";
type LoadStatus = "loading" | "ready" | "error";
type WorkTypeFilter = "all" | SavedWorkType;

type SavedWorkItem = {
  id: string;
  title: string;
  workType: SavedWorkType;
  schemaVersion: number;
  createdAt: string;
  updatedAt: string;
};

type SavedWorkListResponse = {
  savedWork?: SavedWorkItem[];
  error?: string;
};

const workTypeLabels: Record<SavedWorkType, string> = {
  roi: "Unit Calculation",
  project_comparison: "Project Comparison",
  progressive_interest: "Progressive Interest",
};

const workTypeDescriptions: Record<SavedWorkType, string> = {
  roi: "Reopen saved Unit Calculation work and proposals.",
  project_comparison: "Reopen saved project comparisons and proposals.",
  progressive_interest: "Reopen saved Progressive Interest calculations and proposals.",
};

const filterOptions: Array<{ label: string; value: WorkTypeFilter }> = [
  { label: "All", value: "all" },
  { label: "Unit Calculation", value: "roi" },
  { label: "Project Comparison", value: "project_comparison" },
  { label: "Progressive Interest", value: "progressive_interest" },
];

function getOpenHref(item: SavedWorkItem) {
  if (item.workType === "roi") {
    return `/tools/roi-calculator?savedWork=${encodeURIComponent(item.id)}`;
  }

  if (item.workType === "project_comparison") {
    return `/tools/project-comparison?savedWork=${encodeURIComponent(item.id)}`;
  }

  if (item.workType === "progressive_interest") {
    return `/tools/progressive-interest?savedWork=${encodeURIComponent(item.id)}`;
  }

  return null;
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kuala_Lumpur",
  }).format(date);
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kuala_Lumpur",
  }).format(date);
}

function SavedWorkModal({
  title,
  description,
  children,
  footer,
  onClose,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  footer: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/40 px-4 py-6 sm:items-center">
      <div className="flex max-h-[90dvh] w-full max-w-md flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl">
        <div className="sticky top-0 border-b border-zinc-100 bg-white px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <SectionHeader title={title} description={description} />
            </div>
            <Button
              type="button"
              onClick={onClose}
              variant="ghost"
              className="min-h-9 px-3 py-1.5"
            >
              Close
            </Button>
          </div>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        <div className="border-t border-zinc-100 bg-white px-5 py-4">{footer}</div>
      </div>
    </div>
  );
}

function SavedWorkCard({
  item,
  onRename,
  onDelete,
}: {
  item: SavedWorkItem;
  onRename: (item: SavedWorkItem) => void;
  onDelete: (item: SavedWorkItem) => void;
}) {
  const openHref = getOpenHref(item);

  return (
    <article className="group overflow-hidden rounded-[26px] border border-[var(--falcon-soft-border)] bg-white shadow-[0_14px_34px_rgba(23,23,23,0.05)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(23,23,23,0.07)]">
      <div className="h-2 bg-[linear-gradient(90deg,var(--falcon-gold),rgba(184,146,74,0.18))]" />
      <div className="p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="break-words text-lg font-semibold leading-snug text-zinc-950">
            {item.title}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <StatusBadge>{workTypeLabels[item.workType]}</StatusBadge>
            {!openHref ? (
              <StatusBadge variant="warning">Coming soon</StatusBadge>
            ) : null}
          </div>
          <p className="mt-3 text-sm text-[var(--falcon-muted-text)]">
            Last updated {formatDateTime(item.updatedAt)}
          </p>
          <p className="mt-1 text-xs text-zinc-400">Created {formatDate(item.createdAt)}</p>
          <p className="mt-3 text-sm leading-6 text-[var(--falcon-muted-text)]">
            {workTypeDescriptions[item.workType]}
          </p>
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:min-w-32">
          {openHref ? (
            <Link
              href={openHref}
              className={buttonClassName({ className: "min-h-10 px-4" })}
            >
              Open
            </Link>
          ) : (
            <Button
              type="button"
              disabled
              className="min-h-10 px-4"
            >
              Open
            </Button>
          )}
          <Button
            type="button"
            onClick={() => onRename(item)}
            variant="secondary"
            className="min-h-10 px-4"
          >
            Rename
          </Button>
          <Button
            type="button"
            onClick={() => onDelete(item)}
            variant="ghost"
            className="min-h-10 px-4 text-zinc-600 hover:bg-red-50 hover:text-red-700 focus:ring-red-700"
          >
            Delete
          </Button>
        </div>
      </div>
      </div>
    </article>
  );
}

export default function SavedWorkPage() {
  const [savedWork, setSavedWork] = useState<SavedWorkItem[]>([]);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [filter, setFilter] = useState<WorkTypeFilter>("all");
  const [search, setSearch] = useState("");
  const [renamingItem, setRenamingItem] = useState<SavedWorkItem | null>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [renameError, setRenameError] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);
  const [deletingItem, setDeletingItem] = useState<SavedWorkItem | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const loadSavedWork = useCallback(async () => {
    setStatus("loading");
    setErrorMessage("");

    try {
      const response = await fetch("/api/saved-work", {
        cache: "no-store",
      });
      const payload = (await response.json()) as SavedWorkListResponse;

      if (!response.ok) {
        throw new Error(payload.error || "Unable to load Saved Work");
      }

      setSavedWork(payload.savedWork ?? []);
      setStatus("ready");
    } catch (error) {
      setStatus("error");
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load Saved Work. Please try again.",
      );
    }
  }, []);

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      void loadSavedWork();
    }, 0);

    return () => window.clearTimeout(loadTimer);
  }, [loadSavedWork]);

  const filteredSavedWork = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return savedWork.filter((item) => {
      const matchesType = filter === "all" || item.workType === filter;
      const matchesSearch =
        !normalizedSearch || item.title.toLowerCase().includes(normalizedSearch);

      return matchesType && matchesSearch;
    });
  }, [filter, savedWork, search]);

  function openRename(item: SavedWorkItem) {
    setRenamingItem(item);
    setRenameTitle(item.title);
    setRenameError("");
  }

  function openDelete(item: SavedWorkItem) {
    setDeletingItem(item);
    setDeleteError("");
  }

  async function renameSavedWork() {
    if (!renamingItem) return;

    const title = renameTitle.trim();

    if (!title) {
      setRenameError("Title is required.");
      return;
    }

    if (title.length > 120) {
      setRenameError("Title must be 120 characters or fewer.");
      return;
    }

    setIsRenaming(true);
    setRenameError("");

    try {
      const response = await fetch(`/api/saved-work/${renamingItem.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title }),
      });
      const payload = (await response.json()) as {
        savedWork?: SavedWorkItem;
        error?: string;
      };

      if (!response.ok || !payload.savedWork) {
        throw new Error(payload.error || "Unable to rename Saved Work");
      }

      setSavedWork((current) =>
        current.map((item) =>
          item.id === renamingItem.id
            ? {
                ...item,
                title: payload.savedWork?.title ?? title,
                updatedAt: payload.savedWork?.updatedAt ?? item.updatedAt,
              }
            : item,
        ),
      );
      setRenamingItem(null);
      setRenameTitle("");
    } catch (error) {
      setRenameError(error instanceof Error ? error.message : "Rename failed");
    } finally {
      setIsRenaming(false);
    }
  }

  async function deleteSavedWork() {
    if (!deletingItem) return;

    setIsDeleting(true);
    setDeleteError("");

    try {
      const response = await fetch(`/api/saved-work/${deletingItem.id}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error || "Unable to delete Saved Work");
      }

      setSavedWork((current) => current.filter((item) => item.id !== deletingItem.id));
      setDeletingItem(null);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Delete failed");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <main className="relative overflow-hidden bg-[var(--falcon-warm-background)] p-4 sm:p-6 lg:p-8">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top_right,rgba(184,146,74,0.14),transparent_38%)]"
        aria-hidden
      />
      <div className="relative mx-auto max-w-6xl space-y-6">
        <section className="relative min-h-[188px] overflow-hidden rounded-[30px] bg-[linear-gradient(135deg,#fbf8f2_0%,#f7f1e7_55%,#eee3d3_100%)] px-5 py-7 sm:px-7 sm:py-8 lg:h-[300px] lg:px-0 lg:py-0">
          <Image
            src="/brand/falcon-team-signature-transparent-v2.png"
            alt=""
            width={1920}
            height={1080}
            priority
            className="pointer-events-none absolute bottom-0 right-0 z-10 hidden h-auto w-[68%] max-w-[900px] select-none object-contain object-bottom-right lg:block xl:w-[70%]"
            aria-hidden
          />
          <div className="relative z-20 flex w-full max-w-[470px] flex-col lg:h-full lg:w-[46%] lg:justify-center lg:px-8">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--falcon-gold-dark)]">
              My Library
            </p>
            <h1 className="mt-2 whitespace-nowrap text-[34px] font-semibold leading-none tracking-tight text-[var(--falcon-charcoal)] xl:text-[38px]">
              Saved Work
            </h1>
            <p className="mt-2 text-sm leading-6 text-[var(--falcon-muted-text)]">
              Your saved calculators and project work. Pick up where you left off.
            </p>
            <div className="mt-3">
              <StatusBadge variant="accent" className="px-4 py-2 text-sm">
                {savedWork.length} saved item{savedWork.length === 1 ? "" : "s"}
              </StatusBadge>
            </div>
          </div>
        </section>

        <section className="rounded-[26px] border border-[var(--falcon-soft-border)] bg-white/78 p-4 shadow-[0_10px_28px_rgba(23,23,23,0.035)] backdrop-blur">
          <div className="grid gap-3 lg:grid-cols-[1fr_280px] lg:items-center">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {filterOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFilter(option.value)}
                  className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 ${
                    filter === option.value
                      ? "border-zinc-950 bg-zinc-950 text-white shadow-[inset_0_-3px_0_var(--falcon-gold)]"
                      : "border-[var(--falcon-soft-border)] bg-white text-zinc-700 hover:bg-[var(--falcon-warm-background)]"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <label className="block text-sm text-zinc-600">
              <span className="sr-only">Search Saved Work</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-full rounded-2xl border border-[var(--falcon-soft-border)] bg-[var(--falcon-warm-background)] px-4 py-2.5 outline-none focus:border-[var(--falcon-gold-dark)] focus:bg-white"
                placeholder="Search by title"
              />
            </label>
          </div>
        </section>

        {status === "loading" ? (
          <section className="grid gap-3">
            {[0, 1, 2].map((item) => (
              <div
                key={item}
                className="h-36 rounded-[24px] border border-[var(--falcon-soft-border)] bg-white"
              />
            ))}
          </section>
        ) : null}

        {status === "error" ? (
          <EmptyState
            title="Saved Work unavailable"
            description={errorMessage}
            action={
              <Button
                type="button"
                onClick={() => void loadSavedWork()}
                className="px-5"
              >
                Retry
              </Button>
            }
          />
        ) : null}

        {status === "ready" && savedWork.length === 0 ? (
          <EmptyState
            title="No saved work yet."
            description="Save your work from a Falcon Hub calculator and it will appear here."
            variant="dashed"
          />
        ) : null}

        {status === "ready" && savedWork.length > 0 && filteredSavedWork.length === 0 ? (
          <EmptyState
            title="No saved work matches this view."
            description="Try another filter or search term."
          />
        ) : null}

        {status === "ready" && filteredSavedWork.length > 0 ? (
          <section className="grid gap-4 md:grid-cols-2">
            {filteredSavedWork.map((item) => (
              <SavedWorkCard
                key={item.id}
                item={item}
                onRename={openRename}
                onDelete={openDelete}
              />
            ))}
          </section>
        ) : null}
      </div>

      {renamingItem ? (
        <SavedWorkModal
          title="Rename Saved Work"
          description="Update the title shown in your private Saved Work library."
          onClose={() => {
            if (isRenaming) return;
            setRenamingItem(null);
          }}
          footer={
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button
                type="button"
                onClick={() => setRenamingItem(null)}
                disabled={isRenaming}
                variant="secondary"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => void renameSavedWork()}
                disabled={isRenaming || !renameTitle.trim()}
              >
                {isRenaming ? "Renaming..." : "Rename"}
              </Button>
            </div>
          }
        >
          <label className="block text-sm text-zinc-600">
            <span className="mb-1 block font-medium text-zinc-900">Title</span>
            <input
              value={renameTitle}
              onChange={(event) => {
                setRenameTitle(event.target.value);
                setRenameError("");
              }}
              disabled={isRenaming}
              maxLength={120}
              className="w-full rounded-2xl border border-[var(--falcon-soft-border)] bg-[var(--falcon-warm-background)] px-3 py-2 outline-none focus:border-[var(--falcon-gold-dark)] focus:bg-white"
            />
          </label>
          {renameError ? (
            <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {renameError}
            </p>
          ) : null}
        </SavedWorkModal>
      ) : null}

      {deletingItem ? (
        <SavedWorkModal
          title="Delete Saved Work"
          description="This removes the item from your Saved Work library."
          onClose={() => {
            if (isDeleting) return;
            setDeletingItem(null);
          }}
          footer={
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button
                type="button"
                onClick={() => setDeletingItem(null)}
                disabled={isDeleting}
                variant="secondary"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => void deleteSavedWork()}
                disabled={isDeleting}
                variant="destructive"
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </Button>
            </div>
          }
        >
          <div className="rounded-2xl border border-[var(--falcon-soft-border)] bg-[var(--falcon-warm-background)] px-4 py-3">
            <p className="text-sm text-zinc-500">Saved Work</p>
            <p className="mt-1 break-words text-base font-semibold text-zinc-950">
              {deletingItem.title}
            </p>
          </div>
          {deleteError ? (
            <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {deleteError}
            </p>
          ) : null}
        </SavedWorkModal>
      ) : null}
    </main>
  );
}
