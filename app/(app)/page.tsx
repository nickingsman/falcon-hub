"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppPermissions } from "./components/AppPermissionProvider";

type BirthdayMember = {
  id: string;
  fullName: string;
  month: number;
  day: number;
  position: string | null;
};

type UpcomingBirthdayMember = BirthdayMember & {
  daysUntil: number;
};

type BirthdayResponse = {
  today: BirthdayMember[];
  upcoming: UpcomingBirthdayMember[];
};

type DashboardSummary = {
  members: {
    falconHubActiveMembers: number;
    myActiveTeam: number;
  };
  projects: {
    activeProjects: number;
  };
  attention?: {
    pendingApprovals: number;
    pendingProfileCompletion: number;
  };
};

const emptyDashboardSummary: DashboardSummary = {
  members: {
    falconHubActiveMembers: 0,
    myActiveTeam: 0,
  },
  projects: {
    activeProjects: 0,
  },
};

function formatMonthDay(month: number, day: number) {
  return new Intl.DateTimeFormat("en-MY", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2000, month - 1, day)));
}

function formatMalaysiaDate() {
  return new Intl.DateTimeFormat("en-MY", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Kuala_Lumpur",
  }).format(new Date());
}

export default function Home() {
  const { displayName, canManageUserApprovals } = useAppPermissions();
  const [dashboardSummary, setDashboardSummary] = useState<DashboardSummary>(
    emptyDashboardSummary,
  );
  const [isLoadingSummary, setIsLoadingSummary] = useState(true);
  const [summaryError, setSummaryError] = useState("");
  const [birthdayReminders, setBirthdayReminders] = useState<BirthdayResponse>({
    today: [],
    upcoming: [],
  });
  const [isLoadingBirthdays, setIsLoadingBirthdays] = useState(true);
  const [birthdayError, setBirthdayError] = useState("");

  const currentDateLabel = useMemo(() => formatMalaysiaDate(), []);

  const fetchDashboardSummary = useCallback(async () => {
    try {
      setIsLoadingSummary(true);
      setSummaryError("");

      const response = await fetch("/api/dashboard/summary", {
        cache: "no-store",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to load dashboard summary");
      }

      setDashboardSummary({
        members: {
          falconHubActiveMembers: Number(result.members?.falconHubActiveMembers ?? 0),
          myActiveTeam: Number(result.members?.myActiveTeam ?? 0),
        },
        projects: {
          activeProjects: Number(result.projects?.activeProjects ?? 0),
        },
        attention: result.attention
          ? {
              pendingApprovals: Number(result.attention.pendingApprovals ?? 0),
              pendingProfileCompletion: Number(
                result.attention.pendingProfileCompletion ?? 0,
              ),
            }
          : undefined,
      });
    } catch (error) {
      setSummaryError(
        error instanceof Error
          ? error.message
          : "Unable to load dashboard summary"
      );
    } finally {
      setIsLoadingSummary(false);
    }
  }, []);

  const fetchBirthdayReminders = useCallback(async () => {
    try {
      setIsLoadingBirthdays(true);
      setBirthdayError("");

      const response = await fetch("/api/dashboard/birthdays", {
        cache: "no-store",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to load birthday reminders");
      }

      setBirthdayReminders({
        today: result.today ?? [],
        upcoming: result.upcoming ?? [],
      });
    } catch (error) {
      setBirthdayError(
        error instanceof Error
          ? error.message
          : "Unable to load birthday reminders"
      );
    } finally {
      setIsLoadingBirthdays(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchDashboardSummary();
      void fetchBirthdayReminders();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [fetchBirthdayReminders, fetchDashboardSummary]);

  const summaryCards = [
    {
      label: "FalconHub Active Members",
      value: dashboardSummary.members.falconHubActiveMembers,
      note: "Company-wide active team",
      href: "/team/members",
    },
    {
      label: "My Active Team",
      value: dashboardSummary.members.myActiveTeam,
      note: "Your visible hierarchy",
      href: "/team/members",
    },
    {
      label: "Active Projects",
      value: dashboardSummary.projects.activeProjects,
      note: "Company-wide project count",
      href: "/projects",
    },
    ...(dashboardSummary.attention
      ? [
          {
            label: "Pending Approvals",
            value: dashboardSummary.attention.pendingApprovals,
            note: "Registrations to review",
            href: "/team/user-approvals",
          },
        ]
      : []),
  ];

  const quickActions = [
    {
      title: "View Projects",
      subtitle: "Open the project directory",
      href: "/projects",
    },
    {
      title: "View Members",
      subtitle: "Open your team directory",
      href: "/team/members",
    },
    {
      title: "ROI Calculator",
      subtitle: "Estimate property investment returns",
      href: "/tools/roi-calculator",
    },
    ...(canManageUserApprovals
      ? [
          {
            title: "User Approvals",
            subtitle: "Review pending registrations",
            href: "/team/user-approvals",
          },
        ]
      : []),
  ];

  return (
    <>
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white/80 px-6 py-4 backdrop-blur">
        <div>
          <p className="text-sm text-zinc-500">{currentDateLabel}</p>
          <p className="text-base font-semibold text-zinc-900">Workspace overview</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 text-sm font-semibold text-white">
          N
        </div>
      </header>

      <main className="p-6 lg:p-8">
        <section className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.24em] text-zinc-500">
              Dashboard
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">
              Good Morning, {displayName}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-600 sm:text-base">
              A real-time view of team size, project readiness, and items that need attention.
            </p>
          </div>
        </section>

        {summaryError ? (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {summaryError}
          </div>
        ) : null}

        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((stat) => (
            <Link
              key={stat.label}
              href={stat.href}
              className="rounded-[24px] border border-zinc-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_36px_rgba(15,23,42,0.08)]"
            >
              <p className="text-sm text-zinc-500">{stat.label}</p>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">
                {isLoadingSummary ? "..." : stat.value}
              </p>
              <p className="mt-2 text-sm text-zinc-600">{stat.note}</p>
            </Link>
          ))}
        </section>

        {dashboardSummary.attention ? (
          <section className="mt-8 rounded-[28px] border border-zinc-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-zinc-900">
                  Needs Attention
                </p>
                <p className="text-sm text-zinc-500">
                  Admin-only onboarding follow-up
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <Link
                href="/team/user-approvals"
                className="rounded-[24px] border border-zinc-200 bg-zinc-50 p-5 transition hover:bg-white"
              >
                <p className="text-sm text-zinc-500">Pending Approvals</p>
                <p className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">
                  {isLoadingSummary ? "..." : dashboardSummary.attention.pendingApprovals}
                </p>
                <p className="mt-2 text-sm text-zinc-600">
                  Registrations waiting for admin review
                </p>
              </Link>

              <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 p-5">
                <p className="text-sm text-zinc-500">Awaiting Profile Completion</p>
                <p className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">
                  {isLoadingSummary
                    ? "..."
                    : dashboardSummary.attention.pendingProfileCompletion}
                </p>
                <p className="mt-2 text-sm text-zinc-600">
                  Approved users who have not completed their profile
                </p>
              </div>
            </div>
          </section>
        ) : null}

        <section className="mt-8 rounded-[28px] border border-zinc-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-zinc-900">
                Birthday Reminders
              </p>
              <p className="text-sm text-zinc-500">
                Today and the next 30 days
              </p>
            </div>
          </div>

          {birthdayError ? (
            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {birthdayError}
            </div>
          ) : null}

          {isLoadingBirthdays ? (
            <div className="mt-5 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4 text-sm text-zinc-600">
              Loading birthday reminders...
            </div>
          ) : (
            <div className="mt-5 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-zinc-900">
                    Today&apos;s Birthday
                  </p>
                  <span className="rounded-full bg-zinc-900 px-3 py-1 text-xs font-medium text-white">
                    {birthdayReminders.today.length}
                  </span>
                </div>

                <div className="mt-4 space-y-3">
                  {birthdayReminders.today.length === 0 ? (
                    <p className="rounded-2xl border border-zinc-200 bg-white px-4 py-4 text-sm text-zinc-500">
                      No birthdays today.
                    </p>
                  ) : (
                    birthdayReminders.today.map((member) => (
                      <div
                        key={member.id}
                        className="rounded-2xl border border-zinc-200 bg-white px-4 py-4"
                      >
                        <p className="font-semibold text-zinc-900">
                          {member.fullName}
                        </p>
                        <p className="mt-1 text-sm text-zinc-500">
                          {formatMonthDay(member.month, member.day)}
                          {member.position ? ` - ${member.position}` : ""}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-[24px] border border-zinc-200 bg-white p-5">
                <p className="text-sm font-semibold text-zinc-900">
                  Upcoming Birthdays
                </p>

                <div className="mt-4 space-y-3">
                  {birthdayReminders.upcoming.length === 0 ? (
                    <p className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4 text-sm text-zinc-500">
                      No upcoming birthdays in the next 30 days.
                    </p>
                  ) : (
                    birthdayReminders.upcoming.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3"
                      >
                        <div>
                          <p className="font-medium text-zinc-900">
                            {member.fullName}
                          </p>
                          <p className="mt-1 text-sm text-zinc-500">
                            {formatMonthDay(member.month, member.day)}
                            {member.position ? ` - ${member.position}` : ""}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-600">
                          {member.daysUntil}d
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="mt-8 rounded-[28px] border border-zinc-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
          <div>
            <p className="text-sm font-semibold text-zinc-900">Quick Actions</p>
            <p className="text-sm text-zinc-500">Open the working Falcon Hub areas</p>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {quickActions.map((action) => (
              <Link
                key={action.title}
                href={action.href}
                className="rounded-[20px] border border-zinc-200 bg-zinc-50 p-4 text-left transition hover:-translate-y-0.5 hover:bg-white"
              >
                <p className="text-base font-semibold text-zinc-900">{action.title}</p>
                <p className="mt-1 text-sm text-zinc-500">{action.subtitle}</p>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
