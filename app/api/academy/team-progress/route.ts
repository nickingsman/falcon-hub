import { getAcademyTeamProgress } from "@/app/api/academy/academy-service";

export const dynamic = "force-dynamic";

export async function GET() {
  return getAcademyTeamProgress();
}
