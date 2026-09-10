"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppPermissions } from "./components/AppPermissionProvider";

type AttendanceStatus = "not_checked_in" | "checked_in" | "completed";
type DsiStatus = "not_submitted" | "submitted";
type DashboardView = "my" | "team";

type DashboardUpcomingEvent = {
  id: string;
  title: string;
  category: string;
  eventDate: string;
  isAllDay: boolean;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  audienceLabel: string;
};

type CustomerDashboardBirthday = {
  customerName: string;
  project: string | null;
  unit: string | null;
  month: number;
  day: number;
  daysUntil: number;
};

type MemberDashboardBirthday = {
  id: string;
  fullName: string;
  month: number;
  day: number;
  position: string | null;
  daysUntil?: number;
};

type BirthdayReminderResponse<T> = {
  today: T[];
  upcoming: T[];
};

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
  upcomingEvents: {
    from: string;
    to: string;
    timezone: "Asia/Kuala_Lumpur";
    totalVisible: number;
    hasMore: boolean;
    events: DashboardUpcomingEvent[];
  };
  teamPresence: {
    totalCheckedIn: number;
    groups: {
      locationName: string;
      count: number;
    }[];
  };
};

type AttentionMember = {
  memberName: string;
  position: string | null;
};

type LeaderDashboardResponse = {
  date: string;
  timezone: "Asia/Kuala_Lumpur";
  user: {
    memberName: string;
    position: string | null;
  };
  teamToday: {
    teamMembers: number;
    dsiSubmitted: number;
    checkedInToday: number;
    currentlyCheckedIn: number;
  };
  todayActivity: {
    newLeadsContact: number;
    appointmentMade: number;
    turnUpAppt: number;
    unitClosed: number;
  };
  needsAttention: {
    dsiNotSubmitted: AttentionMember[];
    noCheckInRecord: AttentionMember[];
    appointmentWithoutTurnUp: {
      memberCount: number;
    };
  };
  teamPresence: {
    totalCheckedIn: number;
    groups: {
      locationName: string;
      count: number;
    }[];
  };
  upcomingEvents: AgentDashboardResponse["upcomingEvents"];
  teamWeek: {
    recordedDsiDays: number;
    appointmentMade: number;
    turnUpAppt: number;
    unitClosed: number;
  };
};

type LoadStatus = "loading" | "ready" | "error";

const introAfterLoginSessionKey = "falcon-hub:play-intro-after-login";

const quickTools = [
  {
    title: "Unit Calculation",
    description: "Calculate purchase package, financing and investment figures.",
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

const upcomingCategoryLabels: Record<string, string> = {
  company_meeting: "Company Meeting",
  team_meeting: "Team Meeting",
  training: "Training",
  roleplay: "Roleplay",
  recognition_event: "Recognition Event",
  project_activity: "Project Activity",
  other: "Event",
};

const sectionHeaderClass = "mb-3";
const dashboardCardClass =
  "rounded-[24px] border border-[#E5E2DA] bg-white p-5 shadow-sm";
const quietPanelClass =
  "rounded-2xl border border-[#E5E2DA] bg-[#F8F6F0]";

function formatMalaysiaDate(value: string) {
  return new Intl.DateTimeFormat("en-MY", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function formatShortEventDate(value: string) {
  return new Intl.DateTimeFormat("en-MY", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  })
    .format(new Date(`${value}T00:00:00.000Z`))
    .replace(",", "")
    .toUpperCase();
}

function formatBirthdayMonthDay(month: number, day: number) {
  return new Intl.DateTimeFormat("en-MY", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2000, month - 1, day)));
}

function getBirthdayTimingLabel(daysUntil: number) {
  if (daysUntil === 0) return "Today";
  if (daysUntil === 1) return "Tomorrow";

  return `In ${daysUntil} days`;
}

function formatDashboardEventTime(event: DashboardUpcomingEvent) {
  if (event.isAllDay) return "All Day";

  const start = formatLocalClockTime(event.startTime);
  if (!start) return "Time TBC";

  const end = formatLocalClockTime(event.endTime);

  return end ? `${start} – ${end}` : start;
}

function formatLocalClockTime(value: string | null) {
  if (!value) return null;

  const match = value.trim().match(/^([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/);
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = match[2];
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;

  return `${displayHour}:${minute} ${period}`;
}

function getUpcomingDateLabel(eventDate: string, today: string) {
  if (eventDate === today) return "Today";

  const tomorrow = new Date(`${today}T00:00:00.000Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  if (eventDate === tomorrow.toISOString().slice(0, 10)) return "Tomorrow";

  return formatShortEventDate(eventDate);
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
    <div className="flex min-h-28 flex-col justify-between rounded-[22px] border border-[#E5E2DA] border-t-[#B8924A]/50 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
        {label}
      </p>
      <p className="mt-3 text-[28px] font-semibold leading-none tracking-tight text-zinc-950">
        {value}
      </p>
      {note ? <p className="mt-1 text-sm text-zinc-500">{note}</p> : null}
    </div>
  );
}

function TeamMetricGrid({
  metrics,
}: {
  metrics: {
    label: string;
    value: number;
    note?: string;
  }[];
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <MetricCard
          key={metric.label}
          label={metric.label}
          value={metric.value}
          note={metric.note}
        />
      ))}
    </div>
  );
}

function CustomerBirthdaysPreview({
  birthdays,
  status,
}: {
  birthdays: BirthdayReminderResponse<CustomerDashboardBirthday>;
  status: LoadStatus;
}) {
  const visibleBirthdays = [...birthdays.today, ...birthdays.upcoming].slice(0, 5);
  const hiddenCount = Math.max(
    birthdays.today.length + birthdays.upcoming.length - visibleBirthdays.length,
    0,
  );

  return (
    <article className={dashboardCardClass}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-zinc-900">Customer Birthdays</p>
          <p className="mt-1 text-sm text-zinc-500">Private customer reminders</p>
        </div>
        <Link
          href="/customer-birthdays"
          className="shrink-0 rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-900 transition hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2"
        >
          View Birthday Book
        </Link>
      </div>

      {status === "loading" ? (
        <p className={`${quietPanelClass} mt-4 px-4 py-3 text-sm text-zinc-500`}>
          Loading customer birthdays...
        </p>
      ) : null}

      {status === "error" ? (
        <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Customer birthday reminders are unavailable right now.
        </p>
      ) : null}

      {status === "ready" && visibleBirthdays.length === 0 ? (
        <p className={`${quietPanelClass} mt-4 px-4 py-3 text-sm text-zinc-500`}>
          No customer birthdays in the next 30 days.
        </p>
      ) : null}

      {status === "ready" && visibleBirthdays.length > 0 ? (
        <div className="mt-4 divide-y divide-zinc-100">
          {visibleBirthdays.map((birthday, index) => (
            <div
              key={`${birthday.customerName}-${birthday.project ?? "project"}-${birthday.unit ?? "unit"}-${birthday.month}-${birthday.day}-${index}`}
              className="py-3 first:pt-0 last:pb-0"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="break-words text-sm font-semibold text-zinc-950">
                    {birthday.customerName}
                  </p>
                  {birthday.project || birthday.unit ? (
                    <p className="mt-1 break-words text-sm text-zinc-500">
                      {[birthday.project, birthday.unit ? `Unit ${birthday.unit}` : ""]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  ) : null}
                  <p className="mt-1 text-xs font-medium text-zinc-500">
                    {formatBirthdayMonthDay(birthday.month, birthday.day)}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                    birthday.daysUntil === 0
                      ? "border-[#B8924A]/30 bg-[#B8924A]/10 text-[#8F6E35]"
                      : "border-zinc-200 bg-zinc-50 text-zinc-600"
                  }`}
                >
                  {getBirthdayTimingLabel(birthday.daysUntil)}
                </span>
              </div>
            </div>
          ))}
          {hiddenCount > 0 ? (
            <p className="pt-3 text-xs font-medium text-zinc-500">+{hiddenCount} more in the next 30 days</p>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function MemberBirthdaysPreview({
  birthdays,
  status,
}: {
  birthdays: BirthdayReminderResponse<MemberDashboardBirthday>;
  status: LoadStatus;
}) {
  const visibleBirthdays = [
    ...birthdays.today.map((birthday) => ({ ...birthday, daysUntil: 0 })),
    ...birthdays.upcoming,
  ].slice(0, 5);
  const hiddenCount = Math.max(
    birthdays.today.length + birthdays.upcoming.length - visibleBirthdays.length,
    0,
  );

  return (
    <article className={dashboardCardClass}>
      <div>
        <p className="text-sm font-semibold text-zinc-900">Member Birthdays</p>
        <p className="mt-1 text-sm text-zinc-500">Team reminders for the next 30 days</p>
      </div>

      {status === "loading" ? (
        <p className={`${quietPanelClass} mt-4 px-4 py-3 text-sm text-zinc-500`}>
          Loading member birthdays...
        </p>
      ) : null}

      {status === "error" ? (
        <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Member birthday reminders are unavailable right now.
        </p>
      ) : null}

      {status === "ready" && visibleBirthdays.length === 0 ? (
        <p className={`${quietPanelClass} mt-4 px-4 py-3 text-sm text-zinc-500`}>
          No member birthdays in the next 30 days.
        </p>
      ) : null}

      {status === "ready" && visibleBirthdays.length > 0 ? (
        <div className="mt-4 divide-y divide-zinc-100">
          {visibleBirthdays.map((birthday) => {
            const daysUntil = birthday.daysUntil ?? 0;

            return (
              <div key={birthday.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-semibold text-zinc-950">
                      {birthday.fullName}
                    </p>
                    {birthday.position ? (
                      <p className="mt-1 break-words text-sm text-zinc-500">
                        {birthday.position}
                      </p>
                    ) : null}
                    <p className="mt-1 text-xs font-medium text-zinc-500">
                      {formatBirthdayMonthDay(birthday.month, birthday.day)}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                      daysUntil === 0
                        ? "border-[#B8924A]/30 bg-[#B8924A]/10 text-[#8F6E35]"
                        : "border-zinc-200 bg-zinc-50 text-zinc-600"
                    }`}
                  >
                    {getBirthdayTimingLabel(daysUntil)}
                  </span>
                </div>
              </div>
            );
          })}
          {hiddenCount > 0 ? (
            <p className="pt-3 text-xs font-medium text-zinc-500">+{hiddenCount} more in the next 30 days</p>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function BirthdaySection({
  customerBirthdays,
  customerStatus,
  memberBirthdays,
  memberStatus,
}: {
  customerBirthdays: BirthdayReminderResponse<CustomerDashboardBirthday>;
  customerStatus: LoadStatus;
  memberBirthdays: BirthdayReminderResponse<MemberDashboardBirthday>;
  memberStatus: LoadStatus;
}) {
  return (
    <section>
      <div className={sectionHeaderClass}>
        <p className="text-sm font-semibold text-zinc-900">Birthdays</p>
        <p className="text-sm text-zinc-500">People worth remembering</p>
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <CustomerBirthdaysPreview birthdays={customerBirthdays} status={customerStatus} />
        <MemberBirthdaysPreview birthdays={memberBirthdays} status={memberStatus} />
      </div>
    </section>
  );
}

function AttentionList({
  title,
  members,
}: {
  title: string;
  members: AttentionMember[];
}) {
  const visibleMembers = members.slice(0, 6);
  const hiddenCount = Math.max(members.length - visibleMembers.length, 0);

  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-zinc-900">{title}</p>
          <p className="mt-1 text-sm text-zinc-500">{members.length} member{members.length === 1 ? "" : "s"}</p>
        </div>
        <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-800">
          {members.length}
        </span>
      </div>

      {members.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-500">No one in this group right now.</p>
      ) : (
        <div className="mt-4 space-y-2">
          {visibleMembers.map((member) => (
            <div
              key={`${title}-${member.memberName}-${member.position ?? "member"}`}
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2"
            >
              <p className="text-sm font-medium text-zinc-900">{member.memberName}</p>
              {member.position ? (
                <p className="mt-0.5 text-xs text-zinc-500">{member.position}</p>
              ) : null}
            </div>
          ))}
          {hiddenCount > 0 ? (
            <p className="text-xs font-medium text-zinc-500">
              +{hiddenCount} more
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}

function UpcomingEventsCard({
  upcomingEvents,
  today,
}: {
  upcomingEvents: AgentDashboardResponse["upcomingEvents"];
  today: string;
}) {
  return (
    <section>
      <div className={`${sectionHeaderClass} flex items-end justify-between gap-4`}>
        <div>
          <p className="text-sm font-semibold text-zinc-900">Upcoming Events</p>
          <p className="text-sm text-zinc-500">Visible Falcon Calendar events in the next 7 days</p>
        </div>
        <Link
          href="/calendar"
          className="shrink-0 text-sm font-semibold text-zinc-900 underline-offset-4 transition hover:underline focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2"
        >
          View Calendar
        </Link>
      </div>

      <article className={dashboardCardClass}>
        {upcomingEvents.events.length === 0 ? (
          <p className={`${quietPanelClass} px-4 py-3 text-sm text-zinc-500`}>
            No upcoming events in the next 7 days.
          </p>
        ) : (
          <div className="divide-y divide-zinc-100">
            {upcomingEvents.events.map((event) => {
              const isToday = event.eventDate === today;

              return (
                <Link
                  key={event.id}
                  href="/calendar"
                  className="block py-3 first:pt-0 last:pb-0 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${
                            isToday
                              ? "border-[#087F6B]/20 bg-[#087F6B]/10 text-[#087F6B]"
                              : "border-zinc-200 bg-zinc-50 text-zinc-600"
                          }`}
                        >
                          {getUpcomingDateLabel(event.eventDate, today)}
                        </span>
                        <span className="text-xs font-medium text-zinc-500">
                          {upcomingCategoryLabels[event.category] ?? "Event"} · {event.audienceLabel}
                        </span>
                      </div>
                      <p className="mt-2 break-words text-sm font-semibold text-zinc-950">
                        {event.title}
                      </p>
                      {event.location ? (
                        <p className="mt-1 break-words text-sm text-zinc-500">{event.location}</p>
                      ) : null}
                    </div>
                    <p className="shrink-0 text-sm font-semibold text-zinc-800">
                      {formatDashboardEventTime(event)}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {upcomingEvents.hasMore ? (
          <p className="mt-4 border-t border-zinc-100 pt-3 text-sm text-zinc-500">
            {upcomingEvents.totalVisible - upcomingEvents.events.length} more event
            {upcomingEvents.totalVisible - upcomingEvents.events.length === 1 ? "" : "s"} in this window.
          </p>
        ) : null}
      </article>
    </section>
  );
}

function TeamPresencePreview({
  totalCheckedIn,
  groups,
}: LeaderDashboardResponse["teamPresence"]) {
  return (
    <article className={dashboardCardClass}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-zinc-900">Team Presence</p>
          <p className="mt-1 text-sm text-zinc-500">{totalCheckedIn} checked in now</p>
        </div>
        <Link
          href="/check-in"
          className="shrink-0 rounded-full border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2"
        >
          View
        </Link>
      </div>

      {groups.length === 0 ? (
        <p className={`${quietPanelClass} mt-4 px-4 py-3 text-sm text-zinc-500`}>
          No teammates are currently checked in.
        </p>
      ) : (
        <div className="mt-4 space-y-2">
          {groups.map((group) => (
            <div
              key={group.locationName}
              className={`${quietPanelClass} flex items-center justify-between gap-4 px-4 py-2.5`}
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
  );
}

function TeamDashboard({
  dashboard,
  status,
  errorMessage,
  onRetry,
}: {
  dashboard: LeaderDashboardResponse | null;
  status: LoadStatus;
  errorMessage: string;
  onRetry: () => void;
}) {
  if (status === "loading" && !dashboard) {
    return (
      <section className="grid gap-4">
        <div className="h-28 rounded-[24px] border border-zinc-200 bg-white" />
        <div className="h-56 rounded-[24px] border border-zinc-200 bg-white" />
      </section>
    );
  }

  if (status === "error" && !dashboard) {
    return (
      <section className="rounded-[24px] border border-zinc-200 bg-white p-5">
        <p className="text-sm font-semibold text-zinc-900">Team Dashboard unavailable</p>
        <p className="mt-2 text-sm text-zinc-600">{errorMessage}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 min-h-11 rounded-full bg-zinc-950 px-5 text-sm font-semibold text-white transition hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2"
        >
          Retry
        </button>
      </section>
    );
  }

  if (!dashboard) return null;

  return (
    <div className="space-y-5">
      {status === "error" ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {errorMessage}
        </div>
      ) : null}

      <section>
        <div className="mb-3">
          <p className="text-sm font-semibold text-zinc-900">Team Today</p>
          <p className="text-sm text-zinc-500">Factual team status for today</p>
        </div>
        <TeamMetricGrid
          metrics={[
            { label: "Team Members", value: dashboard.teamToday.teamMembers },
            { label: "DSI Submitted", value: dashboard.teamToday.dsiSubmitted },
            { label: "Checked In Today", value: dashboard.teamToday.checkedInToday },
            {
              label: "Currently Checked In",
              value: dashboard.teamToday.currentlyCheckedIn,
            },
          ]}
        />
      </section>

      <section className="lg:hidden">
        <div className="mb-3">
          <p className="text-sm font-semibold text-zinc-900">Needs Attention</p>
          <p className="text-sm text-zinc-500">Neutral operational follow-up</p>
        </div>
        <div className="grid gap-3">
          <AttentionList
            title="DSI Not Submitted"
            members={dashboard.needsAttention.dsiNotSubmitted}
          />
          <AttentionList
            title="No Check-in Record"
            members={dashboard.needsAttention.noCheckInRecord}
          />
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <p className="text-sm font-semibold text-zinc-900">
              Appointment Without Turn Up
            </p>
            <p className="mt-2 text-2xl font-semibold text-zinc-950">
              {dashboard.needsAttention.appointmentWithoutTurnUp.memberCount}
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              Members with appointments made and no turn up yet today.
            </p>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-3">
          <p className="text-sm font-semibold text-zinc-900">Today Activity</p>
          <p className="text-sm text-zinc-500">Team totals from submitted DSI</p>
        </div>
        <TeamMetricGrid
          metrics={[
            { label: "New Leads Contact", value: dashboard.todayActivity.newLeadsContact },
            { label: "Appointments Made", value: dashboard.todayActivity.appointmentMade },
            { label: "Turn Ups", value: dashboard.todayActivity.turnUpAppt },
            { label: "Units Closed", value: dashboard.todayActivity.unitClosed },
          ]}
        />
      </section>

      <section className="grid items-start gap-4 lg:grid-cols-[1.35fr_0.85fr]">
        <article className="hidden rounded-[24px] border border-zinc-200 bg-white p-5 shadow-[0_10px_28px_rgba(15,23,42,0.04)] lg:block">
          <div className="mb-4">
            <p className="text-sm font-semibold text-zinc-900">Needs Attention</p>
            <p className="mt-1 text-sm text-zinc-500">Neutral operational follow-up</p>
          </div>
          <div className="grid gap-3 xl:grid-cols-3">
            <AttentionList
              title="DSI Not Submitted"
              members={dashboard.needsAttention.dsiNotSubmitted}
            />
            <AttentionList
              title="No Check-in Record"
              members={dashboard.needsAttention.noCheckInRecord}
            />
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-sm font-semibold text-zinc-900">
                Appointment Without Turn Up
              </p>
              <p className="mt-2 text-2xl font-semibold text-zinc-950">
                {dashboard.needsAttention.appointmentWithoutTurnUp.memberCount}
              </p>
              <p className="mt-1 text-sm text-zinc-500">
                Members with appointments made and no turn up yet today.
              </p>
            </div>
          </div>
        </article>

        <TeamPresencePreview {...dashboard.teamPresence} />
      </section>

      <section>
        <div className="mb-3">
          <p className="text-sm font-semibold text-zinc-900">Team Week</p>
          <p className="text-sm text-zinc-500">Submitted member-day DSI totals this week</p>
        </div>
        <TeamMetricGrid
          metrics={[
            { label: "Recorded DSI Days", value: dashboard.teamWeek.recordedDsiDays },
            { label: "Appointments Made", value: dashboard.teamWeek.appointmentMade },
            { label: "Turn Ups", value: dashboard.teamWeek.turnUpAppt },
            { label: "Units Closed", value: dashboard.teamWeek.unitClosed },
          ]}
        />
      </section>
    </div>
  );
}

function LoadingDashboard() {
  return (
    <main className="p-5 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
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
  const { role } = useAppPermissions();
  const [dashboard, setDashboard] = useState<AgentDashboardResponse | null>(null);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [customerBirthdays, setCustomerBirthdays] = useState<
    BirthdayReminderResponse<CustomerDashboardBirthday>
  >({
    today: [],
    upcoming: [],
  });
  const [customerBirthdayStatus, setCustomerBirthdayStatus] =
    useState<LoadStatus>("loading");
  const [memberBirthdays, setMemberBirthdays] = useState<
    BirthdayReminderResponse<MemberDashboardBirthday>
  >({
    today: [],
    upcoming: [],
  });
  const [memberBirthdayStatus, setMemberBirthdayStatus] =
    useState<LoadStatus>("loading");
  const [leaderDashboard, setLeaderDashboard] = useState<LeaderDashboardResponse | null>(null);
  const [leaderStatus, setLeaderStatus] = useState<LoadStatus>("ready");
  const [leaderErrorMessage, setLeaderErrorMessage] = useState("");
  const [activeView, setActiveView] = useState<DashboardView>("my");
  const [showIntro, setShowIntro] = useState(false);
  const [isIntroExiting, setIsIntroExiting] = useState(false);
  const canViewLeaderDashboard =
    role === "super_admin" || role === "admin" || role === "leader";
  const visibleView = canViewLeaderDashboard ? activeView : "my";

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

  const loadCustomerBirthdays = useCallback(async () => {
    setCustomerBirthdayStatus("loading");

    try {
      const response = await fetch("/api/dashboard/customer-birthdays", {
        cache: "no-store",
      });
      const payload = (await response.json()) as
        | BirthdayReminderResponse<CustomerDashboardBirthday>
        | { error?: string };

      if (!response.ok) {
        throw new Error("Unable to load customer birthdays");
      }

      setCustomerBirthdays({
        today: "today" in payload ? payload.today ?? [] : [],
        upcoming: "upcoming" in payload ? payload.upcoming ?? [] : [],
      });
      setCustomerBirthdayStatus("ready");
    } catch {
      setCustomerBirthdays({ today: [], upcoming: [] });
      setCustomerBirthdayStatus("error");
    }
  }, []);

  const loadMemberBirthdays = useCallback(async () => {
    setMemberBirthdayStatus("loading");

    try {
      const response = await fetch("/api/dashboard/birthdays", {
        cache: "no-store",
      });
      const payload = (await response.json()) as
        | BirthdayReminderResponse<MemberDashboardBirthday>
        | { error?: string };

      if (!response.ok) {
        throw new Error("Unable to load member birthdays");
      }

      setMemberBirthdays({
        today: "today" in payload ? payload.today ?? [] : [],
        upcoming: "upcoming" in payload ? payload.upcoming ?? [] : [],
      });
      setMemberBirthdayStatus("ready");
    } catch {
      setMemberBirthdays({ today: [], upcoming: [] });
      setMemberBirthdayStatus("error");
    }
  }, []);

  const loadLeaderDashboard = useCallback(async () => {
    setLeaderStatus("loading");
    setLeaderErrorMessage("");

    try {
      const response = await fetch("/api/dashboard/leader", {
        cache: "no-store",
      });
      const payload = (await response.json()) as LeaderDashboardResponse | { error?: string };

      if (!response.ok) {
        throw new Error(
          "error" in payload && payload.error
            ? payload.error
            : "Unable to load team dashboard",
        );
      }

      setLeaderDashboard(payload as LeaderDashboardResponse);
      setLeaderStatus("ready");
    } catch (error) {
      setLeaderStatus("error");
      setLeaderErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load team dashboard. Please try again.",
      );
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadDashboard();
      void loadCustomerBirthdays();
      void loadMemberBirthdays();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadCustomerBirthdays, loadDashboard, loadMemberBirthdays]);

  useEffect(() => {
    if (visibleView !== "team") {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      void loadLeaderDashboard();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadLeaderDashboard, visibleView]);

  useEffect(() => {
    const timeoutIds: number[] = [];

    try {
      if (window.sessionStorage.getItem(introAfterLoginSessionKey) !== "true") {
        return undefined;
      }

      window.sessionStorage.removeItem(introAfterLoginSessionKey);
    } catch {
      return undefined;
    }

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const totalDuration = prefersReducedMotion ? 800 : 5000;
    const fadeDuration = prefersReducedMotion ? 180 : 450;

    timeoutIds.push(
      window.setTimeout(() => {
        setShowIntro(true);
      }, 0),
      window.setTimeout(() => {
        setIsIntroExiting(true);
      }, totalDuration - fadeDuration),
      window.setTimeout(() => {
        setShowIntro(false);
        setIsIntroExiting(false);
      }, totalDuration),
    );

    return () => {
      timeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId));
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

  if (showIntro) {
    return <FalconIntroOverlay isExiting={isIntroExiting} onSkip={dismissIntro} />;
  }

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
      <div className="mx-auto max-w-6xl space-y-5">
        <section className="rounded-[24px] border border-zinc-200 bg-white px-5 py-4 shadow-[0_12px_34px_rgba(15,23,42,0.04)] sm:px-6">
          <p className="text-sm font-medium text-zinc-500">
            {formatMalaysiaDate(dashboard.date)}
          </p>
          <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-zinc-950 sm:text-3xl">
                {greeting}, {dashboard.user.memberName}
              </h1>
              <p className="mt-1.5 text-sm text-zinc-600">
                {visibleView === "team"
                  ? "Here's what is happening in your team today."
                  : "Here's where you are today."}
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:justify-end">
              {canViewLeaderDashboard ? (
                <div className="grid w-full grid-cols-2 gap-1 rounded-full border border-zinc-200 bg-zinc-100 p-1 sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setActiveView("my")}
                    className={`min-h-10 rounded-full border px-4 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 ${
                      activeView === "my"
                        ? "border-zinc-950 bg-zinc-950 text-white shadow-sm"
                        : "border-zinc-200 bg-white text-zinc-800 hover:border-zinc-300 hover:bg-zinc-50"
                    }`}
                  >
                    My Dashboard
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveView("team")}
                    className={`min-h-10 rounded-full border px-4 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 ${
                      activeView === "team"
                        ? "border-zinc-950 bg-zinc-950 text-white shadow-sm"
                        : "border-zinc-200 bg-white text-zinc-800 hover:border-zinc-300 hover:bg-zinc-50"
                    }`}
                  >
                    Team Dashboard
                  </button>
                </div>
              ) : null}
              {dashboard.user.position ? (
                <span className="max-w-full break-words rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-600 sm:w-fit">
                  {dashboard.user.position}
                </span>
              ) : null}
            </div>
          </div>
        </section>

        {visibleView === "team" ? (
          <TeamDashboard
            dashboard={leaderDashboard}
            status={leaderStatus}
            errorMessage={leaderErrorMessage}
            onRetry={() => void loadLeaderDashboard()}
          />
        ) : (
          <>
        {status === "error" ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {errorMessage}
          </div>
        ) : null}

        <section>
          <div className={sectionHeaderClass}>
            <p className="text-sm font-semibold text-zinc-900">Today</p>
            <p className="text-sm text-zinc-500">Your daily operating status</p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <article className={dashboardCardClass}>
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

            <article className={dashboardCardClass}>
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
                  <div className="rounded-2xl border border-zinc-100 bg-[#F8F6F0] p-3">
                    <p className="text-zinc-500">New Leads</p>
                    <p className="mt-1 text-lg font-semibold text-zinc-950">
                      {dashboard.todayDsi.newLeadsContact}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-zinc-100 bg-[#F8F6F0] p-3">
                    <p className="text-zinc-500">Appointment Made</p>
                    <p className="mt-1 text-lg font-semibold text-zinc-950">
                      {dashboard.todayDsi.appointmentMade}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-zinc-100 bg-[#F8F6F0] p-3">
                    <p className="text-zinc-500">Turn Up</p>
                    <p className="mt-1 text-lg font-semibold text-zinc-950">
                      {dashboard.todayDsi.turnUpAppt}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-zinc-100 bg-[#F8F6F0] p-3">
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

        <UpcomingEventsCard upcomingEvents={dashboard.upcomingEvents} today={dashboard.date} />

        <BirthdaySection
          customerBirthdays={customerBirthdays}
          customerStatus={customerBirthdayStatus}
          memberBirthdays={memberBirthdays}
          memberStatus={memberBirthdayStatus}
        />

        <section className="lg:hidden">
          <div className={sectionHeaderClass}>
            <p className="text-sm font-semibold text-zinc-900">Quick Tools</p>
            <p className="text-sm text-zinc-500">Open the working sales tools</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {quickTools.map((tool) => (
              <Link
                key={tool.href}
                href={tool.href}
                className="flex min-h-28 flex-col justify-between rounded-[20px] border border-[#E5E2DA] bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-[#B8924A]/40 hover:bg-[#F8F6F0] focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2"
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
          <div className={sectionHeaderClass}>
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
          <article className={`${dashboardCardClass} hidden lg:block`}>
            <div>
              <p className="text-sm font-semibold text-zinc-900">Quick Tools</p>
              <p className="mt-1 text-sm text-zinc-500">Open the working sales tools</p>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2.5">
              {quickTools.map((tool) => (
                <Link
                  key={tool.href}
                  href={tool.href}
                  className="group flex min-h-28 flex-col justify-between rounded-2xl border border-[#E5E2DA] bg-[#F8F6F0] p-4 transition hover:-translate-y-0.5 hover:border-[#B8924A]/40 hover:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2"
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

          <article className={dashboardCardClass}>
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
              <p className={`${quietPanelClass} mt-4 px-4 py-3 text-sm text-zinc-500`}>
                No teammates are currently checked in.
              </p>
            ) : (
              <div className="mt-4 space-y-2">
                {dashboard.teamPresence.groups.map((group) => (
                  <div
                    key={group.locationName}
                    className={`${quietPanelClass} flex items-center justify-between gap-4 px-4 py-2.5`}
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
          </>
        )}
      </div>
    </main>
  );
}
