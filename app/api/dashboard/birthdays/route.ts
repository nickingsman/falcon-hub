import { NextResponse } from "next/server";
import { getAuthenticatedUserProfile } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import { getMemberDisplayName } from "@/lib/member-display";

const malaysiaTimeZone = "Asia/Kuala_Lumpur";
const upcomingWindowDays = 30;
const millisecondsPerDay = 24 * 60 * 60 * 1000;

type BirthdayMemberRow = {
  id: string;
  full_name: string | null;
  display_name: string | null;
  birthday: string | null;
  position: string | null;
};

type SafeBirthdayMember = {
  id: string;
  fullName: string;
  month: number;
  day: number;
  position: string | null;
};

type SafeUpcomingBirthdayMember = SafeBirthdayMember & {
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

function parseBirthdayParts(value: string | null) {
  if (!value) return null;

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
  birthDay: number
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

function toSafeBirthdayMember(
  member: BirthdayMemberRow,
  month: number,
  day: number
): SafeBirthdayMember {
  return {
    id: member.id,
    fullName: getMemberDisplayName(member),
    month,
    day,
    position: member.position,
  };
}

export async function GET() {
  const authContext = await getAuthenticatedUserProfile();

  if (!authContext) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  if (!authContext.profile || authContext.profile.status !== "active") {
    return NextResponse.json(
      { error: "Active user profile is required" },
      { status: 403 }
    );
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("users")
      .select("id, full_name, display_name, birthday, position")
      .eq("is_deleted", false)
      .eq("status", "Active")
      .not("birthday", "is", null)
      .order("full_name", { ascending: true });

    if (error) {
      throw error;
    }

    const todayParts = getTodayParts();
    const todayDate = new Date(
      Date.UTC(todayParts.year, todayParts.month - 1, todayParts.day)
    );
    const today: SafeBirthdayMember[] = [];
    const upcoming: SafeUpcomingBirthdayMember[] = [];

    for (const member of (data ?? []) as BirthdayMemberRow[]) {
      const birthdayParts = parseBirthdayParts(member.birthday);

      if (!birthdayParts) continue;

      const safeMember = toSafeBirthdayMember(
        member,
        birthdayParts.month,
        birthdayParts.day
      );

      if (
        birthdayParts.month === todayParts.month &&
        birthdayParts.day === todayParts.day
      ) {
        today.push(safeMember);
        continue;
      }

      const nextBirthdayDate = getNextBirthdayDate(
        todayParts.year,
        todayParts.month,
        todayParts.day,
        birthdayParts.month,
        birthdayParts.day
      );
      const daysUntil = Math.round(
        (nextBirthdayDate.getTime() - todayDate.getTime()) / millisecondsPerDay
      );

      if (daysUntil > 0 && daysUntil <= upcomingWindowDays) {
        upcoming.push({
          ...safeMember,
          daysUntil,
        });
      }
    }

    upcoming.sort((a, b) => {
      if (a.daysUntil !== b.daysUntil) {
        return a.daysUntil - b.daysUntil;
      }

      return a.fullName.localeCompare(b.fullName);
    });

    today.sort((a, b) => a.fullName.localeCompare(b.fullName));

    return NextResponse.json({
      today,
      upcoming,
    });
  } catch (error) {
    console.error("GET /api/dashboard/birthdays error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load birthday reminders",
      },
      { status: 500 }
    );
  }
}
