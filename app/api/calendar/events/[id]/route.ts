import {
  deleteCalendarEvent,
  updateCalendarEvent,
} from "@/app/api/calendar/calendar-service";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  return updateCalendarEvent(request, id);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  return deleteCalendarEvent(id);
}
