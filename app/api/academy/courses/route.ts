import {
  createAcademyCourse,
  listAcademyCourses,
} from "@/app/api/academy/academy-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return listAcademyCourses(request);
}

export async function POST(request: Request) {
  return createAcademyCourse(request);
}
