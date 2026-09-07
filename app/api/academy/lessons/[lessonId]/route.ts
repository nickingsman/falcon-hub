import {
  deleteAcademyLesson,
  getAcademyLesson,
  updateAcademyLesson,
} from "@/app/api/academy/academy-service";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ lessonId: string }> },
) {
  const { lessonId } = await params;

  return getAcademyLesson(lessonId);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ lessonId: string }> },
) {
  const { lessonId } = await params;

  return updateAcademyLesson(lessonId, request);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ lessonId: string }> },
) {
  const { lessonId } = await params;

  return deleteAcademyLesson(lessonId);
}
