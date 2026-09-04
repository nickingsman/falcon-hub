"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getInclusiveDayCount,
  getMalaysiaLastWeekRange,
  getMalaysiaThisMonthRange,
  getMalaysiaThisWeekRange,
  getMalaysiaTodayDateString,
  getMalaysiaYesterdayDateString,
} from "@/lib/malaysia-date";

type Preset = "today" | "yesterday" | "this_week" | "last_week" | "this_month" | "custom";
type LoadStatus = "loading" | "ready" | "error";

type AttendanceMember = {
  memberId: string;
  memberName: string;
  position: string | null;
};

type AttendanceSession = {
  sessionId: string;
  memberId: string;
  memberName: string;
  position: string | null;
  attendanceDate: string;
  status: "checked_in" | "completed";
  checkedInAt: string;
  checkedOutAt: string | null;
  durationMinutes: number | null;
  checkInLocationName: string;
  currentLocationName: string;
  checkOutLocationName: string | null;
  locationUpdatedAt: string;
};

type AttendanceHistoryResponse = {
  from: string;
  to: string;
  timezone: "Asia/Kuala_Lumpur";
  dates: string[];
  authorizedMembers: AttendanceMember[];
  sessions: AttendanceSession[];
};

type LocationAuditEvent = {
  locationName: string | null;
  locationSource: string | null;
  falconLocationId: string | null;
  latitude: number | null;
  longitude: number | null;
  accuracyMeters: number | null;
  timestamp: string | null;
};

type AttendanceSessionDetail = {
  sessionId: string;
  memberId: string;
  memberName: string;
  position: string | null;
  attendanceDate: string;
  status: "checked_in" | "completed";
  checkedInAt: string;
  checkedOutAt: string | null;
  durationMinutes: number | null;
  locationUpdatedAt: string;
  locationAudit: {
    checkIn: LocationAuditEvent | null;
    current: LocationAuditEvent | null;
    checkOut: LocationAuditEvent | null;
  };
};

function getPresetRange(preset: Preset) {
  if (preset === "yesterday") {
    const yesterday = getMalaysiaYesterdayDateString();
    return { from: yesterday, to: yesterday };
  }

  if (preset === "this_week") return getMalaysiaThisWeekRange();
  if (preset === "last_week") return getMalaysiaLastWeekRange();
  if (preset === "this_month") return getMalaysiaThisMonthRange();

  const today = getMalaysiaTodayDateString();
  return { from: today, to: today };
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function formatTime(value: string | null) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-MY", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kuala_Lumpur",
  }).format(new Date(value));
}

function formatDuration(minutes: number | null) {
  if (minutes === null) return "—";

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours === 0) return `${remainingMinutes}m`;
  if (remainingMinutes === 0) return `${hours}h`;

  return `${hours}h ${remainingMinutes}m`;
}

function formatStatus(status: AttendanceSession["status"]) {
  return status === "completed" ? "Completed" : "Checked In";
}

function getDisplayLocation(session: AttendanceSession) {
  return session.checkOutLocationName ?? session.currentLocationName ?? session.checkInLocationName;
}

function formatCoordinate(value: number | null) {
  if (value === null) return "—";

  return value.toFixed(6);
}

function isSingleDay(history: AttendanceHistoryResponse | null) {
  return Boolean(history && history.from === history.to && history.dates.length === 1);
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-zinc-950">{value}</p>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-zinc-900">{value}</p>
    </div>
  );
}

function LocationAuditBlock({
  event,
  title,
}: {
  event: LocationAuditEvent | null;
  title: string;
}) {
  if (!event) return null;

  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
      <p className="text-sm font-semibold text-zinc-950">{title}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <DetailRow label="Location" value={event.locationName ?? "Location captured"} />
        <DetailRow label="Time" value={formatTime(event.timestamp)} />
        <DetailRow
          label="Coordinates"
          value={`${formatCoordinate(event.latitude)}, ${formatCoordinate(event.longitude)}`}
        />
        <DetailRow
          label="Accuracy"
          value={event.accuracyMeters === null ? "—" : `±${Math.round(event.accuracyMeters)} m`}
        />
      </div>
    </div>
  );
}

export default function TeamAttendancePage() {
  const [preset, setPreset] = useState<Preset>("today");
  const [customFrom, setCustomFrom] = useState(getMalaysiaTodayDateString());
  const [customTo, setCustomTo] = useState(getMalaysiaTodayDateString());
  const [memberFilter, setMemberFilter] = useState("");
  const [members, setMembers] = useState<AttendanceMember[]>([]);
  const [history, setHistory] = useState<AttendanceHistoryResponse | null>(null);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [sessionDetail, setSessionDetail] = useState<AttendanceSessionDetail | null>(null);
  const [detailStatus, setDetailStatus] = useState<LoadStatus>("ready");
  const [detailError, setDetailError] = useState<string | null>(null);

  const selectedRange = useMemo(
    () => (preset === "custom" ? { from: customFrom, to: customTo } : getPresetRange(preset)),
    [customFrom, customTo, preset],
  );
  const isRangeInvalid =
    selectedRange.to > getMalaysiaTodayDateString() ||
    selectedRange.from > selectedRange.to ||
    getInclusiveDayCount(selectedRange.from, selectedRange.to) > 90;

  const visibleSessions = useMemo(() => history?.sessions ?? [], [history?.sessions]);
  const submittedMemberIds = useMemo(
    () => new Set(visibleSessions.map((session) => session.memberId)),
    [visibleSessions],
  );
  const missingSingleDayMembers = useMemo(() => {
    if (!isSingleDay(history)) return [];

    return (history?.authorizedMembers ?? []).filter(
      (member) => !submittedMemberIds.has(member.memberId),
    );
  }, [history, submittedMemberIds]);
  const summary = useMemo(() => {
    return {
      teamMembers: members.length || history?.authorizedMembers.length || 0,
      recordedSessions: visibleSessions.length,
      completedSessions: visibleSessions.filter((session) => session.status === "completed").length,
      currentlyCheckedIn: visibleSessions.filter((session) => session.status === "checked_in").length,
    };
  }, [history?.authorizedMembers.length, members.length, visibleSessions]);

  const loadHistory = useCallback(async () => {
    if (isRangeInvalid) {
      setStatus("error");
      setErrorMessage("Choose a valid date range of 90 days or less, without future dates.");
      return;
    }

    setStatus("loading");
    setErrorMessage(null);

    try {
      const params = new URLSearchParams({
        from: selectedRange.from,
        to: selectedRange.to,
      });

      if (memberFilter) {
        params.set("memberId", memberFilter);
      }

      const response = await fetch(`/api/check-in/history?${params.toString()}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as AttendanceHistoryResponse | { error?: string };

      if (!response.ok) {
        throw new Error(
          "error" in payload && payload.error ? payload.error : "Unable to load attendance history",
        );
      }

      const nextHistory = payload as AttendanceHistoryResponse;
      setHistory(nextHistory);

      if (!memberFilter || members.length === 0) {
        setMembers(nextHistory.authorizedMembers);
      }

      setStatus("ready");
    } catch (error) {
      setStatus("error");
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load attendance history. Please try again.",
      );
    }
  }, [isRangeInvalid, memberFilter, members.length, selectedRange.from, selectedRange.to]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadHistory();
  }, [loadHistory]);

  async function openSessionDetail(sessionId: string) {
    setSelectedSessionId(sessionId);
    setSessionDetail(null);
    setDetailStatus("loading");
    setDetailError(null);

    try {
      const response = await fetch(`/api/check-in/history/${sessionId}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as AttendanceSessionDetail | { error?: string };

      if (!response.ok) {
        throw new Error(
          "error" in payload && payload.error ? payload.error : "Unable to load attendance detail",
        );
      }

      setSessionDetail(payload as AttendanceSessionDetail);
      setDetailStatus("ready");
    } catch (error) {
      setDetailStatus("error");
      setDetailError(
        error instanceof Error
          ? error.message
          : "Unable to load attendance detail. Please try again.",
      );
    }
  }

  const presetButtons: Array<{ id: Preset; label: string }> = [
    { id: "today", label: "Today" },
    { id: "yesterday", label: "Yesterday" },
    { id: "this_week", label: "This Week" },
    { id: "last_week", label: "Last Week" },
    { id: "this_month", label: "This Month" },
    { id: "custom", label: "Custom Range" },
  ];

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-6 text-zinc-950 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
        <section className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-[0_16px_50px_rgba(15,23,42,0.06)] sm:p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">
            Team Attendance
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">
            Attendance
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
            Review check-in records for your authorised team.
          </p>
        </section>

        <section className="rounded-[24px] border border-zinc-200 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.04)] sm:p-5">
          <div className="flex flex-wrap gap-2">
            {presetButtons.map((button) => (
              <button
                key={button.id}
                type="button"
                onClick={() => setPreset(button.id)}
                className={`rounded-full border px-3 py-2 text-sm font-semibold transition ${
                  preset === button.id
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
                }`}
              >
                {button.label}
              </button>
            ))}
          </div>

          {preset === "custom" ? (
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

          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <label className="text-sm font-medium text-zinc-700">
              Member
              <select
                value={memberFilter}
                onChange={(event) => setMemberFilter(event.target.value)}
                className="mt-1 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
              >
                <option value="">All Team Members</option>
                {members.map((member) => (
                  <option key={member.memberId} value={member.memberId}>
                    {member.memberName}
                    {member.position ? ` - ${member.position}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => void loadHistory()}
              disabled={status === "loading"}
              className="min-h-11 rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {status === "loading" ? "Loading..." : "Refresh"}
            </button>
          </div>

          <p className="mt-4 text-sm text-zinc-500">
            {formatDate(selectedRange.from)} to {formatDate(selectedRange.to)}
          </p>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard label="Team Members" value={summary.teamMembers} />
          <SummaryCard label="Recorded Sessions" value={summary.recordedSessions} />
          <SummaryCard label="Completed Sessions" value={summary.completedSessions} />
          <SummaryCard label="Currently Checked In" value={summary.currentlyCheckedIn} />
        </section>

        {errorMessage ? (
          <section className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
            <p>{errorMessage}</p>
            <button
              type="button"
              onClick={() => void loadHistory()}
              className="mt-3 rounded-full border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100"
            >
              Retry
            </button>
          </section>
        ) : null}

        <section className="rounded-[24px] border border-zinc-200 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.04)] sm:p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Attendance History
              </h2>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                No check-in record means no attendance session was submitted for that date. It does not indicate absence.
              </p>
            </div>
          </div>

          {status === "loading" ? (
            <p className="mt-5 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4 text-sm text-zinc-500">
              Loading attendance records...
            </p>
          ) : visibleSessions.length === 0 && missingSingleDayMembers.length === 0 ? (
            <p className="mt-5 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4 text-sm text-zinc-500">
              No real check-in sessions were recorded for this view.
            </p>
          ) : (
            <>
              <div className="mt-5 hidden overflow-hidden rounded-2xl border border-zinc-200 lg:block">
                <table className="w-full border-collapse bg-white text-left">
                  <thead className="bg-zinc-50">
                    <tr>
                      {[
                        "Member",
                        "Date",
                        "Check In",
                        "Check Out",
                        "Duration",
                        "Location",
                        "Status",
                        "Details",
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
                    {visibleSessions.map((session) => (
                      <tr key={session.sessionId}>
                        <td className="px-3 py-3">
                          <p className="font-semibold text-zinc-900">{session.memberName}</p>
                          {session.position ? (
                            <p className="mt-0.5 text-xs text-zinc-500">{session.position}</p>
                          ) : null}
                        </td>
                        <td className="px-3 py-3 text-sm text-zinc-700">
                          {formatDate(session.attendanceDate)}
                        </td>
                        <td className="px-3 py-3 text-sm text-zinc-700">
                          {formatTime(session.checkedInAt)}
                        </td>
                        <td className="px-3 py-3 text-sm text-zinc-700">
                          {formatTime(session.checkedOutAt)}
                        </td>
                        <td className="px-3 py-3 text-sm text-zinc-700">
                          {formatDuration(session.durationMinutes)}
                        </td>
                        <td className="px-3 py-3 text-sm text-zinc-700">
                          {getDisplayLocation(session)}
                        </td>
                        <td className="px-3 py-3 text-sm font-semibold text-zinc-800">
                          {formatStatus(session.status)}
                        </td>
                        <td className="px-3 py-3">
                          <button
                            type="button"
                            onClick={() => void openSessionDetail(session.sessionId)}
                            className="rounded-full border border-zinc-200 px-3 py-1.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
                          >
                            Details
                          </button>
                        </td>
                      </tr>
                    ))}
                    {missingSingleDayMembers.map((member) => (
                      <tr key={`missing-${member.memberId}`} className="bg-zinc-50">
                        <td className="px-3 py-3">
                          <p className="font-semibold text-zinc-900">{member.memberName}</p>
                          {member.position ? (
                            <p className="mt-0.5 text-xs text-zinc-500">{member.position}</p>
                          ) : null}
                        </td>
                        <td className="px-3 py-3 text-sm text-zinc-700">
                          {history ? formatDate(history.from) : "—"}
                        </td>
                        <td className="px-3 py-3 text-sm text-zinc-500">—</td>
                        <td className="px-3 py-3 text-sm text-zinc-500">—</td>
                        <td className="px-3 py-3 text-sm text-zinc-500">—</td>
                        <td className="px-3 py-3 text-sm text-zinc-500">—</td>
                        <td className="px-3 py-3 text-sm font-semibold text-zinc-500">
                          No check-in record
                        </td>
                        <td className="px-3 py-3 text-sm text-zinc-500">—</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-5 space-y-3 lg:hidden">
                {visibleSessions.map((session) => (
                  <article
                    key={session.sessionId}
                    className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-zinc-950">{session.memberName}</p>
                        {session.position ? (
                          <p className="mt-1 text-sm text-zinc-500">{session.position}</p>
                        ) : null}
                      </div>
                      <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-700">
                        {formatStatus(session.status)}
                      </span>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <DetailRow label="Date" value={formatDate(session.attendanceDate)} />
                      <DetailRow label="Location" value={getDisplayLocation(session)} />
                      <DetailRow label="Check In" value={formatTime(session.checkedInAt)} />
                      <DetailRow label="Check Out" value={formatTime(session.checkedOutAt)} />
                      <DetailRow label="Duration" value={formatDuration(session.durationMinutes)} />
                    </div>
                    <button
                      type="button"
                      onClick={() => void openSessionDetail(session.sessionId)}
                      className="mt-4 min-h-11 w-full rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
                    >
                      Details
                    </button>
                  </article>
                ))}
                {missingSingleDayMembers.map((member) => (
                  <article
                    key={`missing-mobile-${member.memberId}`}
                    className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4"
                  >
                    <p className="font-semibold text-zinc-950">{member.memberName}</p>
                    {member.position ? (
                      <p className="mt-1 text-sm text-zinc-500">{member.position}</p>
                    ) : null}
                    <p className="mt-3 text-sm font-semibold text-zinc-500">
                      No check-in record
                    </p>
                  </article>
                ))}
              </div>
            </>
          )}
        </section>
      </div>

      {selectedSessionId ? (
        <div className="fixed inset-0 z-50 bg-zinc-950/30 px-4 py-6 backdrop-blur-sm">
          <div className="mx-auto flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-5 py-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Location Audit
                </p>
                <h3 className="mt-1 text-xl font-semibold text-zinc-950">
                  Attendance Detail
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedSessionId(null);
                  setSessionDetail(null);
                }}
                className="rounded-full border border-zinc-200 px-3 py-1.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
              >
                Close
              </button>
            </div>

            <div className="overflow-y-auto px-5 py-5">
              {detailStatus === "loading" ? (
                <p className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4 text-sm text-zinc-500">
                  Loading attendance detail...
                </p>
              ) : detailStatus === "error" ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  <p>{detailError ?? "Unable to load attendance detail."}</p>
                </div>
              ) : sessionDetail ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <DetailRow label="Member" value={sessionDetail.memberName} />
                      <DetailRow label="Date" value={formatDate(sessionDetail.attendanceDate)} />
                      <DetailRow label="Status" value={formatStatus(sessionDetail.status)} />
                      <DetailRow label="Duration" value={formatDuration(sessionDetail.durationMinutes)} />
                      <DetailRow label="Check-in Time" value={formatTime(sessionDetail.checkedInAt)} />
                      <DetailRow label="Check-out Time" value={formatTime(sessionDetail.checkedOutAt)} />
                    </div>
                  </div>

                  <LocationAuditBlock title="Check In" event={sessionDetail.locationAudit.checkIn} />
                  <LocationAuditBlock title="Latest Location" event={sessionDetail.locationAudit.current} />
                  <LocationAuditBlock title="Check Out" event={sessionDetail.locationAudit.checkOut} />
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
