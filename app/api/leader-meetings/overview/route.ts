import { getOverview } from "../leader-meetings-service";

export const dynamic = "force-dynamic";
export function GET() { return getOverview(); }
