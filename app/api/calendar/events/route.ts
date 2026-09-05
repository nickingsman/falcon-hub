import {
  createCalendarEvent,
  getCalendarEvents,
} from "@/app/api/calendar/calendar-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return getCalendarEvents(request);
}

export async function POST(request: Request) {
  return createCalendarEvent(request);
}
