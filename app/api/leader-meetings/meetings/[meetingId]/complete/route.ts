import { completeMeeting } from "../../../leader-meetings-service";

type Context = { params: Promise<{ meetingId: string }> };
export async function POST(request: Request, { params }: Context) {
  return completeMeeting(request, (await params).meetingId);
}
