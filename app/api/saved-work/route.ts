import { createSavedWork, listSavedWork } from "@/app/api/saved-work/saved-work-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return listSavedWork(request);
}

export async function POST(request: Request) {
  return createSavedWork(request);
}
