import { archiveDiscussionItem, updateDiscussionItem } from "../../leader-meetings-service";

type Context = { params: Promise<{ itemId: string }> };
export async function PATCH(request: Request, { params }: Context) {
  return updateDiscussionItem(request, (await params).itemId);
}
export async function DELETE(_request: Request, { params }: Context) {
  return archiveDiscussionItem((await params).itemId);
}
