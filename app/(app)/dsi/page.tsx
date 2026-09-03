"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  dsiActivityFields,
  type DsiActivityCounts,
  type DsiActivityField,
} from "@/lib/dsi";
import { getTeamDsiAttentionSignals } from "@/lib/dsi-team";
import {
  getMalaysiaTodayDateString,
  getMalaysiaThisMonthRange,
  getMalaysiaThisWeekRange,
  getMalaysiaLastWeekRange,
  getMalaysiaYesterdayDateString,
} from "@/lib/malaysia-date";
import { useAppPermissions } from "../components/AppPermissionProvider";

type DsiView = "entry" | "history" | "team";
type DsiDay = "today" | "yesterday";
type DsiStatus = "loading" | "not_submitted" | "submitted" | "error";
type HistoryPreset = "this_week" | "last_week" | "this_month" | "custom";

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

type DsiHistoryResponse = {
  from: string;
  to: string;
  dates: string[];
  entries: DsiApiEntry[];
};

type TeamDsiMember = {
  id: string;
  memberCode: number | null;
  fullName: string;
  position: string | null;
  leaderId: string | null;
};

type TeamDsiEntry = DsiApiEntry & {
  memberId: string;
};

type TeamDsiResponse = {
  from: string;
  to: string;
  dates: string[];
  members: TeamDsiMember[];
  summary: {
    teamMembers: number;
    expectedMemberDays: number;
    activeMembers: number;
  };
  entries: TeamDsiEntry[];
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

const funnelFields: DsiActivityField[] = [
  "new_leads_contact",
  "appointment_made",
  "turn_up_appt",
  "presented",
  "unit_closed",
  "unit_sold",
  "unit_converted",
];

const funnelRates = [
  { label: "Appointment Rate", numerator: "appointment_made", denominator: "new_leads_contact" },
  { label: "Turn Up Rate", numerator: "turn_up_appt", denominator: "appointment_made" },
  { label: "Presentation Rate", numerator: "presented", denominator: "turn_up_appt" },
  { label: "Closing Rate", numerator: "unit_closed", denominator: "presented" },
  { label: "Sold Rate", numerator: "unit_sold", denominator: "unit_closed" },
  { label: "Converted Rate", numerator: "unit_converted", denominator: "unit_sold" },
] satisfies Array<{
  label: string;
  numerator: DsiActivityField;
  denominator: DsiActivityField;
}>;

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

function formatShortDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);

  return new Intl.DateTimeFormat("en-MY", {
    day: "numeric",
    month: "short",
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

function getPresetRange(preset: HistoryPreset) {
  if (preset === "last_week") return getMalaysiaLastWeekRange();
  if (preset === "this_month") return getMalaysiaThisMonthRange();

  return getMalaysiaThisWeekRange();
}

function calculateTotals(entries: DsiApiEntry[]) {
  const totals = createZeroCounts();

  for (const entry of entries) {
    for (const field of dsiActivityFields) {
      totals[field] += entry.activities[field];
    }
  }

  return totals;
}

function calculateTeamMemberTotals(memberId: string, entries: TeamDsiEntry[]) {
  return calculateTotals(entries.filter((entry) => entry.memberId === memberId));
}

function formatRate(numerator: number, denominator: number) {
  if (denominator === 0) return "—";

  return `${Math.round((numerator / denominator) * 100)}%`;
}

function getFunnelRateAfterStage(index: number) {
  return funnelRates[index] ?? null;
}

function getSubmittedDateKeysForMember(memberId: string, entries: TeamDsiEntry[]) {
  return new Set(
    entries
      .filter((entry) => entry.memberId === memberId)
      .map((entry) => entry.activityDate),
  );
}

export default function DsiPage() {
  const { role } = useAppPermissions();
  const canViewTeamDsi = role === "leader" || role === "admin" || role === "super_admin";
  const [activeView, setActiveView] = useState<DsiView>("entry");
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
  const [historyPreset, setHistoryPreset] = useState<HistoryPreset>("this_week");
  const [customFrom, setCustomFrom] = useState(getPresetRange("this_week").from);
  const [customTo, setCustomTo] = useState(getPresetRange("this_week").to);
  const [historyResponse, setHistoryResponse] = useState<DsiHistoryResponse | null>(null);
  const [historyError, setHistoryError] = useState("");
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [teamPreset, setTeamPreset] = useState<HistoryPreset>("this_week");
  const [teamCustomFrom, setTeamCustomFrom] = useState(getPresetRange("this_week").from);
  const [teamCustomTo, setTeamCustomTo] = useState(getPresetRange("this_week").to);
  const [teamResponse, setTeamResponse] = useState<TeamDsiResponse | null>(null);
  const [teamError, setTeamError] = useState("");
  const [isLoadingTeam, setIsLoadingTeam] = useState(false);
  const requestIdRef = useRef(0);
  const historyRequestIdRef = useRef(0);
  const teamRequestIdRef = useRef(0);

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
  const selectedHistoryRange =
    historyPreset === "custom"
      ? { from: customFrom, to: customTo }
      : getPresetRange(historyPreset);
  const selectedTeamRange =
    teamPreset === "custom"
      ? { from: teamCustomFrom, to: teamCustomTo }
      : getPresetRange(teamPreset);
  const historyEntries = historyResponse?.entries ?? [];
  const historyTotals = useMemo(() => calculateTotals(historyEntries), [historyEntries]);
  const submittedDates = useMemo(
    () => new Set(historyEntries.map((entry) => entry.activityDate)),
    [historyEntries],
  );
  const entriesByDate = useMemo(
    () => new Map(historyEntries.map((entry) => [entry.activityDate, entry])),
    [historyEntries],
  );
  const teamEntries = teamResponse?.entries ?? [];
  const teamTotals = useMemo(() => calculateTotals(teamEntries), [teamEntries]);
  const teamSubmittedDays = teamEntries.length;
  const expectedMemberDays = teamResponse?.summary.expectedMemberDays ?? 0;
  const teamSubmissionRate = formatRate(teamSubmittedDays, expectedMemberDays);
  const teamIncludesToday = Boolean(
    teamResponse?.dates.includes(getMalaysiaTodayDateString()),
  );
  const teamMemberSummaries = useMemo(
    () =>
      (teamResponse?.members ?? []).map((member) => {
        const memberEntries = teamEntries.filter((entry) => entry.memberId === member.id);
        const totals = calculateTotals(memberEntries);
        const submittedDateKeys = getSubmittedDateKeysForMember(member.id, memberEntries);

        return {
          member,
          totals,
          submittedDays: submittedDateKeys.size,
          signals: getTeamDsiAttentionSignals({
            totals,
            includesToday: teamIncludesToday,
            hasSubmittedToday: submittedDateKeys.has(getMalaysiaTodayDateString()),
          }),
        };
      }),
    [teamEntries, teamIncludesToday, teamResponse?.members],
  );
  const teamAttentionSignals = useMemo(
    () =>
      teamMemberSummaries.flatMap((summary) =>
        summary.signals.map((signal) => ({
          ...signal,
          member: summary.member,
        })),
      ),
    [teamMemberSummaries],
  );
  const teamAttentionSignalGroups = useMemo(
    () =>
      ([
        { type: "not_submitted_today", label: "Not Submitted Today" },
        { type: "leads_without_appointment", label: "Leads Without Appointment" },
        { type: "appointment_turn_up_gap", label: "Appointment Turn-Up Gap" },
        { type: "presentation_closing_gap", label: "Presentation Closing Gap" },
      ] as const)
        .map((group) => ({
          ...group,
          signals: teamAttentionSignals.filter((signal) => signal.type === group.type),
        }))
        .filter((group) => group.signals.length > 0),
    [teamAttentionSignals],
  );

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

  const loadHistory = useCallback(async (from: string, to: string) => {
    const currentRequestId = historyRequestIdRef.current + 1;
    historyRequestIdRef.current = currentRequestId;

    setIsLoadingHistory(true);
    setHistoryError("");

    try {
      const params = new URLSearchParams({ from, to });
      const response = await fetch(`/api/dsi/history?${params.toString()}`, {
        cache: "no-store",
      });
      const result = (await response.json()) as DsiHistoryResponse & { error?: string };

      if (historyRequestIdRef.current !== currentRequestId) return;

      if (!response.ok) {
        throw new Error(result.error || "Unable to load DSI history");
      }

      setHistoryResponse(result);
    } catch (error) {
      if (historyRequestIdRef.current !== currentRequestId) return;

      setHistoryResponse(null);
      setHistoryError(error instanceof Error ? error.message : "Unable to load DSI history");
    } finally {
      if (historyRequestIdRef.current === currentRequestId) {
        setIsLoadingHistory(false);
      }
    }
  }, []);

  const loadTeamDsi = useCallback(async (from: string, to: string) => {
    const currentRequestId = teamRequestIdRef.current + 1;
    teamRequestIdRef.current = currentRequestId;

    setIsLoadingTeam(true);
    setTeamError("");

    try {
      const params = new URLSearchParams({ from, to });
      const response = await fetch(`/api/dsi/team?${params.toString()}`, {
        cache: "no-store",
      });
      const result = (await response.json()) as TeamDsiResponse & { error?: string };

      if (teamRequestIdRef.current !== currentRequestId) return;

      if (!response.ok) {
        throw new Error(result.error || "Unable to load Team DSI");
      }

      setTeamResponse(result);
    } catch (error) {
      if (teamRequestIdRef.current !== currentRequestId) return;

      setTeamResponse(null);
      setTeamError(error instanceof Error ? error.message : "Unable to load Team DSI");
    } finally {
      if (teamRequestIdRef.current === currentRequestId) {
        setIsLoadingTeam(false);
      }
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadDsi(selectedDay);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadDsi, selectedDay]);

  useEffect(() => {
    if (activeView !== "history") return;

    const timeoutId = window.setTimeout(() => {
      void loadHistory(selectedHistoryRange.from, selectedHistoryRange.to);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [activeView, loadHistory, selectedHistoryRange.from, selectedHistoryRange.to]);

  useEffect(() => {
    if (activeView !== "team") return;

    if (!canViewTeamDsi) {
      setActiveView("history");
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void loadTeamDsi(selectedTeamRange.from, selectedTeamRange.to);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [
    activeView,
    canViewTeamDsi,
    loadTeamDsi,
    selectedTeamRange.from,
    selectedTeamRange.to,
  ]);

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
      <div className="mb-4 inline-flex rounded-full border border-zinc-200 bg-white p-1">
        {([
          { id: "entry", label: "Daily Entry" },
          { id: "history", label: "My DSI" },
          ...(canViewTeamDsi ? [{ id: "team" as const, label: "Team DSI" }] : []),
        ] as const).map((view) => (
          <button
            key={view.id}
            type="button"
            onClick={() => setActiveView(view.id)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              activeView === view.id
                ? "bg-zinc-900 text-white shadow-sm"
                : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
            }`}
          >
            {view.label}
          </button>
        ))}
      </div>

      <section className="rounded-[28px] border border-zinc-200 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.04)] sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.22em] text-zinc-500">
              Daily Sales Index
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl">
              {activeView === "entry"
                ? formatHeaderDate(activityDate)
                : activeView === "team"
                  ? "Team DSI"
                  : "My DSI"}
            </h1>
            <p className="mt-2 text-sm text-zinc-600">
              {activeView === "entry"
                ? "Keep your daily sales activity updated."
                : activeView === "team"
                  ? "Review team submissions, activity flow, and coaching signals."
                  : "Review your own activity totals and submission history."}
            </p>
            {activeView === "entry" ? (
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
            ) : null}
          </div>

          {activeView === "entry" ? (
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
          ) : null}
        </div>

        {activeView === "entry" && errorMessage ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        ) : null}

        {activeView === "entry" && successMessage ? (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {successMessage}
          </div>
        ) : null}
      </section>

      {activeView === "entry" ? (
        <>
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
        </>
      ) : activeView === "history" ? (
        <section className="mt-4 space-y-4">
          <div className="rounded-[24px] border border-zinc-200 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.04)] sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-zinc-900">Date Range</p>
                <p className="mt-1 text-sm text-zinc-500">
                  Maximum 90 calendar days per request.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:flex">
                {([
                  { id: "this_week", label: "This Week" },
                  { id: "last_week", label: "Last Week" },
                  { id: "this_month", label: "This Month" },
                  { id: "custom", label: "Custom Range" },
                ] as const).map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setHistoryPreset(preset.id)}
                    className={`rounded-full border px-3 py-2 text-sm font-medium transition ${
                      historyPreset === preset.id
                        ? "border-zinc-900 bg-zinc-900 text-white"
                        : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {historyPreset === "custom" ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-medium text-zinc-700">
                  From
                  <input
                    type="date"
                    value={customFrom}
                    max={getMalaysiaTodayDateString()}
                    onChange={(event) => setCustomFrom(event.target.value)}
                    className="mt-1 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                  />
                </label>
                <label className="text-sm font-medium text-zinc-700">
                  To
                  <input
                    type="date"
                    value={customTo}
                    max={getMalaysiaTodayDateString()}
                    onChange={(event) => setCustomTo(event.target.value)}
                    className="mt-1 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                  />
                </label>
              </div>
            ) : null}

            <p className="mt-4 text-sm text-zinc-600">
              {formatHeaderDate(selectedHistoryRange.from)} to{" "}
              {formatHeaderDate(selectedHistoryRange.to)}
            </p>
          </div>

          {historyError ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {historyError}
            </div>
          ) : null}

          <div className="rounded-[24px] border border-zinc-200 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.04)] sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  DSI Submission
                </h2>
                <p className="mt-1 text-sm text-zinc-500">Selected period</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-semibold text-zinc-950">
                  {isLoadingHistory || !historyResponse
                    ? "..."
                    : `${submittedDates.size} / ${historyResponse.dates.length}`}
                </p>
                {!isLoadingHistory && historyResponse ? (
                  <p className="mt-1 text-sm text-zinc-500">days submitted</p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="rounded-[24px] border border-zinc-200 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.04)] sm:p-5">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">
              Activity Summary
            </h2>
            {isLoadingHistory ? (
              <p className="mt-4 text-sm text-zinc-500">Loading My DSI...</p>
            ) : historyEntries.length === 0 ? (
              <p className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-500">
                No DSI submitted in this range.
              </p>
            ) : (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {activityGroups.map((group) => (
                  <div key={group.title} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                      {group.title}
                    </p>
                    <div className="mt-2 space-y-2">
                      {group.fields.map((field) => (
                        <div key={field} className="flex items-center justify-between gap-3 text-sm">
                          <span className="text-zinc-600">{activityLabels[field].label}</span>
                          <span className="font-semibold text-zinc-950">{historyTotals[field]}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-[24px] border border-zinc-200 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.04)] sm:p-5">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">
              Sales Funnel
            </h2>
            <div className="mt-4 space-y-1.5">
              {funnelFields.map((field, index) => {
                const rate = getFunnelRateAfterStage(index);

                return (
                  <div key={field}>
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-2.5">
                      <div className="flex items-center justify-between gap-4">
                        <p className="text-sm text-zinc-600">{activityLabels[field].label}</p>
                        <p className="text-xl font-semibold text-zinc-950">
                          {historyTotals[field]}
                        </p>
                      </div>
                    </div>
                    {rate ? (
                      <div className="flex items-center justify-center gap-2 py-1 text-sm text-zinc-500">
                        <span aria-hidden="true">↓</span>
                        <span className="font-semibold text-zinc-700">
                          {formatRate(
                            historyTotals[rate.numerator],
                            historyTotals[rate.denominator],
                          )}
                        </span>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-[24px] border border-zinc-200 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.04)] sm:p-5">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">
              Daily History
            </h2>
            <div className="mt-4 space-y-3">
              {(historyResponse?.dates ?? []).map((date) => {
                const entry = entriesByDate.get(date);

                return (
                  <details
                    key={date}
                    className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3"
                  >
                    <summary className="cursor-pointer list-none">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-semibold text-zinc-900">{formatShortDate(date)}</p>
                          <p className="mt-1 text-xs text-zinc-500">
                            {entry ? "Submitted" : "Not Submitted"}
                          </p>
                        </div>
                        <div className="grid grid-cols-4 gap-2 text-center sm:grid-cols-7">
                          {funnelFields.map((field) => (
                            <div key={field}>
                              <p className="text-xs text-zinc-500">
                                {activityLabels[field].label
                                  .replace("New Leads Contact", "Leads")
                                  .replace("Appointment Made", "Appt")
                                  .replace("Turn Up Appt", "Turn Up")
                                  .replace("Unit ", "")}
                              </p>
                              <p className="text-sm font-semibold text-zinc-950">
                                {entry ? entry.activities[field] : "—"}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </summary>
                    <div className="mt-3 grid gap-2 border-t border-zinc-200 pt-3 sm:grid-cols-2">
                      {dsiActivityFields.map((field) => (
                        <div key={field} className="flex items-center justify-between gap-3 text-sm">
                          <span className="text-zinc-600">{activityLabels[field].label}</span>
                          <span className="font-semibold text-zinc-950">
                            {entry ? entry.activities[field] : "—"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </details>
                );
              })}
            </div>
          </div>
        </section>
      ) : (
        <section className="mt-4 space-y-4">
          <div className="rounded-[24px] border border-zinc-200 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.04)] sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-zinc-900">Team Date Range</p>
                <p className="mt-1 text-sm text-zinc-500">
                  Recursive team visibility, maximum 90 calendar days.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:flex">
                {([
                  { id: "this_week", label: "This Week" },
                  { id: "last_week", label: "Last Week" },
                  { id: "this_month", label: "This Month" },
                  { id: "custom", label: "Custom Range" },
                ] as const).map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setTeamPreset(preset.id)}
                    className={`rounded-full border px-3 py-2 text-sm font-medium transition ${
                      teamPreset === preset.id
                        ? "border-zinc-900 bg-zinc-900 text-white"
                        : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {teamPreset === "custom" ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-medium text-zinc-700">
                  From
                  <input
                    type="date"
                    value={teamCustomFrom}
                    max={getMalaysiaTodayDateString()}
                    onChange={(event) => setTeamCustomFrom(event.target.value)}
                    className="mt-1 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                  />
                </label>
                <label className="text-sm font-medium text-zinc-700">
                  To
                  <input
                    type="date"
                    value={teamCustomTo}
                    max={getMalaysiaTodayDateString()}
                    onChange={(event) => setTeamCustomTo(event.target.value)}
                    className="mt-1 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                  />
                </label>
              </div>
            ) : null}

            <p className="mt-4 text-sm text-zinc-600">
              {formatHeaderDate(selectedTeamRange.from)} to{" "}
              {formatHeaderDate(selectedTeamRange.to)}
            </p>
          </div>

          {teamError ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {teamError}
            </div>
          ) : null}

          <div className="rounded-[24px] border border-zinc-200 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.04)] sm:p-5">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">
              Team Overview
            </h2>
            {isLoadingTeam ? (
              <p className="mt-4 text-sm text-zinc-500">Loading Team DSI...</p>
            ) : !teamResponse ? (
              <p className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-500">
                Select a range to load Team DSI.
              </p>
            ) : teamResponse.members.length === 0 ? (
              <p className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-500">
                No visible team members for this view.
              </p>
            ) : (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                    Team Members
                  </p>
                  <p className="mt-2 text-3xl font-semibold text-zinc-950">
                    {teamResponse.summary.teamMembers}
                  </p>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                    DSI Submission
                  </p>
                  <div className="mt-2 flex items-end justify-between gap-4">
                    <div>
                      <p className="text-3xl font-semibold text-zinc-950">
                        {teamSubmittedDays} / {expectedMemberDays}
                      </p>
                      <p className="mt-1 text-sm text-zinc-500">member-days</p>
                    </div>
                    <p className="pb-1 text-lg font-semibold text-zinc-900">
                      {teamSubmissionRate}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-[24px] border border-zinc-200 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.04)] sm:p-5">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">
              Team Funnel
            </h2>
            <div className="mt-4 space-y-1.5">
              {funnelFields.map((field, index) => {
                const rate = getFunnelRateAfterStage(index);

                return (
                  <div key={field}>
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-2.5">
                      <div className="flex items-center justify-between gap-4">
                        <p className="text-sm text-zinc-600">{activityLabels[field].label}</p>
                        <p className="text-xl font-semibold text-zinc-950">
                          {isLoadingTeam ? "..." : teamTotals[field]}
                        </p>
                      </div>
                    </div>
                    {rate ? (
                      <div className="flex items-center justify-center gap-2 py-1 text-sm text-zinc-500">
                        <span aria-hidden="true">↓</span>
                        <span className="font-semibold text-zinc-700">
                          {isLoadingTeam
                            ? "..."
                            : formatRate(
                                teamTotals[rate.numerator],
                                teamTotals[rate.denominator],
                              )}
                        </span>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-[24px] border border-zinc-200 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.04)] sm:p-5">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">
              Needs Attention
            </h2>
            {isLoadingTeam ? (
              <p className="mt-4 text-sm text-zinc-500">Checking coaching signals...</p>
            ) : teamAttentionSignals.length === 0 ? (
              <p className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-500">
                No coaching signals for this period.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {teamAttentionSignalGroups.map((group) => (
                  <div
                    key={group.type}
                    className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                        {group.label}
                      </p>
                      <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-700">
                        {group.signals.length}
                      </span>
                    </div>
                    <div className="mt-3 space-y-2">
                      {group.signals.map((signal) => (
                        <div key={`${signal.member.id}-${signal.type}`}>
                          <p className="text-sm font-semibold text-zinc-900">
                            {signal.member.fullName}
                          </p>
                          {signal.type !== "not_submitted_today" ? (
                            <p className="mt-0.5 text-sm text-zinc-500">{signal.reason}</p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-[24px] border border-zinc-200 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.04)] sm:p-5">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">
              Member Performance
            </h2>
            {isLoadingTeam ? (
              <p className="mt-4 text-sm text-zinc-500">Loading member activity...</p>
            ) : teamMemberSummaries.length === 0 ? (
              <p className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-500">
                No team members to show.
              </p>
            ) : (
              <>
              <div className="mt-4 hidden overflow-hidden rounded-2xl border border-zinc-200 md:block">
                <table className="w-full border-collapse bg-white text-left">
                  <thead className="bg-zinc-50">
                    <tr>
                      {[
                        "Member",
                        "DSI",
                        "Leads",
                        "Appt",
                        "Turn Up",
                        "Presented",
                        "Closed",
                        "Sold",
                        "Converted",
                      ].map((heading) => (
                        <th
                          key={heading}
                          className="border-b border-zinc-200 px-3 py-3 text-sm font-semibold text-zinc-600"
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {teamMemberSummaries.map(({ member, totals, submittedDays }) => (
                      <tr key={member.id} className="bg-white">
                        <td className="px-3 py-3">
                          <p className="font-semibold text-zinc-900">{member.fullName}</p>
                          {member.position ? (
                            <p className="mt-0.5 text-xs text-zinc-500">{member.position}</p>
                          ) : null}
                        </td>
                        <td className="px-3 py-3 text-sm font-semibold text-zinc-900">
                          {submittedDays}/{teamResponse?.dates.length ?? 0}
                        </td>
                        <td className="px-3 py-3 text-sm font-semibold text-zinc-900">
                          {totals.new_leads_contact}
                        </td>
                        <td className="px-3 py-3 text-sm font-semibold text-zinc-900">
                          {totals.appointment_made}
                        </td>
                        <td className="px-3 py-3 text-sm font-semibold text-zinc-900">
                          {totals.turn_up_appt}
                        </td>
                        <td className="px-3 py-3 text-sm font-semibold text-zinc-900">
                          {totals.presented}
                        </td>
                        <td className="px-3 py-3 text-sm font-semibold text-zinc-900">
                          {totals.unit_closed}
                        </td>
                        <td className="px-3 py-3 text-sm font-semibold text-zinc-900">
                          {totals.unit_sold}
                        </td>
                        <td className="px-3 py-3 text-sm font-semibold text-zinc-900">
                          {totals.unit_converted}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 space-y-3 md:hidden">
                {teamMemberSummaries.map(({ member, totals, submittedDays }) => (
                  <details
                    key={member.id}
                    className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3"
                  >
                    <summary className="cursor-pointer list-none">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-semibold text-zinc-900">
                            {member.fullName}
                          </p>
                          <p className="mt-1 text-xs text-zinc-500">
                            {submittedDays} / {teamResponse?.dates.length ?? 0} days submitted
                            {member.position ? ` · ${member.position}` : ""}
                          </p>
                        </div>
                        <div className="grid grid-cols-4 gap-2 text-center sm:grid-cols-7">
                          {funnelFields.map((field) => (
                            <div key={field}>
                              <p className="text-xs text-zinc-500">
                                {activityLabels[field].label
                                  .replace("New Leads Contact", "Leads")
                                  .replace("Appointment Made", "Appt")
                                  .replace("Turn Up Appt", "Turn Up")
                                  .replace("Unit ", "")}
                              </p>
                              <p className="text-sm font-semibold text-zinc-950">
                                {totals[field]}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </summary>
                    <div className="mt-3 grid gap-2 border-t border-zinc-200 pt-3 sm:grid-cols-2">
                      {dsiActivityFields.map((field) => (
                        <div key={field} className="flex items-center justify-between gap-3 text-sm">
                          <span className="text-zinc-600">{activityLabels[field].label}</span>
                          <span className="font-semibold text-zinc-950">{totals[field]}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
              </>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
