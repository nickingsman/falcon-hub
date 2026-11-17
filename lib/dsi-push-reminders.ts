import { getMalaysiaTodayDateString } from "./malaysia-date";
import {
  isExpiredPushSubscriptionStatus,
  isTrustedPushServiceEndpoint,
} from "./push-subscriptions";

export const dsiReminderSlots = ["22:00", "23:00", "23:30"] as const;
export type DsiReminderSlot = (typeof dsiReminderSlots)[number];

export type DsiPushSubscriptionRecord = {
  id: string;
  endpoint: string;
  p256dh: string;
  authKey: string;
  expirationTime: string | null;
};

export type EligibleDsiPushUser = {
  authUserId: string;
  memberId: string;
  subscriptions: DsiPushSubscriptionRecord[];
};

export type PushDeliveryResult = {
  statusCode?: number;
  errorCode?: string;
};

export type DsiReminderCompletion = {
  status: "sent" | "partial" | "failed" | "expired" | "skipped_submitted";
  subscriptionCount: number;
  sentCount: number;
  failedCount: number;
  expiredCount: number;
  lastErrorCode: string | null;
};

export type DsiReminderDependencies = {
  listEligibleUsers: () => Promise<EligibleDsiPushUser[]>;
  hasSubmitted: (memberId: string, activityDate: string) => Promise<boolean>;
  claimDelivery: (input: {
    authUserId: string;
    memberId: string;
    activityDate: string;
    reminderSlot: DsiReminderSlot;
    subscriptionCount: number;
  }) => Promise<boolean>;
  sendNotification: (
    subscription: DsiPushSubscriptionRecord,
    payload: string,
  ) => Promise<PushDeliveryResult>;
  removeExpiredSubscription: (subscriptionId: string) => Promise<void>;
  completeDelivery: (
    authUserId: string,
    activityDate: string,
    reminderSlot: DsiReminderSlot,
    completion: DsiReminderCompletion,
  ) => Promise<void>;
};

export type DsiReminderRunSummary = {
  activityDate: string;
  reminderSlot: DsiReminderSlot;
  eligibleUsers: number;
  alreadySubmitted: number;
  duplicateClaims: number;
  skippedAfterRecheck: number;
  claimedUsers: number;
  sentSubscriptions: number;
  failedSubscriptions: number;
  expiredSubscriptions: number;
};

const slotByPath: Record<string, DsiReminderSlot> = {
  "22-00": "22:00",
  "23-00": "23:00",
  "23-30": "23:30",
};

export function parseDsiReminderSlot(value: string) {
  return slotByPath[value] ?? null;
}

export function areDsiPushRemindersEnabled(value: string | undefined) {
  return value === "true";
}

export function buildDsiReminderPayload(
  activityDate: string,
  reminderSlot: DsiReminderSlot,
) {
  return JSON.stringify({
    title: "DSI reminder",
    body: "Your DSI for today has not been submitted yet.",
    url: "/dsi",
    tag: `dsi-reminder-${activityDate}-${reminderSlot.replace(":", "-")}`,
  });
}

function getCompletion(input: {
  subscriptionCount: number;
  sentCount: number;
  failedCount: number;
  expiredCount: number;
  lastErrorCode: string | null;
}): DsiReminderCompletion {
  if (input.sentCount === input.subscriptionCount && input.sentCount > 0) {
    return { ...input, status: "sent" };
  }

  if (input.sentCount > 0) {
    return { ...input, status: "partial" };
  }

  if (input.expiredCount === input.subscriptionCount && input.expiredCount > 0) {
    return { ...input, status: "expired" };
  }

  return { ...input, status: "failed" };
}

export async function runDsiReminderSlot(input: {
  slot: DsiReminderSlot;
  now?: Date;
  dependencies: DsiReminderDependencies;
}): Promise<DsiReminderRunSummary> {
  const activityDate = getMalaysiaTodayDateString(input.now);
  const users = await input.dependencies.listEligibleUsers();
  const summary: DsiReminderRunSummary = {
    activityDate,
    reminderSlot: input.slot,
    eligibleUsers: users.length,
    alreadySubmitted: 0,
    duplicateClaims: 0,
    skippedAfterRecheck: 0,
    claimedUsers: 0,
    sentSubscriptions: 0,
    failedSubscriptions: 0,
    expiredSubscriptions: 0,
  };
  const payload = buildDsiReminderPayload(activityDate, input.slot);

  for (const user of users) {
    if (await input.dependencies.hasSubmitted(user.memberId, activityDate)) {
      summary.alreadySubmitted += 1;
      continue;
    }

    const claimed = await input.dependencies.claimDelivery({
      authUserId: user.authUserId,
      memberId: user.memberId,
      activityDate,
      reminderSlot: input.slot,
      subscriptionCount: user.subscriptions.length,
    });

    if (!claimed) {
      summary.duplicateClaims += 1;
      continue;
    }

    summary.claimedUsers += 1;

    if (await input.dependencies.hasSubmitted(user.memberId, activityDate)) {
      summary.skippedAfterRecheck += 1;
      await input.dependencies.completeDelivery(
        user.authUserId,
        activityDate,
        input.slot,
        {
          status: "skipped_submitted",
          subscriptionCount: user.subscriptions.length,
          sentCount: 0,
          failedCount: 0,
          expiredCount: 0,
          lastErrorCode: null,
        },
      );
      continue;
    }

    let sentCount = 0;
    let failedCount = 0;
    let expiredCount = 0;
    let lastErrorCode: string | null = null;

    for (const subscription of user.subscriptions) {
      // Stored subscriptions are untrusted input. Revalidate immediately before
      // the only outbound request so legacy or tampered rows cannot become SSRF
      // targets.
      if (!isTrustedPushServiceEndpoint(subscription.endpoint)) {
        failedCount += 1;
        lastErrorCode = "untrusted_push_endpoint";
        continue;
      }

      let result: PushDeliveryResult;

      try {
        result = await input.dependencies.sendNotification(subscription, payload);
      } catch (error) {
        failedCount += 1;
        lastErrorCode = error instanceof Error ? error.name : "unknown_error";
        continue;
      }

      if (isExpiredPushSubscriptionStatus(result.statusCode)) {
        expiredCount += 1;
        lastErrorCode = String(result.statusCode);

        try {
          await input.dependencies.removeExpiredSubscription(subscription.id);
        } catch (error) {
          lastErrorCode = error instanceof Error
            ? `cleanup_${error.name}`
            : "cleanup_unknown_error";
        }

        continue;
      }

      if (result.errorCode || (result.statusCode && result.statusCode >= 400)) {
        failedCount += 1;
        lastErrorCode = result.errorCode ?? String(result.statusCode);
      } else {
        sentCount += 1;
      }
    }

    summary.sentSubscriptions += sentCount;
    summary.failedSubscriptions += failedCount;
    summary.expiredSubscriptions += expiredCount;

    await input.dependencies.completeDelivery(
      user.authUserId,
      activityDate,
      input.slot,
      getCompletion({
        subscriptionCount: user.subscriptions.length,
        sentCount,
        failedCount,
        expiredCount,
        lastErrorCode,
      }),
    );
  }

  return summary;
}
