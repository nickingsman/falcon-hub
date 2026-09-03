import {
  getOwnDsiForDate,
  upsertOwnDsiForDate,
} from "@/app/api/dsi/dsi-service";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ date: string }> },
) {
  const { date } = await params;

  return getOwnDsiForDate(date);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ date: string }> },
) {
  const { date } = await params;

  return upsertOwnDsiForDate(request, date);
}
