"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  dsiActivityFields,
  type DsiActivityCounts,
  type DsiActivityField,
} from "@/lib/dsi";
import {
  getMalaysiaTodayDateString,
  getMalaysiaYesterdayDateString,
} from "@/lib/malaysia-date";

type DsiDay = "today" | "yesterday";
type DsiStatus = "loading" | "not_submitted" | "submitted" | "error";

type DsiApiEntry = {
  activityDate: string;
  activities: DsiActivityCounts;
  submittedAt: string;
  updatedAt: string;
};

type DsiApiResponse = {
  status: "not_submitted" | "submitted";
  activityDate: string;
  entry: DsiApiEntry | null;
};

const activityLabels: Record<
  DsiActivityField,
  { label: string; helper?: string }
> = {
  answered_calls: { label: "Answered Calls" },
  new_leads_contact: { label: "New Leads Contact" },
  blasting: { label: "Blasting" },
  follow_up: { label: "Follow Up" },
  appointment_made: { label: "Appointment Made" },
  turn_up_appt: { label: "Turn Up Appt" },
  presented: { label: "Presented" },
  unit_closed: { label: "Unit Closed" },
  unit_sold: { label: "Unit Sold" },
  unit_converted: { label: "Unit Converted" },
  social_media_posting: {
    label: "Social Media Posting",
    helper: "XHS · Instagram · TikTok · YouTube",
  },
  recruitment: { label: "Recruitment" },
  sign_up: { label: "Sign Up" },
};

const activityGroups: Array<{
  title: string;
  fields: DsiActivityField[];
}> = [
  {
    title: "Prospecting",
    fields: ["answered_calls", "new_leads_contact", "blasting", "follow_up"],
  },
  {
    title: "Appointment",
    fields: ["appointment_made", "turn_up_appt"],
  },
  {
    title: "Sales",
    fields: ["presented", "unit_closed", "unit_sold", "unit_converted"],
  },
  {
    title: "Growth",
    fields: ["social_media_posting", "recruitment", "sign_up"],
  },
];

function createZeroCounts(): DsiActivityCounts {
  return Object.fromEntries(dsiActivityFields.map((field) => [field, 0])) as DsiActivityCounts;
}

function getEndpoint(day: DsiDay) {
  if (day === "today") return "/api/dsi/today";

  return `/api/dsi/${getMalaysiaYesterdayDateString()}`;
}

function getActivityDate(day: DsiDay) {
  return day === "today"
    ? getMalaysiaTodayDateString()
    : getMalaysiaYesterdayDateString();
}

function formatHeaderDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);

  return new Intl.DateTimeFormat("en-MY", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function formatMalaysiaTime(value: string | null) {
  if (!value) return null;

  return new Intl.DateTimeFormat("en-MY", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kuala_Lumpur",
  }).format(new Date(value));
}

function areCountsEqual(left: DsiActivityCounts, right: DsiActivityCounts) {
  return dsiActivityFields.every((field) => left[field] === right[field]);
}

function parseCountInput(value: string) {
  if (!value.trim()) return 0;

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 0) return null;

  return parsed;
}

export default function DsiPage() {
  const [selectedDay, setSelectedDay] = useState<DsiDay>("today");
  const [status, setStatus] = useState<DsiStatus>("loading");
  const [counts, setCounts] = useState<DsiActivityCounts>(() => createZeroCounts());
  const [lastSavedCounts, setLastSavedCounts] = useState<DsiActivityCounts>(() =>
    createZeroCounts(),
  );
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const requestIdRef = useRef(0);

  const activityDate = useMemo(() => getActivityDate(selectedDay), [selectedDay]);
  const isSubmitted = status === "submitted";
  const hasChanges = !areCountsEqual(counts, lastSavedCounts);
  const canSave =
    !isSaving &&
    status !== "loading" &&
    status !== "error" &&
    (!isSubmitted || hasChanges);
  const saveLabel = `${isSubmitted ? "Update" : "Save"} ${
    selectedDay === "today" ? "Today's" : "Yesterday's"
  } DSI`;
  const updatedTime = formatMalaysiaTime(updatedAt);

  const loadDsi = useCallback(async (day: DsiDay) => {
    const currentRequestId = requestIdRef.current + 1;
    requestIdRef.current = currentRequestId;

    const zeroCounts = createZeroCounts();
    setStatus("loading");
    setCounts(zeroCounts);
    setLastSavedCounts(zeroCounts);
    setUpdatedAt(null);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response = await fetch(getEndpoint(day), { cache: "no-store" });
      const result = (await response.json()) as DsiApiResponse & { error?: string };

      if (requestIdRef.current !== currentRequestId) return;

      if (!response.ok) {
        throw new Error(result.error || "Unable to load DSI");
      }

      if (result.status === "submitted" && result.entry) {
        setCounts(result.entry.activities);
        setLastSavedCounts(result.entry.activities);
        setUpdatedAt(result.entry.updatedAt);
        setStatus("submitted");
        return;
      }

      setCounts(zeroCounts);
      setLastSavedCounts(zeroCounts);
      setUpdatedAt(null);
      setStatus("not_submitted");
    } catch (error) {
      if (requestIdRef.current !== currentRequestId) return;

      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Unable to load DSI");
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadDsi(selectedDay);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadDsi, selectedDay]);

  function updateCount(field: DsiActivityField, nextValue: number) {
    setSuccessMessage("");
    setCounts((current) => ({
      ...current,
      [field]: Math.max(0, nextValue),
    }));
  }

  function handleInputChange(field: DsiActivityField, value: string) {
    const parsed = parseCountInput(value);

    if (parsed === null) return;

    updateCount(field, parsed);
  }

  async function handleSave() {
    if (!canSave) return;

    setIsSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response = await fetch(getEndpoint(selectedDay), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(counts),
      });
      const result = (await response.json()) as DsiApiResponse & { error?: string };

      if (!response.ok) {
        throw new Error(result.error || "Unable to save DSI");
      }

      if (result.entry) {
        setCounts(result.entry.activities);
        setLastSavedCounts(result.entry.activities);
        setUpdatedAt(result.entry.updatedAt);
      } else {
        setLastSavedCounts(counts);
      }

      setStatus("submitted");
      setSuccessMessage("DSI saved.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to save DSI");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
      <section className="rounded-[28px] border border-zinc-200 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.04)] sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.22em] text-zinc-500">
              Daily Sales Index
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl">
              {formatHeaderDate(activityDate)}
            </h1>
            <p className="mt-2 text-sm text-zinc-600">
              Keep your daily sales activity updated.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              <span
                className={`font-semibold ${
                  isSubmitted
                    ? "text-emerald-800"
                    : status === "loading"
                      ? "text-zinc-600"
                      : "text-zinc-700"
                }`}
              >
                {isSubmitted ? "● Submitted" : status === "loading" ? "● Loading..." : "○ Not Submitted"}
              </span>
              {isSubmitted && updatedTime ? (
                <span className="text-zinc-400">·</span>
              ) : null}
              {isSubmitted && updatedTime ? (
                <span className="text-zinc-500">Updated {updatedTime}</span>
              ) : null}
              {hasChanges && status !== "loading" ? (
                <>
                  <span className="text-zinc-400">·</span>
                  <span className="font-medium text-[#9A6B1F]">Unsaved changes</span>
                </>
              ) : null}
            </div>
          </div>

          <div className="inline-flex rounded-full border border-zinc-200 bg-zinc-50 p-1">
            {(["today", "yesterday"] as const).map((day) => (
              <button
                key={day}
                type="button"
                onClick={() => setSelectedDay(day)}
                disabled={isSaving}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  selectedDay === day
                    ? "bg-zinc-900 text-white shadow-sm"
                    : "text-zinc-600 hover:bg-white hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
                }`}
              >
                {day === "today" ? "Today" : "Yesterday"}
              </button>
            ))}
          </div>
        </div>

        {errorMessage ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        ) : null}

        {successMessage ? (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {successMessage}
          </div>
        ) : null}
      </section>

      <section className="mt-4 space-y-3 pb-32 sm:pb-0">
        {activityGroups.map((group) => (
          <div
            key={group.title}
            className="rounded-[24px] border border-zinc-200 bg-white p-3.5 shadow-[0_10px_30px_rgba(15,23,42,0.04)] sm:p-5"
          >
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">
              {group.title}
            </h2>
            <div className="mt-2.5 divide-y divide-zinc-100">
              {group.fields.map((field) => {
                const label = activityLabels[field];

                return (
                  <div
                    key={field}
                    className="flex items-center justify-between gap-3 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <label
                        htmlFor={`dsi-${field}`}
                        className="block text-sm font-medium text-zinc-900"
                      >
                        {label.label}
                      </label>
                      {label.helper ? (
                        <p className="mt-0.5 text-xs text-zinc-500">{label.helper}</p>
                      ) : null}
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        aria-label={`Decrease ${label.label}`}
                        onClick={() => updateCount(field, counts[field] - 1)}
                        disabled={counts[field] <= 0 || status === "loading"}
                        className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 bg-white text-lg font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        -
                      </button>
                      <input
                        id={`dsi-${field}`}
                        aria-label={label.label}
                        type="number"
                        inputMode="numeric"
                        min={0}
                        step={1}
                        value={counts[field]}
                        onChange={(event) => handleInputChange(field, event.target.value)}
                        disabled={status === "loading"}
                        className="h-10 w-20 rounded-2xl border border-zinc-200 bg-zinc-50 px-2 text-center text-base font-semibold text-zinc-950 outline-none transition focus:border-zinc-400 disabled:opacity-60"
                      />
                      <button
                        type="button"
                        aria-label={`Increase ${label.label}`}
                        onClick={() => updateCount(field, counts[field] + 1)}
                        disabled={status === "loading"}
                        className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 bg-white text-lg font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-zinc-200 bg-white/95 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:static sm:mt-5 sm:border-0 sm:bg-transparent sm:p-0">
        <div className="mx-auto max-w-3xl">
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className="w-full rounded-full bg-zinc-900 px-5 py-3 text-sm font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
          >
            {isSaving
              ? "Saving..."
              : isSubmitted && !hasChanges
                ? "DSI already saved"
                : saveLabel}
          </button>
        </div>
      </div>
    </main>
  );
}
