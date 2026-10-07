import { addActionItem } from "../../../leader-meetings-service";

type Context = { params: Promise<{ meetingId: string }> };
export async function POST(request: Request, { params }: Context) {
  return addActionItem(request, (await params).meetingId);
}
