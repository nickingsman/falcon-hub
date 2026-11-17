import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function read(relativePath: string) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

test("subscription API requires active authenticated ownership for every method", () => {
  const source = read("app/api/push-subscriptions/route.ts");
  assert.match(source, /getAuthenticatedUserProfile/);
  assert.match(source, /getPushSubscriptionAccessFailure/);
  assert.match(source, /\.eq\("status", "Active"\)/);
  assert.match(source, /\.eq\("is_deleted", false\)/);
  assert.match(source, /\.eq\("auth_user_id", authorization\.context\.authUserId\)/);
  assert.match(source, /export async function GET/);
  assert.match(source, /export async function POST/);
  assert.match(source, /export async function DELETE/);
  assert.match(source, /existing\.auth_user_id !== authorization\.context\.authUserId/);
  assert.match(source, /existing\.p256dh !== subscription\.keys\.p256dh/);
  assert.doesNotMatch(source, /\.upsert\(/);
});

test("cron endpoint requires CRON_SECRET before invoking delivery", () => {
  const source = read("app/api/cron/dsi-reminders/[slot]/route.ts");
  const authIndex = source.indexOf("if (!isAuthorizedCronRequest");
  const flagIndex = source.indexOf("if (!areDsiPushRemindersEnabled");
  const runIndex = source.indexOf("runServerDsiReminder(slot)");
  assert.ok(authIndex >= 0 && flagIndex > authIndex && runIndex > flagIndex);
  assert.match(source, /process\.env\.CRON_SECRET/);
  assert.match(source, /process\.env\.DSI_PUSH_REMINDERS_ENABLED/);
  assert.match(source, /export const maxDuration = 300/);

  const serverSource = read("lib/dsi-push-reminders-server.ts");
  assert.match(serverSource, /areDsiPushRemindersEnabled/);
  assert.match(serverSource, /DSI_PUSH_REMINDERS_ENABLED/);
});

test("Vercel cron schedules map the three Malaysia reminder times to UTC", () => {
  const config = JSON.parse(read("vercel.json")) as {
    crons: Array<{ path: string; schedule: string }>;
  };
  assert.deepEqual(config.crons, [
    { path: "/api/cron/dsi-reminders/22-00", schedule: "0 14 * * *" },
    { path: "/api/cron/dsi-reminders/23-00", schedule: "0 15 * * *" },
    { path: "/api/cron/dsi-reminders/23-30", schedule: "30 15 * * *" },
  ]);
});

test("server candidate query excludes inactive, deleted and mismatched accounts", () => {
  const source = read("lib/dsi-push-reminders-server.ts");
  assert.match(source, /\.eq\("status", "active"\)/);
  assert.match(source, /\.eq\("status", "Active"\)/);
  assert.match(source, /\.eq\("is_deleted", false\)/);
  assert.match(source, /row\.member_id !== memberId/);
});

test("push endpoints are allowlisted on creation and immediately before delivery", () => {
  const subscriptionSource = read("lib/push-subscriptions.ts");
  const reminderSource = read("lib/dsi-push-reminders.ts");
  const serverSource = read("lib/dsi-push-reminders-server.ts");

  assert.match(subscriptionSource, /trustedPushServiceHosts/);
  assert.match(subscriptionSource, /isTrustedPushServiceEndpoint\(candidate\.endpoint\)/);
  assert.match(reminderSource, /isTrustedPushServiceEndpoint\(subscription\.endpoint\)/);
  assert.match(reminderSource, /untrusted_push_endpoint/);
  assert.match(serverSource, /does not follow redirects/);
  assert.doesNotMatch(reminderSource, /console\.(?:log|warn|error)/);
  assert.doesNotMatch(serverSource, /console\.(?:log|warn|error)/);
});

test("migration enforces ownership, idempotency and service-only delivery audit", () => {
  const migration = read(
    "supabase/migrations/20261116000100_create_dsi_web_push_notifications.sql",
  );
  assert.match(migration, /enable row level security/);
  assert.match(migration, /auth\.uid\(\) = auth_user_id/);
  assert.match(migration, /unique \(auth_user_id, activity_date, reminder_slot\)/);
  assert.match(
    migration,
    /revoke all on table public\.dsi_push_reminder_deliveries from public, anon, authenticated/,
  );
  assert.doesNotMatch(
    migration,
    /grant (?:select|insert|update|delete)[^;]*push_subscriptions to authenticated/,
  );
  assert.doesNotMatch(
    migration,
    /(?:update|delete from|alter table)\s+public\.daily_sales_index_entries/i,
  );
  assert.match(migration, /DSI Web Push target objects already exist/);
  assert.match(migration, /fcm\\\.googleapis\\\.com/);
  assert.match(migration, /web\\\.push\\\.apple\\\.com/);
  assert.doesNotMatch(
    migration,
    /create\s+or\s+replace\s+function\s+public\.set_push_subscription_updated_at/i,
  );
});

test("service worker opens DSI and the UI never prompts on initial load", () => {
  const worker = read("public/sw.js");
  const settings = read("app/(app)/dsi/DsiNotificationSettings.tsx");
  const effectBody = settings.slice(settings.indexOf("useEffect"), settings.indexOf("async function enableNotifications"));

  assert.match(worker, /notificationclick/);
  assert.match(worker, /new URL\("\/dsi", self\.location\.origin\)/);
  assert.doesNotMatch(effectBody, /requestPermission/);
  assert.match(settings, /async function enableNotifications/);
  assert.match(settings, /Notification\.requestPermission\(\)/);
  assert.doesNotMatch(settings, /VAPID_PRIVATE_KEY|CRON_SECRET/);
  assert.doesNotMatch(worker, /VAPID_PRIVATE_KEY|CRON_SECRET/);
});
