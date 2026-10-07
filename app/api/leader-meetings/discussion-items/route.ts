import { createDiscussionItem } from "../leader-meetings-service";

export function POST(request: Request) { return createDiscussionItem(request); }
