"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type AttendanceStatus = "not_checked_in" | "checked_in" | "completed";
type DsiStatus = "not_submitted" | "submitted";

type AgentDashboardResponse = {
  date: string;
  timezone: "Asia/Kuala_Lumpur";
  user: {
    memberName: string;
    position: string | null;
  };
  attendance: {
    status: AttendanceStatus;
    checkedInAt: string | null;
    checkedOutAt: string | null;
    currentLocationName: string | null;
  };
  todayDsi: {
    status: DsiStatus;
    submittedAt: string | null;
    newLeadsContact: number;
    appointmentMade: number;
    turnUpAppt: number;
    unitClosed: number;
  };
  myWeek: {
    recordedDsiDays: number;
    appointmentMade: number;
    turnUpAppt: number;
    unitClosed: number;
  };
  teamPresence: {
    totalCheckedIn: number;
    groups: {
      locationName: string;
      count: number;
    }[];
  };
};

type LoadStatus = "loading" | "ready" | "error";

const introSessionKey = "falcon-hub:intro-played";

const quickTools = [
  {
    title: "ROI Calculator",
    description: "Calculate returns and customer purchase numbers.",
    href: "/tools/roi-calculator",
  },
  {
    title: "Progressive Interest",
    description: "Estimate Schedule H progressive interest.",
    href: "/tools/progressive-interest",
  },
  {
    title: "Smart Project Finder",
    description: "Narrow suitable projects faster.",
    href: "/tools/smart-project-finder",
  },
  {
    title: "Project Comparison",
    description: "Compare projects side by side.",
    href: "/tools/project-comparison",
  },
];

function formatMalaysiaDate(value: string) {
  return new Intl.DateTimeFormat("en-MY", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
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

function getMalaysiaGreeting() {
  const hour = Number(
    new Intl.DateTimeFormat("en-MY", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone: "Asia/Kuala_Lumpur",
    }).format(new Date()),
  );

  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function getAttendanceCopy(status: AttendanceStatus) {
  if (status === "checked_in") {
    return {
      label: "Checked in",
      tone: "border-emerald-200 bg-emerald-50 text-emerald-800",
      action: "View Check-in",
    };
  }

  if (status === "completed") {
    return {
      label: "Completed",
      tone: "border-zinc-200 bg-zinc-100 text-zinc-800",
      action: "View Check-in",
    };
  }

  return {
    label: "Not checked in",
    tone: "border-amber-200 bg-amber-50 text-amber-800",
    action: "Check In",
  };
}

function getDsiCopy(status: DsiStatus) {
  if (status === "submitted") {
    return {
      label: "Submitted",
      tone: "border-emerald-200 bg-emerald-50 text-emerald-800",
    };
  }

  return {
    label: "Not submitted",
    tone: "border-amber-200 bg-amber-50 text-amber-800",
  };
}

function StatusPill({ label, tone }: { label: string; tone: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${tone}`}>
      {label}
    </span>
  );
}

function MetricCard({
  label,
  value,
  note,
}: {
  label: string;
  value: number;
  note?: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
        {label}
      </p>
      <p className="mt-2 text-[26px] font-semibold leading-none tracking-tight text-zinc-950">
        {value}
      </p>
      {note ? <p className="mt-1 text-sm text-zinc-500">{note}</p> : null}
    </div>
  );
}

function LoadingDashboard() {
  return (
    <main className="p-5 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <section className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
          <div className="h-4 w-36 rounded bg-zinc-100" />
          <div className="mt-4 h-8 w-72 max-w-full rounded bg-zinc-100" />
          <div className="mt-3 h-4 w-48 rounded bg-zinc-100" />
        </section>
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="h-44 rounded-[24px] border border-zinc-200 bg-white" />
          <div className="h-44 rounded-[24px] border border-zinc-200 bg-white" />
        </section>
      </div>
    </main>
  );
}

function FalconIntroOverlay({
  isExiting,
  onSkip,
}: {
  isExiting: boolean;
  onSkip: () => void;
}) {
  return (
    <div
      className={`fixed inset-0 z-50 flex min-h-dvh items-center justify-center bg-zinc-950 px-6 text-white transition-opacity duration-500 ${
        isExiting ? "opacity-0" : "opacity-100"
      }`}
      aria-label="Falcon Hub intro"
    >
      <style>{`
        @keyframes falconIntroMark {
          0% { opacity: 0; transform: translateY(8px) scale(0.985); }
          24% { opacity: 1; transform: translateY(0) scale(1); }
          86% { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }

        @keyframes falconIntroLine {
          0% { transform: scaleX(0); opacity: 0; }
          20% { transform: scaleX(0); opacity: 0; }
          44% { transform: scaleX(1); opacity: 1; }
          86% { transform: scaleX(1); opacity: 1; }
          100% { transform: scaleX(1); opacity: 1; }
        }

        @keyframes falconIntroTagline {
          0% { opacity: 0; transform: translateY(6px); }
          36% { opacity: 0; transform: translateY(6px); }
          64% { opacity: 1; transform: translateY(0); }
          86% { opacity: 1; transform: translateY(0); }
          100% { opacity: 1; transform: translateY(0); }
        }

        .falcon-intro-wordmark {
          animation: falconIntroMark 4.3s ease both;
        }

        .falcon-intro-line {
          animation: falconIntroLine 4.3s ease both;
        }

        .falcon-intro-tagline {
          animation: falconIntroTagline 4.3s ease both;
        }

        @media (prefers-reduced-motion: reduce) {
          .falcon-intro-wordmark,
          .falcon-intro-line,
          .falcon-intro-tagline {
            animation-duration: 700ms !important;
            transform: none !important;
          }
        }
      `}</style>

      <div className="text-center">
        <p className="falcon-intro-wordmark text-4xl font-semibold tracking-[0.08em] text-white sm:text-5xl">
          Falcon Hub
        </p>
        <div className="mx-auto mt-6 h-px w-40 origin-center bg-white/70 falcon-intro-line sm:w-52" />
        <p className="falcon-intro-tagline mt-6 text-sm font-medium tracking-[0.24em] text-zinc-300 sm:text-base">
          One Team · One Goal · One Falcon
        </p>
      </div>

      <button
        type="button"
        onClick={onSkip}
        className="absolute bottom-[calc(1.25rem+env(safe-area-inset-bottom))] right-5 rounded-full border border-white/15 px-4 py-2 text-xs font-medium text-zinc-300 transition hover:border-white/30 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/40"
      >
        Skip
      </button>
    </div>
  );
}

export default function Home() {
  const [dashboard, setDashboard] = useState<AgentDashboardResponse | null>(null);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [showIntro, setShowIntro] = useState(false);
  const [isIntroExiting, setIsIntroExiting] = useState(false);

  const loadDashboard = useCallback(async () => {
    setStatus("loading");
    setErrorMessage("");

    try {
      const response = await fetch("/api/dashboard/agent", {
        cache: "no-store",
      });
      const payload = (await response.json()) as AgentDashboardResponse | { error?: string };

      if (!response.ok) {
        throw new Error(
          "error" in payload && payload.error
            ? payload.error
            : "Unable to load dashboard",
        );
      }

      setDashboard(payload as AgentDashboardResponse);
      setStatus("ready");
    } catch (error) {
      setStatus("error");
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load dashboard. Please try again.",
      );
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadDashboard();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadDashboard]);

  useEffect(() => {
    let exitTimeoutId: number | undefined;
    let hideTimeoutId: number | undefined;

    try {
      if (window.sessionStorage.getItem(introSessionKey) === "played") {
        return undefined;
      }

      window.sessionStorage.setItem(introSessionKey, "played");
    } catch {
      return undefined;
    }

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const totalDuration = prefersReducedMotion ? 800 : 5000;
    const fadeDuration = prefersReducedMotion ? 180 : 450;

    setShowIntro(true);

    exitTimeoutId = window.setTimeout(() => {
      setIsIntroExiting(true);
    }, totalDuration - fadeDuration);

    hideTimeoutId = window.setTimeout(() => {
      setShowIntro(false);
      setIsIntroExiting(false);
    }, totalDuration);

    return () => {
      if (exitTimeoutId) window.clearTimeout(exitTimeoutId);
      if (hideTimeoutId) window.clearTimeout(hideTimeoutId);
    };
  }, []);

  const greeting = useMemo(() => getMalaysiaGreeting(), []);
  const dismissIntro = useCallback(() => {
    setIsIntroExiting(true);
    window.setTimeout(() => {
      setShowIntro(false);
      setIsIntroExiting(false);
    }, 220);
  }, []);

  if (status === "loading" && !dashboard) {
    return <LoadingDashboard />;
  }

  if (status === "error" && !dashboard) {
    return (
      <main className="p-5 sm:p-6 lg:p-8">
        <section className="mx-auto max-w-3xl rounded-[28px] border border-zinc-200 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
          <p className="text-sm font-semibold text-zinc-900">Dashboard unavailable</p>
          <p className="mt-2 text-sm leading-6 text-zinc-600">{errorMessage}</p>
          <button
            type="button"
            onClick={() => void loadDashboard()}
            className="mt-5 min-h-11 rounded-full bg-zinc-950 px-5 text-sm font-semibold text-white transition hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2"
          >
            Retry
          </button>
        </section>
      </main>
    );
  }

  if (!dashboard) return null;

  const attendanceCopy = getAttendanceCopy(dashboard.attendance.status);
  const dsiCopy = getDsiCopy(dashboard.todayDsi.status);
  const checkedInAt = formatMalaysiaTime(dashboard.attendance.checkedInAt);
  const checkedOutAt = formatMalaysiaTime(dashboard.attendance.checkedOutAt);
  const submittedAt = formatMalaysiaTime(dashboard.todayDsi.submittedAt);

  return (
    <main className="overflow-x-hidden p-4 sm:p-6 lg:p-8">
      {showIntro ? (
        <FalconIntroOverlay isExiting={isIntroExiting} onSkip={dismissIntro} />
      ) : null}

      <div className="mx-auto max-w-6xl space-y-5">
        <section className="rounded-[24px] border border-zinc-200 bg-white px-5 py-4 shadow-[0_12px_34px_rgba(15,23,42,0.04)] sm:px-6">
          <p className="text-sm font-medium text-zinc-500">
            {formatMalaysiaDate(dashboard.date)}
          </p>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-zinc-950 sm:text-3xl">
                {greeting}, {dashboard.user.memberName}
              </h1>
              <p className="mt-1.5 text-sm text-zinc-600">
                Here&apos;s where you are today.
              </p>
            </div>
            {dashboard.user.position ? (
              <span className="max-w-full break-words rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-600 sm:w-fit">
                {dashboard.user.position}
              </span>
            ) : null}
          </div>
        </section>

        {status === "error" ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {errorMessage}
          </div>
        ) : null}

        <section>
          <div className="mb-3">
            <p className="text-sm font-semibold text-zinc-900">Today</p>
            <p className="text-sm text-zinc-500">Your daily operating status</p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <article className="rounded-[24px] border border-zinc-200 bg-white p-5 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
                    Check-in
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-zinc-950">
                    {attendanceCopy.label}
                  </h2>
                </div>
                <StatusPill label={attendanceCopy.label} tone={attendanceCopy.tone} />
              </div>

              <div className="mt-4 space-y-2 text-sm text-zinc-600">
                {dashboard.attendance.currentLocationName ? (
                  <p>
                    Current location:{" "}
                    <span className="font-medium text-zinc-900">
                      {dashboard.attendance.currentLocationName}
                    </span>
                  </p>
                ) : (
                  <p>Check in when you start your field work today.</p>
                )}
                {checkedInAt ? <p>Checked in {checkedInAt}</p> : null}
                {checkedOutAt ? <p>Checked out {checkedOutAt}</p> : null}
              </div>

              <Link
                href="/check-in"
                className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-zinc-950 px-5 text-sm font-semibold text-white transition hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 sm:w-auto"
              >
                {attendanceCopy.action}
              </Link>
            </article>

            <article className="rounded-[24px] border border-zinc-200 bg-white p-5 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
                    Today&apos;s DSI
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-zinc-950">
                    {dsiCopy.label}
                  </h2>
                </div>
                <StatusPill label={dsiCopy.label} tone={dsiCopy.tone} />
              </div>

              {dashboard.todayDsi.status === "submitted" ? (
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-2xl bg-zinc-50 p-3">
                    <p className="text-zinc-500">New Leads</p>
                    <p className="mt-1 text-lg font-semibold text-zinc-950">
                      {dashboard.todayDsi.newLeadsContact}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-zinc-50 p-3">
                    <p className="text-zinc-500">Appointment Made</p>
                    <p className="mt-1 text-lg font-semibold text-zinc-950">
                      {dashboard.todayDsi.appointmentMade}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-zinc-50 p-3">
                    <p className="text-zinc-500">Turn Up</p>
                    <p className="mt-1 text-lg font-semibold text-zinc-950">
                      {dashboard.todayDsi.turnUpAppt}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-zinc-50 p-3">
                    <p className="text-zinc-500">Unit Closed</p>
                    <p className="mt-1 text-lg font-semibold text-zinc-950">
                      {dashboard.todayDsi.unitClosed}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-sm leading-6 text-zinc-600">
                  Today&apos;s DSI hasn&apos;t been submitted yet.
                </p>
              )}

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                {submittedAt ? (
                  <p className="text-sm text-zinc-500">Submitted {submittedAt}</p>
                ) : (
                  <span />
                )}
                <Link
                  href="/dsi"
                  className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-zinc-300 px-5 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 sm:w-auto"
                >
                  Update DSI
                </Link>
              </div>
            </article>
          </div>
        </section>

        <section className="lg:hidden">
          <div className="mb-3">
            <p className="text-sm font-semibold text-zinc-900">Quick Tools</p>
            <p className="text-sm text-zinc-500">Open the working sales tools</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {quickTools.map((tool) => (
              <Link
                key={tool.href}
                href={tool.href}
                className="flex min-h-28 flex-col justify-between rounded-[20px] border border-zinc-200 bg-white p-4 transition hover:-translate-y-0.5 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2"
              >
                <div>
                  <p className="text-sm font-semibold text-zinc-950">{tool.title}</p>
                  <p className="mt-2 text-xs leading-5 text-zinc-500">{tool.description}</p>
                </div>
                <p className="mt-3 text-xs font-semibold text-zinc-900">Open</p>
              </Link>
            ))}
          </div>
        </section>

        <section>
          <div className="mb-3">
            <p className="text-sm font-semibold text-zinc-900">My Week</p>
            <p className="text-sm text-zinc-500">Factual DSI activity this week</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Recorded DSI Days"
              value={dashboard.myWeek.recordedDsiDays}
            />
            <MetricCard
              label="Appointments Made"
              value={dashboard.myWeek.appointmentMade}
            />
            <MetricCard label="Turn Ups" value={dashboard.myWeek.turnUpAppt} />
            <MetricCard label="Units Closed" value={dashboard.myWeek.unitClosed} />
          </div>
        </section>

        <section className="grid items-start gap-4 lg:grid-cols-[1.5fr_1fr]">
          <article className="hidden rounded-[24px] border border-zinc-200 bg-white p-5 shadow-[0_10px_28px_rgba(15,23,42,0.04)] lg:block">
            <div>
              <p className="text-sm font-semibold text-zinc-900">Quick Tools</p>
              <p className="mt-1 text-sm text-zinc-500">Open the working sales tools</p>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              {quickTools.map((tool) => (
                <Link
                  key={tool.href}
                  href={tool.href}
                  className="group flex min-h-32 flex-col justify-between rounded-[20px] border border-zinc-200 bg-zinc-50 p-4 transition hover:-translate-y-0.5 hover:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2"
                >
                  <div>
                    <p className="text-sm font-semibold text-zinc-950">{tool.title}</p>
                    <p className="mt-2 text-xs leading-5 text-zinc-500">
                      {tool.description}
                    </p>
                  </div>
                  <p className="mt-4 text-xs font-semibold text-zinc-900 group-hover:underline">
                    Open
                  </p>
                </Link>
              ))}
            </div>
          </article>

          <article className="rounded-[24px] border border-zinc-200 bg-white p-5 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-zinc-900">Team Presence</p>
                <p className="mt-1 text-sm text-zinc-500">
                  {dashboard.teamPresence.totalCheckedIn} checked in now
                </p>
              </div>
              <Link
                href="/check-in"
                className="shrink-0 rounded-full border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2"
              >
                View
              </Link>
            </div>

            {dashboard.teamPresence.groups.length === 0 ? (
              <p className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-500">
                No teammates are currently checked in.
              </p>
            ) : (
              <div className="mt-4 space-y-2">
                {dashboard.teamPresence.groups.map((group) => (
                  <div
                    key={group.locationName}
                    className="flex items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-2.5"
                  >
                    <p className="text-sm font-semibold uppercase tracking-[0.12em] text-zinc-700">
                      {group.locationName}
                    </p>
                    <p className="shrink-0 text-sm font-semibold text-zinc-950">
                      {group.count}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </article>
        </section>
      </div>
    </main>
  );
}
