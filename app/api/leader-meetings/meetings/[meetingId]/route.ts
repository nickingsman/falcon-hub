import { getMeeting, saveMeetingDraft } from "../../leader-meetings-service";

type Context = { params: Promise<{ meetingId: string }> };
export async function GET(_request: Request, { params }: Context) {
  return getMeeting((await params).meetingId);
}
export async function PATCH(request: Request, { params }: Context) {
  return saveMeetingDraft(request, (await params).meetingId);
}
