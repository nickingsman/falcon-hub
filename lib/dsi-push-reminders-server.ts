import * as webPush from "web-push";
import {
  areDsiPushRemindersEnabled,
  runDsiReminderSlot,
  type DsiPushSubscriptionRecord,
  type DsiReminderCompletion,
  type DsiReminderSlot,
  type EligibleDsiPushUser,
  type PushDeliveryResult,
} from "@/lib/dsi-push-reminders";
import { isEligibleDsiReminderAccount } from "@/lib/push-subscriptions";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

type PushSubscriptionRow = {
  id: string;
  auth_user_id: string;
  member_id: string;
  endpoint: string;
  p256dh: string;
  auth_key: string;
  expiration_time: string | null;
};

type ProfileRow = {
  auth_user_id: string;
  member_id: string | null;
  status: string;
};

type MemberRow = {
  id: string;
  status: string;
  is_deleted: boolean;
};

function getPushConfiguration() {
  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (!subject || !publicKey || !privateKey) {
    throw new Error("DSI Web Push server configuration is incomplete");
  }

  return { subject, publicKey, privateKey };
}

async function listEligibleUsers(): Promise<EligibleDsiPushUser[]> {
  const supabase = createSupabaseAdminClient();
  const { data: subscriptionData, error: subscriptionError } = await supabase
    .from("push_subscriptions")
    .select("id, auth_user_id, member_id, endpoint, p256dh, auth_key, expiration_time")
    .order("created_at", { ascending: true });

  if (subscriptionError) throw new Error("Unable to load push subscriptions");

  const subscriptions = (subscriptionData ?? []) as PushSubscriptionRow[];
  if (subscriptions.length === 0) return [];

  const authUserIds = [...new Set(subscriptions.map((row) => row.auth_user_id))];
  const { data: profileData, error: profileError } = await supabase
    .from("user_profiles")
    .select("auth_user_id, member_id, status")
    .in("auth_user_id", authUserIds)
    .eq("status", "active");

  if (profileError) throw new Error("Unable to load eligible push profiles");

  const profiles = (profileData ?? []) as ProfileRow[];
  const memberIds = [
    ...new Set(profiles.map((profile) => profile.member_id).filter((id): id is string => !!id)),
  ];

  if (memberIds.length === 0) return [];

  const { data: memberData, error: memberError } = await supabase
    .from("users")
    .select("id, status, is_deleted")
    .in("id", memberIds)
    .eq("status", "Active")
    .eq("is_deleted", false);

  if (memberError) throw new Error("Unable to load eligible push members");

  const membersById = new Map(
    ((memberData ?? []) as MemberRow[]).map((member) => [member.id, member]),
  );
  const profileByAuthUser = new Map(
    profiles
      .filter((profile) => {
        const member = profile.member_id ? membersById.get(profile.member_id) : null;
        return !!member && isEligibleDsiReminderAccount({
          profileStatus: profile.status,
          memberStatus: member.status,
          memberIsDeleted: member.is_deleted,
        });
      })
      .map((profile) => [profile.auth_user_id, profile.member_id as string]),
  );
  const users = new Map<string, EligibleDsiPushUser>();

  for (const row of subscriptions) {
    const memberId = profileByAuthUser.get(row.auth_user_id);
    if (!memberId || row.member_id !== memberId) continue;

    const user = users.get(row.auth_user_id) ?? {
      authUserId: row.auth_user_id,
      memberId,
      subscriptions: [],
    };

    user.subscriptions.push({
      id: row.id,
      endpoint: row.endpoint,
      p256dh: row.p256dh,
      authKey: row.auth_key,
      expirationTime: row.expiration_time,
    });
    users.set(row.auth_user_id, user);
  }

  return [...users.values()];
}

async function hasSubmitted(memberId: string, activityDate: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("daily_sales_index_entries")
    .select("id")
    .eq("member_id", memberId)
    .eq("activity_date", activityDate)
    .maybeSingle();

  if (error) throw new Error("Unable to verify DSI submission");
  return !!data;
}

async function claimDelivery(input: {
  authUserId: string;
  memberId: string;
  activityDate: string;
  reminderSlot: DsiReminderSlot;
  subscriptionCount: number;
}) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("dsi_push_reminder_deliveries").insert({
    auth_user_id: input.authUserId,
    member_id: input.memberId,
    activity_date: input.activityDate,
    reminder_slot: input.reminderSlot,
    subscription_count: input.subscriptionCount,
  });

  if (error?.code === "23505") return false;
  if (error) throw new Error("Unable to claim DSI reminder delivery");
  return true;
}

async function sendNotification(
  subscription: DsiPushSubscriptionRecord,
  payload: string,
): Promise<PushDeliveryResult> {
  try {
    await webPush.sendNotification(
      {
        endpoint: subscription.endpoint,
        expirationTime: subscription.expirationTime
          ? new Date(subscription.expirationTime).getTime()
          : null,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.authKey,
        },
      },
      payload,
      { TTL: 60 * 60, urgency: "high" },
    );
    return {};
  } catch (error) {
    const pushError = error as { statusCode?: number; code?: string };
    return {
      statusCode: pushError.statusCode,
      errorCode: pushError.code,
    };
  }
}

async function removeExpiredSubscription(subscriptionId: string) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("push_subscriptions").delete().eq("id", subscriptionId);
  if (error) throw new Error("Unable to remove expired push subscription");
}

async function completeDelivery(
  authUserId: string,
  activityDate: string,
  reminderSlot: DsiReminderSlot,
  completion: DsiReminderCompletion,
) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("dsi_push_reminder_deliveries")
    .update({
      status: completion.status,
      subscription_count: completion.subscriptionCount,
      sent_count: completion.sentCount,
      failed_count: completion.failedCount,
      expired_count: completion.expiredCount,
      last_error_code: completion.lastErrorCode,
      completed_at: new Date().toISOString(),
    })
    .eq("auth_user_id", authUserId)
    .eq("activity_date", activityDate)
    .eq("reminder_slot", reminderSlot)
    .eq("status", "claimed")
    .select("id")
    .maybeSingle();

  if (error || !data) throw new Error("Unable to complete DSI reminder delivery");
}

export async function runServerDsiReminder(slot: DsiReminderSlot, now = new Date()) {
  if (!areDsiPushRemindersEnabled(process.env.DSI_PUSH_REMINDERS_ENABLED)) {
    throw new Error("DSI push reminders are disabled");
  }

  const configuration = getPushConfiguration();
  webPush.setVapidDetails(configuration.subject, configuration.publicKey, configuration.privateKey);

  return runDsiReminderSlot({
    slot,
    now,
    dependencies: {
      listEligibleUsers,
      hasSubmitted,
      claimDelivery,
      sendNotification,
      removeExpiredSubscription,
      completeDelivery,
    },
  });
}
