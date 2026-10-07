import { addAdHocTopic } from "../../../leader-meetings-service";

type Context = { params: Promise<{ meetingId: string }> };
export async function POST(request: Request, { params }: Context) {
  return addAdHocTopic(request, (await params).meetingId);
}
