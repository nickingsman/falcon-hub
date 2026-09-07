import { createAcademyLesson } from "@/app/api/academy/academy-service";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ courseId: string }> },
) {
  const { courseId } = await params;

  return createAcademyLesson(courseId, request);
}
