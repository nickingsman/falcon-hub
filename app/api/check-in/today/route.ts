import { getOwnTodayAttendance } from "@/app/api/check-in/check-in-service";

export async function GET() {
  return getOwnTodayAttendance();
}
