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
