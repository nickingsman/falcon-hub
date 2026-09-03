import {
  getOwnDsiForDate,
  upsertOwnDsiForDate,
} from "@/app/api/dsi/dsi-service";
import { getMalaysiaTodayDateString } from "@/lib/malaysia-date";

export const dynamic = "force-dynamic";

export async function GET() {
  return getOwnDsiForDate(getMalaysiaTodayDateString());
}

export async function PUT(request: Request) {
  return upsertOwnDsiForDate(request, getMalaysiaTodayDateString());
}
