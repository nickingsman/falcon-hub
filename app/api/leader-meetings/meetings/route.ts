import { createMeeting } from "../leader-meetings-service";

export function POST(request: Request) { return createMeeting(request); }
