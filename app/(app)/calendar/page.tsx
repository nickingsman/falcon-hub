"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getMalaysiaTodayDateString } from "@/lib/malaysia-date";

type CalendarCategory =
  | "company_meeting"
  | "team_meeting"
  | "training"
  | "roleplay"
  | "recognition_event"
  | "project_activity"
  | "other";

type CalendarEvent = {
  id: string;
  title: string;
  category: CalendarCategory;
  eventDate: string;
  isAllDay: boolean;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  description: string | null;
  audienceType: "company" | "team";
  targetTeam: {
    memberId: string;
    memberName: string;
    position: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
};

type CalendarEventsResponse = {
  from: string;
  to: string;
  timezone: "Asia/Kuala_Lumpur";
  events: CalendarEvent[];
};

type LoadState = "loading" | "ready" | "error";

const weekdayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const categoryLabels: Record<CalendarCategory, string> = {
  company_meeting: "Company Meeting",
  team_meeting: "Team Meeting",
  training: "Training",
  roleplay: "Roleplay",
  recognition_event: "Recognition / Event",
  project_activity: "Project Activity",
  other: "Other",
};

const categoryStyles: Record<CalendarCategory, string> = {
  company_meeting: "border-zinc-300 bg-zinc-100 text-zinc-800",
  team_meeting: "border-teal-200 bg-teal-50 text-teal-800",
  training: "border-blue-200 bg-blue-50 text-blue-800",
  roleplay: "border-violet-200 bg-violet-50 text-violet-800",
  recognition_event: "border-amber-200 bg-amber-50 text-amber-800",
  project_activity: "border-emerald-200 bg-emerald-50 text-emerald-800",
  other: "border-stone-200 bg-stone-50 text-stone-700",
};

function parseDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function toDateKey(date: Date) {
  return [
    date.getUTCFullYear().toString().padStart(4, "0"),
    (date.getUTCMonth() + 1).toString().padStart(2, "0"),
    date.getUTCDate().toString().padStart(2, "0"),
  ].join("-");
}

function addDays(value: string, days: number) {
  const date = parseDate(value);
  date.setUTCDate(date.getUTCDate() + days);

  return toDateKey(date);
}

function getMonthKey(date: Date) {
  return `${date.getUTCFullYear()}-${(date.getUTCMonth() + 1).toString().padStart(2, "0")}`;
}

function getMonthStart(monthKey: string) {
  return `${monthKey}-01`;
}

function getMonthLabel(monthKey: string) {
  return new Intl.DateTimeFormat("en-MY", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(parseDate(getMonthStart(monthKey)));
}

function shiftMonth(monthKey: string, offset: number) {
  const date = parseDate(getMonthStart(monthKey));
  date.setUTCMonth(date.getUTCMonth() + offset);

  return getMonthKey(date);
}

function getVisibleCalendarDays(monthKey: string) {
  const firstOfMonth = parseDate(getMonthStart(monthKey));
  const monthIndex = firstOfMonth.getUTCMonth();
  const dayOfWeek = firstOfMonth.getUTCDay();
  const leadingDays = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const firstGridDate = new Date(firstOfMonth);
  firstGridDate.setUTCDate(firstGridDate.getUTCDate() - leadingDays);

  const days: Array<{
    dateKey: string;
    dayNumber: number;
    isCurrentMonth: boolean;
  }> = [];

  for (let index = 0; index < 42; index += 1) {
    const date = new Date(firstGridDate);
    date.setUTCDate(firstGridDate.getUTCDate() + index);

    days.push({
      dateKey: toDateKey(date),
      dayNumber: date.getUTCDate(),
      isCurrentMonth: date.getUTCMonth() === monthIndex,
    });
  }

  const lastWeek = days.slice(-7);

  if (lastWeek.every((day) => !day.isCurrentMonth)) {
    return days.slice(0, -7);
  }

  return days;
}

function formatDisplayDate(value: string) {
  return new Intl.DateTimeFormat("en-MY", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(parseDate(value));
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("en-MY", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(parseDate(value));
}

function formatTime(value: string | null) {
  if (!value) return null;

  const [hours, minutes] = value.split(":");

  return `${hours}:${minutes}`;
}

function getEventTimeLabel(event: CalendarEvent) {
  if (event.isAllDay) return "ALL DAY";

  const start = formatTime(event.startTime);
  const end = formatTime(event.endTime);

  if (start && end) return `${start}-${end}`;

  return start ?? "Timed";
}

function getEventDetailTime(event: CalendarEvent) {
  if (event.isAllDay) return "All day";

  const start = formatTime(event.startTime);
  const end = formatTime(event.endTime);

  if (start && end) return `${start} to ${end}`;

  return start ?? "Timed event";
}

function groupEventsByDate(events: CalendarEvent[]) {
  const groups = new Map<string, CalendarEvent[]>();

  for (const event of events) {
    const dayEvents = groups.get(event.eventDate) ?? [];
    dayEvents.push(event);
    groups.set(event.eventDate, dayEvents);
  }

  return groups;
}

function EventChip({
  event,
  onClick,
}: {
  event: CalendarEvent;
  onClick: (event: CalendarEvent) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(event)}
      className={`w-full rounded-lg border px-2 py-1 text-left text-[11px] leading-tight transition hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-300 ${categoryStyles[event.category]}`}
    >
      <span className="block truncate">
        <span className="font-bold">{getEventTimeLabel(event)}</span>{" "}
        <span className="font-semibold">{event.title}</span>
      </span>
    </button>
  );
}

function EventAgendaItem({
  event,
  onClick,
}: {
  event: CalendarEvent;
  onClick: (event: CalendarEvent) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(event)}
      className="w-full rounded-2xl border border-zinc-200 bg-white p-4 text-left shadow-sm transition hover:border-zinc-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-zinc-300"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-bold uppercase text-zinc-700">
          {getEventTimeLabel(event)}
        </span>
        <span
          className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${categoryStyles[event.category]}`}
        >
          {categoryLabels[event.category]}
        </span>
      </div>
      <p className="mt-3 text-base font-semibold text-zinc-950">{event.title}</p>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-zinc-500">
        {event.location ? <span>{event.location}</span> : null}
        <span>{event.audienceType === "company" ? "Company" : "Team"}</span>
      </div>
    </button>
  );
}

function EventDetailModal({
  event,
  onClose,
}: {
  event: CalendarEvent;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/40 px-4 py-6 sm:items-center">
      <div className="flex max-h-[90dvh] w-full max-w-xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-zinc-100 bg-white p-5 sm:p-6">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#087F6B]">
              Calendar Event
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">
              {event.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-zinc-200 px-3 py-1.5 text-sm font-semibold text-zinc-600 transition hover:bg-zinc-50 hover:text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-300"
          >
            Close
          </button>
        </div>

        <div className="overflow-y-auto p-5 sm:p-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <DetailItem label="Date" value={formatDisplayDate(event.eventDate)} />
            <DetailItem label="Time" value={getEventDetailTime(event)} />
            <DetailItem label="Category" value={categoryLabels[event.category]} />
            <DetailItem label="Audience" value={event.audienceType === "company" ? "Company" : "Team"} />
            {event.location ? <DetailItem label="Location" value={event.location} /> : null}
            {event.targetTeam ? (
              <DetailItem label="Target Team" value={event.targetTeam.memberName} />
            ) : null}
          </div>

          {event.description ? (
            <div className="mt-5 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                Description
              </p>
              <p className="mt-2 whitespace-pre-line break-words text-sm leading-6 text-zinc-700">
                {event.description}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-zinc-950">{value}</p>
    </div>
  );
}

export default function CalendarPage() {
  const today = useMemo(() => getMalaysiaTodayDateString(), []);
  const [monthKey, setMonthKey] = useState(() => getMonthKey(parseDate(today)));
  const [selectedDate, setSelectedDate] = useState(today);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);

  const visibleDays = useMemo(() => getVisibleCalendarDays(monthKey), [monthKey]);
  const visibleFrom = visibleDays[0]?.dateKey ?? getMonthStart(monthKey);
  const visibleTo = visibleDays[visibleDays.length - 1]?.dateKey ?? getMonthStart(monthKey);
  const eventsByDate = useMemo(() => groupEventsByDate(events), [events]);
  const selectedDateEvents = eventsByDate.get(selectedDate) ?? [];

  const loadEvents = useCallback(async () => {
    setLoadState("loading");
    setErrorMessage(null);

    try {
      const params = new URLSearchParams({ from: visibleFrom, to: visibleTo });
      const response = await fetch(`/api/calendar/events?${params.toString()}`, {
        cache: "no-store",
      });
      const data = (await response.json()) as Partial<CalendarEventsResponse> & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error || "Unable to load calendar events");
      }

      setEvents(Array.isArray(data.events) ? data.events : []);
      setLoadState("ready");
    } catch (error) {
      setLoadState("error");
      setEvents([]);
      setErrorMessage(error instanceof Error ? error.message : "Unable to load calendar events");
    }
  }, [visibleFrom, visibleTo]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    if (!selectedDate.startsWith(monthKey)) {
      const monthToday = today.startsWith(monthKey) ? today : getMonthStart(monthKey);
      setSelectedDate(monthToday);
    }
  }, [monthKey, selectedDate, today]);

  function goToToday() {
    setMonthKey(getMonthKey(parseDate(today)));
    setSelectedDate(today);
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <section className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-[0_12px_36px_rgba(15,23,42,0.05)] sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#087F6B]">
              {getMonthLabel(monthKey)}
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">
              Calendar
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
              Team schedules, meetings and important Falcon dates.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setMonthKey((value) => shiftMonth(value, -1))}
              className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-300"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={goToToday}
              className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-400"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setMonthKey((value) => shiftMonth(value, 1))}
              className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-300"
            >
              Next
            </button>
          </div>
        </div>
      </section>

      {loadState === "error" ? (
        <section className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p>{errorMessage || "Unable to load calendar events."}</p>
            <button
              type="button"
              onClick={() => void loadEvents()}
              className="rounded-full border border-red-200 bg-white px-4 py-2 font-semibold text-red-700 transition hover:bg-red-50"
            >
              Retry
            </button>
          </div>
        </section>
      ) : null}

      <section className="hidden overflow-hidden rounded-[28px] border border-zinc-200 bg-white shadow-[0_12px_36px_rgba(15,23,42,0.04)] lg:block">
        <div className="grid grid-cols-7 border-b border-zinc-200 bg-zinc-50">
          {weekdayLabels.map((label) => (
            <div
              key={label}
              className="border-r border-zinc-200 px-3 py-3 text-center text-xs font-bold uppercase tracking-[0.14em] text-zinc-500 last:border-r-0"
            >
              {label}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {visibleDays.map((day) => {
            const dayEvents = eventsByDate.get(day.dateKey) ?? [];
            const visibleEvents = dayEvents.slice(0, 3);
            const hiddenCount = Math.max(dayEvents.length - visibleEvents.length, 0);
            const isToday = day.dateKey === today;

            return (
              <div
                key={day.dateKey}
                className={`min-h-36 border-r border-b border-zinc-200 p-3 last:border-r-0 ${
                  day.isCurrentMonth ? "bg-white" : "bg-zinc-50/80"
                }`}
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span
                    className={`flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-sm font-semibold ${
                      isToday
                        ? "bg-[#087F6B] text-white"
                        : day.isCurrentMonth
                          ? "text-zinc-900"
                          : "text-zinc-400"
                    }`}
                  >
                    {day.dayNumber}
                  </span>
                  {dayEvents.length ? (
                    <span className="text-xs font-medium text-zinc-400">
                      {dayEvents.length}
                    </span>
                  ) : null}
                </div>

                <div className="space-y-1.5">
                  {loadState === "loading" ? (
                    <div className="h-6 rounded-lg bg-zinc-100" />
                  ) : (
                    visibleEvents.map((event) => (
                      <EventChip key={event.id} event={event} onClick={setSelectedEvent} />
                    ))
                  )}
                  {hiddenCount > 0 ? (
                    <button
                      type="button"
                      onClick={() => setExpandedDate(day.dateKey)}
                      className="text-xs font-semibold text-zinc-500 transition hover:text-zinc-900"
                    >
                      +{hiddenCount} more
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="grid gap-5 lg:hidden">
        <div className="rounded-[28px] border border-zinc-200 bg-white p-4 shadow-[0_12px_36px_rgba(15,23,42,0.04)]">
          <div className="grid grid-cols-7 gap-1 text-center">
            {weekdayLabels.map((label) => (
              <div key={label} className="py-2 text-[11px] font-bold uppercase text-zinc-400">
                {label}
              </div>
            ))}
            {visibleDays.map((day) => {
              const dayEvents = eventsByDate.get(day.dateKey) ?? [];
              const isSelected = selectedDate === day.dateKey;
              const isToday = day.dateKey === today;

              return (
                <button
                  key={day.dateKey}
                  type="button"
                  onClick={() => setSelectedDate(day.dateKey)}
                  className={`relative flex aspect-square items-center justify-center rounded-2xl text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-zinc-300 ${
                    isSelected
                      ? "bg-zinc-900 text-white"
                      : isToday
                        ? "bg-[#f1fbf8] text-[#087F6B]"
                        : day.isCurrentMonth
                          ? "text-zinc-900 hover:bg-zinc-100"
                          : "text-zinc-400 hover:bg-zinc-50"
                  }`}
                >
                  {day.dayNumber}
                  {dayEvents.length ? (
                    <span
                      className={`absolute bottom-2 h-1.5 w-1.5 rounded-full ${
                        isSelected ? "bg-white" : "bg-[#087F6B]"
                      }`}
                    />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-[28px] border border-zinc-200 bg-zinc-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                Selected Date
              </p>
              <h2 className="mt-1 text-lg font-semibold text-zinc-950">
                {formatDisplayDate(selectedDate)}
              </h2>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-zinc-600">
              {selectedDateEvents.length} event{selectedDateEvents.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="mt-4 space-y-3">
            {loadState === "loading" ? (
              <>
                <div className="h-24 rounded-2xl bg-white" />
                <div className="h-24 rounded-2xl bg-white" />
              </>
            ) : selectedDateEvents.length ? (
              selectedDateEvents.map((event) => (
                <EventAgendaItem key={event.id} event={event} onClick={setSelectedEvent} />
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-zinc-200 bg-white p-5 text-sm text-zinc-500">
                No events for this date.
              </div>
            )}
          </div>
        </div>
      </section>

      {loadState === "ready" && events.length === 0 ? (
        <section className="rounded-[28px] border border-dashed border-zinc-200 bg-white p-8 text-center">
          <p className="text-lg font-semibold text-zinc-950">No events in this calendar range.</p>
          <p className="mt-2 text-sm text-zinc-500">
            Visible Falcon Calendar events will appear here when they are scheduled.
          </p>
        </section>
      ) : null}

      {expandedDate ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-zinc-950/40 px-4 py-6 sm:items-center">
          <div className="w-full max-w-lg rounded-3xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#087F6B]">
                  {formatShortDate(expandedDate)}
                </p>
                <h2 className="mt-1 text-xl font-semibold text-zinc-950">
                  {formatDisplayDate(expandedDate)}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setExpandedDate(null)}
                className="rounded-full border border-zinc-200 px-3 py-1.5 text-sm font-semibold text-zinc-600 transition hover:bg-zinc-50 hover:text-zinc-950"
              >
                Close
              </button>
            </div>
            <div className="mt-5 max-h-[60vh] space-y-3 overflow-y-auto">
              {(eventsByDate.get(expandedDate) ?? []).map((event) => (
                <EventAgendaItem key={event.id} event={event} onClick={setSelectedEvent} />
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {selectedEvent ? (
        <EventDetailModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
      ) : null}
    </main>
  );
}
