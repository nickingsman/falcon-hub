import { getOwnDsiHistory } from "@/app/api/dsi/dsi-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return getOwnDsiHistory(request);
}
