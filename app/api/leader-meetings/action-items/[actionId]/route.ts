import { updateActionItem } from "../../leader-meetings-service";

type Context = { params: Promise<{ actionId: string }> };
export async function PATCH(request: Request, { params }: Context) {
  return updateActionItem(request, (await params).actionId);
}
