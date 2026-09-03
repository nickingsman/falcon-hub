import { checkIn } from "@/app/api/check-in/check-in-service";

export async function POST(request: Request) {
  return checkIn(request);
}
