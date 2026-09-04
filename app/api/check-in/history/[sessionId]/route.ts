import { getAttendanceSessionAudit } from "@/app/api/check-in/check-in-service";

type RouteContext = {
  params: Promise<{ sessionId: string }>;
};

export async function GET(
  _request: Request,
  { params }: RouteContext,
) {
  const { sessionId } = await params;

  return getAttendanceSessionAudit(sessionId);
}
