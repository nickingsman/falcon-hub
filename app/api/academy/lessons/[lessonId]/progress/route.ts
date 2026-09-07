import { updateAcademyLessonProgress } from "@/app/api/academy/academy-service";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ lessonId: string }> },
) {
  const { lessonId } = await params;

  return updateAcademyLessonProgress(lessonId, request);
}
