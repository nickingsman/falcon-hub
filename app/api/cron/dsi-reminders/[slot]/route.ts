import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import {
  areDsiPushRemindersEnabled,
  parseDsiReminderSlot,
} from "@/lib/dsi-push-reminders";
import { runServerDsiReminder } from "@/lib/dsi-push-reminders-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slot: string }> },
) {
  if (!isAuthorizedCronRequest(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slot: pathSlot } = await context.params;
  const slot = parseDsiReminderSlot(pathSlot);
  if (!slot) return NextResponse.json({ error: "Unknown reminder slot" }, { status: 404 });

  if (!areDsiPushRemindersEnabled(process.env.DSI_PUSH_REMINDERS_ENABLED)) {
    return NextResponse.json({
      enabled: false,
      skipped: true,
      reminderSlot: slot,
    });
  }

  try {
    const summary = await runServerDsiReminder(slot);
    return NextResponse.json(summary);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to run DSI reminder";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
