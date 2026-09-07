import {
  deleteAcademyCourse,
  getAcademyCourse,
  getAcademyCourseForManagement,
  updateAcademyCourse,
} from "@/app/api/academy/academy-service";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ courseId: string }> },
) {
  const { courseId } = await params;
  const isManagementMode = new URL(request.url).searchParams.get("mode") === "management";

  return isManagementMode ? getAcademyCourseForManagement(courseId) : getAcademyCourse(courseId);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ courseId: string }> },
) {
  const { courseId } = await params;

  return updateAcademyCourse(courseId, request);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ courseId: string }> },
) {
  const { courseId } = await params;

  return deleteAcademyCourse(courseId);
}
