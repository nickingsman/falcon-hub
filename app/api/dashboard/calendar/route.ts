import { NextResponse } from "next/server";
import {
  getDashboardUpcomingCalendarEventsForContext,
  requireCalendarAccess,
} from "@/app/api/calendar/calendar-service";

export async function GET() {
  const authorization = await requireCalendarAccess();

  if (!authorization.authorized) {
    return authorization.response;
  }

  try {
    const upcomingEvents = await getDashboardUpcomingCalendarEventsForContext(
      authorization.context,
    );

    return NextResponse.json(upcomingEvents);
  } catch (error) {
    console.error("GET /api/dashboard/calendar error:", error);

    return NextResponse.json(
      { error: "Unable to load upcoming Calendar events" },
      { status: 500 },
    );
  }
}
