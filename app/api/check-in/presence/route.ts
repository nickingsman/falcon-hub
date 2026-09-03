import { getTeamPresence } from "@/app/api/check-in/check-in-service";

export async function GET() {
  return getTeamPresence();
}
