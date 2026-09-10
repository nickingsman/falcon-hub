import { NextResponse } from "next/server";
import { getAuthenticatedUserProfile } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

const malaysiaTimeZone = "Asia/Kuala_Lumpur";
const upcomingWindowDays = 30;
const millisecondsPerDay = 24 * 60 * 60 * 1000;

type CustomerBirthdayRow = {
  customer_name: string;
  project: string | null;
  unit: string | null;
  birthday: string;
};

type SafeCustomerBirthday = {
  customerName: string;
  project: string | null;
  unit: string | null;
  month: number;
  day: number;
  daysUntil: number;
};

function getTodayParts() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: malaysiaTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(new Date());
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);

  return { year, month, day };
}

function parseBirthdayParts(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) return null;

  return { month, day };
}

function isLeapYear(year: number) {
  return year % 400 === 0 || (year % 4 === 0 && year % 100 !== 0);
}

function isValidMonthDay(year: number, month: number, day: number) {
  if (month === 2 && day === 29) {
    return isLeapYear(year);
  }

  const date = new Date(Date.UTC(year, month - 1, day));

  return date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function getNextBirthdayDate(
  currentYear: number,
  currentMonth: number,
  currentDay: number,
  birthMonth: number,
  birthDay: number,
) {
  let candidateYear = currentYear;

  while (!isValidMonthDay(candidateYear, birthMonth, birthDay)) {
    candidateYear += 1;
  }

  let candidateDate = new Date(Date.UTC(candidateYear, birthMonth - 1, birthDay));
  const todayDate = new Date(Date.UTC(currentYear, currentMonth - 1, currentDay));

  if (candidateDate.getTime() < todayDate.getTime()) {
    candidateYear += 1;

    while (!isValidMonthDay(candidateYear, birthMonth, birthDay)) {
      candidateYear += 1;
    }

    candidateDate = new Date(Date.UTC(candidateYear, birthMonth - 1, birthDay));
  }

  return candidateDate;
}

function toSafeCustomerBirthday(
  row: CustomerBirthdayRow,
  month: number,
  day: number,
  daysUntil: number,
): SafeCustomerBirthday {
  return {
    customerName: row.customer_name,
    project: row.project,
    unit: row.unit,
    month,
    day,
    daysUntil,
  };
}

function unauthorized() {
  return NextResponse.json({ error: "Authentication required" }, { status: 401 });
}

function forbidden() {
  return NextResponse.json({ error: "Active user profile is required" }, { status: 403 });
}

function serverError() {
  return NextResponse.json(
    { error: "Unable to load customer birthday reminders" },
    { status: 500 },
  );
}

export const dynamic = "force-dynamic";

export async function GET() {
  const authContext = await getAuthenticatedUserProfile();

  if (!authContext) {
    return unauthorized();
  }

  if (!authContext.profile || authContext.profile.status !== "active") {
    return forbidden();
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("customer_birthdays")
      .select("customer_name, project, unit, birthday")
      .eq("owner_user_id", authContext.user.id)
      .eq("is_deleted", false)
      .order("customer_name", { ascending: true });

    if (error) {
      throw error;
    }

    const todayParts = getTodayParts();
    const todayDate = new Date(
      Date.UTC(todayParts.year, todayParts.month - 1, todayParts.day),
    );
    const today: SafeCustomerBirthday[] = [];
    const upcoming: SafeCustomerBirthday[] = [];

    for (const row of (data ?? []) as CustomerBirthdayRow[]) {
      const birthdayParts = parseBirthdayParts(row.birthday);

      if (!birthdayParts) continue;

      const nextBirthdayDate = getNextBirthdayDate(
        todayParts.year,
        todayParts.month,
        todayParts.day,
        birthdayParts.month,
        birthdayParts.day,
      );
      const daysUntil = Math.round(
        (nextBirthdayDate.getTime() - todayDate.getTime()) / millisecondsPerDay,
      );
      const safeBirthday = toSafeCustomerBirthday(
        row,
        birthdayParts.month,
        birthdayParts.day,
        daysUntil,
      );

      if (daysUntil === 0) {
        today.push(safeBirthday);
      } else if (daysUntil > 0 && daysUntil <= upcomingWindowDays) {
        upcoming.push(safeBirthday);
      }
    }

    today.sort((a, b) => a.customerName.localeCompare(b.customerName));
    upcoming.sort((a, b) => {
      if (a.daysUntil !== b.daysUntil) return a.daysUntil - b.daysUntil;

      return a.customerName.localeCompare(b.customerName);
    });

    return NextResponse.json({ today, upcoming });
  } catch (error) {
    console.error("GET /api/dashboard/customer-birthdays error:", error);

    return serverError();
  }
}
