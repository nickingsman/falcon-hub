const malaysiaTimeZone = "Asia/Kuala_Lumpur";

function getMalaysiaDateParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: malaysiaTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);

  return {
    year: Number(parts.find((part) => part.type === "year")?.value),
    month: Number(parts.find((part) => part.type === "month")?.value),
    day: Number(parts.find((part) => part.type === "day")?.value),
  };
}

function formatDateParts(year: number, month: number, day: number) {
  return `${year.toString().padStart(4, "0")}-${month
    .toString()
    .padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

function parseDateString(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

export function addCalendarDays(value: string, days: number) {
  const date = parseDateString(value);
  date.setUTCDate(date.getUTCDate() + days);

  return formatDateParts(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
  );
}

export function getInclusiveDateRange(from: string, to: string) {
  const dates: string[] = [];
  let current = from;

  while (current <= to) {
    dates.push(current);
    current = addCalendarDays(current, 1);
  }

  return dates;
}

export function getInclusiveDayCount(from: string, to: string) {
  const fromDate = parseDateString(from);
  const toDate = parseDateString(to);
  const millisecondsPerDay = 24 * 60 * 60 * 1000;

  return Math.floor((toDate.getTime() - fromDate.getTime()) / millisecondsPerDay) + 1;
}

export function getMalaysiaTodayDateString() {
  const { year, month, day } = getMalaysiaDateParts();

  return formatDateParts(year, month, day);
}

export function getMalaysiaYesterdayDateString() {
  const { year, month, day } = getMalaysiaDateParts();
  const todayUtc = new Date(Date.UTC(year, month - 1, day));
  todayUtc.setUTCDate(todayUtc.getUTCDate() - 1);

  return formatDateParts(
    todayUtc.getUTCFullYear(),
    todayUtc.getUTCMonth() + 1,
    todayUtc.getUTCDate(),
  );
}

export function isValidDateString(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const parsed = new Date(`${value}T00:00:00.000Z`);

  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function getMalaysiaThisWeekRange() {
  const today = getMalaysiaTodayDateString();
  const date = parseDateString(today);
  const dayOfWeek = date.getUTCDay();
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const from = addCalendarDays(today, -daysFromMonday);

  return { from, to: today };
}

export function getMalaysiaLastWeekRange() {
  const { from: thisWeekFrom } = getMalaysiaThisWeekRange();
  const from = addCalendarDays(thisWeekFrom, -7);
  const to = addCalendarDays(thisWeekFrom, -1);

  return { from, to };
}

export function getMalaysiaThisMonthRange() {
  const today = getMalaysiaTodayDateString();
  const { year, month } = getMalaysiaDateParts();

  return {
    from: formatDateParts(year, month, 1),
    to: today,
  };
}
