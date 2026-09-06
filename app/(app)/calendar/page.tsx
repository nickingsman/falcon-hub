"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getMalaysiaTodayDateString } from "@/lib/malaysia-date";
import { useAppPermissions } from "../components/AppPermissionProvider";

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
  canManage: boolean;
  canEdit: boolean;
  canDelete: boolean;
  createdAt: string;
  updatedAt: string;
};

type CalendarEventsResponse = {
  from: string;
  to: string;
  timezone: "Asia/Kuala_Lumpur";
  events: CalendarEvent[];
};

type CalendarMember = {
  id: string;
  full_name: string | null;
  position: string | null;
  status: string | null;
};

type MembersResponse = {
  members: CalendarMember[];
};

type CreateEventForm = {
  title: string;
  category: CalendarCategory | "";
  eventDate: string;
  audienceType: "company" | "team";
  targetTeamMemberId: string;
  isAllDay: boolean;
  startTime: string;
  endTime: string;
  location: string;
  description: string;
};

type LoadState = "loading" | "ready" | "error";
type MembersLoadState = "idle" | "loading" | "ready" | "error";

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

const calendarCategoryOptions = Object.entries(categoryLabels).map(([value, label]) => ({
  value: value as CalendarCategory,
  label,
}));

function createInitialEventForm(
  eventDate: string,
  canCreateCompanyEvents: boolean,
): CreateEventForm {
  return {
    title: "",
    category: "",
    eventDate,
    audienceType: canCreateCompanyEvents ? "company" : "team",
    targetTeamMemberId: "",
    isAllDay: true,
    startTime: "",
    endTime: "",
    location: "",
    description: "",
  };
}

function createEventFormFromEvent(
  event: CalendarEvent,
  canCreateCompanyEvents: boolean,
): CreateEventForm {
  return {
    title: event.title,
    category: event.category,
    eventDate: event.eventDate,
    audienceType: canCreateCompanyEvents ? event.audienceType : "team",
    targetTeamMemberId: event.targetTeam?.memberId ?? "",
    isAllDay: event.isAllDay,
    startTime: event.startTime ?? "",
    endTime: event.endTime ?? "",
    location: event.location ?? "",
    description: event.description ?? "",
  };
}

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

function validateCreateEventForm(form: CreateEventForm) {
  if (!form.title.trim()) return "Title is required";
  if (!form.category) return "Category is required";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.eventDate)) {
    return "Date is required";
  }
  if (form.audienceType !== "company" && form.audienceType !== "team") {
    return "Audience is required";
  }
  if (form.audienceType === "team" && !form.targetTeamMemberId) {
    return "Target Team is required";
  }
  if (!form.isAllDay) {
    if (!form.startTime || !form.endTime) {
      return "Timed events require Start Time and End Time";
    }
    if (form.endTime <= form.startTime) {
      return "End Time must be after Start Time";
    }
  }

  return null;
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
  onEdit,
  onDelete,
}: {
  event: CalendarEvent;
  onClose: () => void;
  onEdit: (event: CalendarEvent) => void;
  onDelete: (event: CalendarEvent) => void;
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

        {event.canManage ? (
          <div className="sticky bottom-0 flex flex-col-reverse gap-2 border-t border-zinc-100 bg-white p-5 sm:flex-row sm:justify-end sm:p-6">
            {event.canDelete ? (
              <button
                type="button"
                onClick={() => onDelete(event)}
                className="rounded-full border border-red-200 px-5 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-200"
              >
                Delete
              </button>
            ) : null}
            {event.canEdit ? (
              <button
                type="button"
                onClick={() => onEdit(event)}
                className="rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-400"
              >
                Edit
              </button>
            ) : null}
          </div>
        ) : null}
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

function CreateEventModal({
  form,
  formError,
  isSubmitting,
  members,
  membersLoadState,
  canCreateCompanyEvents,
  eyebrow,
  title,
  submitLabel,
  submittingLabel,
  onClose,
  onSubmit,
  onChange,
  onRetryMembers,
}: {
  form: CreateEventForm;
  formError: string | null;
  isSubmitting: boolean;
  members: CalendarMember[];
  membersLoadState: MembersLoadState;
  canCreateCompanyEvents: boolean;
  eyebrow: string;
  title: string;
  submitLabel: string;
  submittingLabel: string;
  onClose: () => void;
  onSubmit: () => void;
  onChange: (nextForm: CreateEventForm) => void;
  onRetryMembers: () => void;
}) {
  const showTeamTarget = form.audienceType === "team";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/40 px-4 py-6 sm:items-center">
      <div className="flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-zinc-100 bg-white p-5 sm:p-6">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#087F6B]">
              {eyebrow}
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-full border border-zinc-200 px-3 py-1.5 text-sm font-semibold text-zinc-600 transition hover:bg-zinc-50 hover:text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Close
          </button>
        </div>

        <div className="overflow-y-auto p-5 sm:p-6">
          {formError ? (
            <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {formError}
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className="text-sm font-semibold text-zinc-700">Title</span>
              <input
                value={form.title}
                onChange={(event) => onChange({ ...form, title: event.target.value })}
                className="mt-2 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-medium text-zinc-950 outline-none transition focus:border-zinc-400 focus:bg-white"
                placeholder="Weekly team meeting"
                maxLength={120}
              />
            </label>

            <label>
              <span className="text-sm font-semibold text-zinc-700">Category</span>
              <select
                value={form.category}
                onChange={(event) =>
                  onChange({ ...form, category: event.target.value as CalendarCategory | "" })
                }
                className="mt-2 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-medium text-zinc-950 outline-none transition focus:border-zinc-400 focus:bg-white"
              >
                <option value="">Select category</option>
                {calendarCategoryOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="text-sm font-semibold text-zinc-700">Date</span>
              <input
                type="date"
                value={form.eventDate}
                onChange={(event) => onChange({ ...form, eventDate: event.target.value })}
                className="mt-2 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-medium text-zinc-950 outline-none transition focus:border-zinc-400 focus:bg-white"
              />
            </label>

            <label>
              <span className="text-sm font-semibold text-zinc-700">Audience</span>
              <select
                value={form.audienceType}
                onChange={(event) =>
                  onChange({
                    ...form,
                    audienceType: event.target.value as CreateEventForm["audienceType"],
                    targetTeamMemberId:
                      event.target.value === "company" ? "" : form.targetTeamMemberId,
                  })
                }
                className="mt-2 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-medium text-zinc-950 outline-none transition focus:border-zinc-400 focus:bg-white"
              >
                {canCreateCompanyEvents ? <option value="company">Company</option> : null}
                <option value="team">Team</option>
              </select>
            </label>

            {showTeamTarget ? (
              <label>
                <span className="text-sm font-semibold text-zinc-700">Target Team</span>
                <select
                  value={form.targetTeamMemberId}
                  onChange={(event) =>
                    onChange({ ...form, targetTeamMemberId: event.target.value })
                  }
                  className="mt-2 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-medium text-zinc-950 outline-none transition focus:border-zinc-400 focus:bg-white"
                  disabled={membersLoadState === "loading"}
                >
                  <option value="">
                    {membersLoadState === "loading" ? "Loading teams..." : "Select target team"}
                  </option>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.full_name || "Unnamed member"}
                      {member.position ? ` · ${member.position}` : ""}
                    </option>
                  ))}
                </select>
                {membersLoadState === "error" ? (
                  <button
                    type="button"
                    onClick={onRetryMembers}
                    className="mt-2 text-xs font-semibold text-[#087F6B] transition hover:text-[#065f52]"
                  >
                    Retry loading teams
                  </button>
                ) : null}
              </label>
            ) : null}

            <label className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
              <input
                type="checkbox"
                checked={form.isAllDay}
                onChange={(event) =>
                  onChange({
                    ...form,
                    isAllDay: event.target.checked,
                    startTime: event.target.checked ? "" : form.startTime,
                    endTime: event.target.checked ? "" : form.endTime,
                  })
                }
                className="h-4 w-4 accent-[#087F6B]"
              />
              <span className="text-sm font-semibold text-zinc-700">All Day</span>
            </label>

            {!form.isAllDay ? (
              <>
                <label>
                  <span className="text-sm font-semibold text-zinc-700">Start Time</span>
                  <input
                    type="time"
                    value={form.startTime}
                    onChange={(event) => onChange({ ...form, startTime: event.target.value })}
                    className="mt-2 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-medium text-zinc-950 outline-none transition focus:border-zinc-400 focus:bg-white"
                  />
                </label>

                <label>
                  <span className="text-sm font-semibold text-zinc-700">End Time</span>
                  <input
                    type="time"
                    value={form.endTime}
                    onChange={(event) => onChange({ ...form, endTime: event.target.value })}
                    className="mt-2 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-medium text-zinc-950 outline-none transition focus:border-zinc-400 focus:bg-white"
                  />
                </label>
              </>
            ) : null}

            <label className="sm:col-span-2">
              <span className="text-sm font-semibold text-zinc-700">Location</span>
              <input
                value={form.location}
                onChange={(event) => onChange({ ...form, location: event.target.value })}
                className="mt-2 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-medium text-zinc-950 outline-none transition focus:border-zinc-400 focus:bg-white"
                placeholder="Falcon office"
                maxLength={160}
              />
            </label>

            <label className="sm:col-span-2">
              <span className="text-sm font-semibold text-zinc-700">Description</span>
              <textarea
                value={form.description}
                onChange={(event) => onChange({ ...form, description: event.target.value })}
                className="mt-2 min-h-28 w-full resize-y rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-medium leading-6 text-zinc-950 outline-none transition focus:border-zinc-400 focus:bg-white"
                placeholder="Optional notes for the team"
                maxLength={1200}
              />
            </label>
          </div>
        </div>

        <div className="sticky bottom-0 flex flex-col-reverse gap-2 border-t border-zinc-100 bg-white p-5 sm:flex-row sm:justify-end sm:p-6">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-full border border-zinc-200 px-5 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={isSubmitting || (showTeamTarget && membersLoadState === "loading")}
            className="rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? submittingLabel : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteEventModal({
  event,
  isDeleting,
  error,
  onCancel,
  onConfirm,
}: {
  event: CalendarEvent;
  isDeleting: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-zinc-950/40 px-4 py-6 sm:items-center">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-red-700">
          Delete Event
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">
          Delete this event?
        </h2>
        <p className="mt-3 text-sm leading-6 text-zinc-500">
          This event will be removed from the Falcon Calendar.
        </p>
        <div className="mt-5 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
          <p className="font-semibold text-zinc-950">{event.title}</p>
          <p className="mt-1 text-sm text-zinc-500">{formatDisplayDate(event.eventDate)}</p>
        </div>
        {error ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        ) : null}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="rounded-full border border-zinc-200 px-5 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="rounded-full bg-red-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isDeleting ? "Deleting..." : "Delete Event"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CalendarPage() {
  const { role } = useAppPermissions();
  const today = useMemo(() => getMalaysiaTodayDateString(), []);
  const canCreateEvents = role === "super_admin" || role === "admin" || role === "leader";
  const canCreateCompanyEvents = role === "super_admin" || role === "admin";
  const [monthKey, setMonthKey] = useState(() => getMonthKey(parseDate(today)));
  const [selectedDate, setSelectedDate] = useState(today);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState(() =>
    createInitialEventForm(today, canCreateCompanyEvents),
  );
  const [createError, setCreateError] = useState<string | null>(null);
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [editForm, setEditForm] = useState(() =>
    createInitialEventForm(today, canCreateCompanyEvents),
  );
  const [editError, setEditError] = useState<string | null>(null);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [deletingEvent, setDeletingEvent] = useState<CalendarEvent | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [targetMembers, setTargetMembers] = useState<CalendarMember[]>([]);
  const [membersLoadState, setMembersLoadState] = useState<MembersLoadState>("idle");

  const visibleDays = useMemo(() => getVisibleCalendarDays(monthKey), [monthKey]);
  const visibleFrom = visibleDays[0]?.dateKey ?? getMonthStart(monthKey);
  const visibleTo = visibleDays[visibleDays.length - 1]?.dateKey ?? getMonthStart(monthKey);
  const eventsByDate = useMemo(() => groupEventsByDate(events), [events]);
  const selectedDateEvents = eventsByDate.get(selectedDate) ?? [];

  const loadTargetMembers = useCallback(async () => {
    setMembersLoadState("loading");

    try {
      const response = await fetch("/api/members", { cache: "no-store" });
      const data = (await response.json()) as Partial<MembersResponse> & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error || "Unable to load teams");
      }

      setTargetMembers(
        Array.isArray(data.members)
          ? data.members.filter((member) => member.status === "Active")
          : [],
      );
      setMembersLoadState("ready");
    } catch {
      setTargetMembers([]);
      setMembersLoadState("error");
    }
  }, []);

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

  useEffect(() => {
    if (!showCreateModal && !editingEvent) return;
    if (membersLoadState !== "idle") return;

    void loadTargetMembers();
  }, [editingEvent, loadTargetMembers, membersLoadState, showCreateModal]);

  function goToToday() {
    setMonthKey(getMonthKey(parseDate(today)));
    setSelectedDate(today);
  }

  function openCreateModal() {
    setCreateForm(createInitialEventForm(selectedDate, canCreateCompanyEvents));
    setCreateError(null);
    setShowCreateModal(true);
  }

  function closeCreateModal() {
    if (isSubmittingCreate) return;

    setShowCreateModal(false);
    setCreateError(null);
    setCreateForm(createInitialEventForm(selectedDate, canCreateCompanyEvents));
  }

  function openEditModal(event: CalendarEvent) {
    setSelectedEvent(null);
    setEditingEvent(event);
    setEditForm(createEventFormFromEvent(event, canCreateCompanyEvents));
    setEditError(null);
  }

  function closeEditModal() {
    if (isSubmittingEdit) return;

    setEditingEvent(null);
    setEditError(null);
    setEditForm(createInitialEventForm(selectedDate, canCreateCompanyEvents));
  }

  function openDeleteModal(event: CalendarEvent) {
    setDeleteError(null);
    setDeletingEvent(event);
  }

  function closeDeleteModal() {
    if (isDeleting) return;

    setDeletingEvent(null);
    setDeleteError(null);
  }

  async function submitCreateEvent() {
    const validationError = validateCreateEventForm(createForm);

    if (validationError) {
      setCreateError(validationError);
      return;
    }

    setIsSubmittingCreate(true);
    setCreateError(null);

    try {
      const response = await fetch("/api/calendar/events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: createForm.title.trim(),
          category: createForm.category,
          eventDate: createForm.eventDate,
          isAllDay: createForm.isAllDay,
          startTime: createForm.isAllDay ? null : createForm.startTime,
          endTime: createForm.isAllDay ? null : createForm.endTime,
          location: createForm.location.trim() || null,
          description: createForm.description.trim() || null,
          audienceType: createForm.audienceType,
          targetTeamMemberId:
            createForm.audienceType === "team" ? createForm.targetTeamMemberId : null,
        }),
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error("You do not have permission to create this event.");
        }

        throw new Error(data.error || "Unable to create event");
      }

      setShowCreateModal(false);
      setCreateForm(createInitialEventForm(selectedDate, canCreateCompanyEvents));
      await loadEvents();
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Unable to create event");
    } finally {
      setIsSubmittingCreate(false);
    }
  }

  async function submitEditEvent() {
    if (!editingEvent) return;

    const validationError = validateCreateEventForm(editForm);

    if (validationError) {
      setEditError(validationError);
      return;
    }

    setIsSubmittingEdit(true);
    setEditError(null);

    try {
      const response = await fetch(`/api/calendar/events/${editingEvent.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: editForm.title.trim(),
          category: editForm.category,
          eventDate: editForm.eventDate,
          isAllDay: editForm.isAllDay,
          startTime: editForm.isAllDay ? null : editForm.startTime,
          endTime: editForm.isAllDay ? null : editForm.endTime,
          location: editForm.location.trim() || null,
          description: editForm.description.trim() || null,
          audienceType: editForm.audienceType,
          targetTeamMemberId:
            editForm.audienceType === "team" ? editForm.targetTeamMemberId : null,
        }),
      });
      const data = (await response.json()) as { error?: string; event?: CalendarEvent };

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error("You do not have permission to edit this event.");
        }

        throw new Error(data.error || "Unable to update event");
      }

      setEditingEvent(null);
      setSelectedEvent(data.event ?? null);
      setEditForm(createInitialEventForm(selectedDate, canCreateCompanyEvents));
      await loadEvents();
    } catch (error) {
      setEditError(error instanceof Error ? error.message : "Unable to update event");
    } finally {
      setIsSubmittingEdit(false);
    }
  }

  async function confirmDeleteEvent() {
    if (!deletingEvent) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      const response = await fetch(`/api/calendar/events/${deletingEvent.id}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error("You do not have permission to delete this event.");
        }

        throw new Error(data.error || "Unable to delete event");
      }

      setDeletingEvent(null);
      setSelectedEvent(null);
      await loadEvents();
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Unable to delete event");
    } finally {
      setIsDeleting(false);
    }
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
            {canCreateEvents ? (
              <button
                type="button"
                onClick={openCreateModal}
                className="rounded-full bg-[#087F6B] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#066b5b] focus:outline-none focus:ring-2 focus:ring-[#087F6B]/30"
              >
                Add Event
              </button>
            ) : null}
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
        <EventDetailModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onEdit={openEditModal}
          onDelete={openDeleteModal}
        />
      ) : null}

      {showCreateModal ? (
        <CreateEventModal
          form={createForm}
          formError={createError}
          isSubmitting={isSubmittingCreate}
          members={targetMembers}
          membersLoadState={membersLoadState}
          canCreateCompanyEvents={canCreateCompanyEvents}
          eyebrow="Add Event"
          title="Create Calendar Event"
          submitLabel="Create Event"
          submittingLabel="Creating..."
          onClose={closeCreateModal}
          onSubmit={submitCreateEvent}
          onChange={(nextForm) => {
            setCreateForm(nextForm);
            setCreateError(null);
          }}
          onRetryMembers={loadTargetMembers}
        />
      ) : null}

      {editingEvent ? (
        <CreateEventModal
          form={editForm}
          formError={editError}
          isSubmitting={isSubmittingEdit}
          members={targetMembers}
          membersLoadState={membersLoadState}
          canCreateCompanyEvents={canCreateCompanyEvents}
          eyebrow="Edit Event"
          title="Update Calendar Event"
          submitLabel="Save Changes"
          submittingLabel="Saving..."
          onClose={closeEditModal}
          onSubmit={submitEditEvent}
          onChange={(nextForm) => {
            setEditForm(nextForm);
            setEditError(null);
          }}
          onRetryMembers={loadTargetMembers}
        />
      ) : null}

      {deletingEvent ? (
        <DeleteEventModal
          event={deletingEvent}
          isDeleting={isDeleting}
          error={deleteError}
          onCancel={closeDeleteModal}
          onConfirm={confirmDeleteEvent}
        />
      ) : null}
    </main>
  );
}
