import {
  deleteSavedWork,
  getSavedWork,
  updateSavedWork,
} from "@/app/api/saved-work/saved-work-service";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  return getSavedWork(id);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  return updateSavedWork(request, id);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  return deleteSavedWork(id);
}
