import { getAttendanceHistory } from "@/app/api/check-in/check-in-service";

export async function GET(request: Request) {
  return getAttendanceHistory(request);
}
