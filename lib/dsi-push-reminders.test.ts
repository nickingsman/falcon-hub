import assert from "node:assert/strict";
import test from "node:test";
import { isAuthorizedCronRequest } from "./cron-auth";
import {
  areDsiPushRemindersEnabled,
  buildDsiReminderPayload,
  parseDsiReminderSlot,
  runDsiReminderSlot,
  type DsiReminderCompletion,
  type DsiReminderDependencies,
} from "./dsi-push-reminders";

function createDependencies(overrides: Partial<DsiReminderDependencies> = {}) {
  const completions: DsiReminderCompletion[] = [];
  let submissionChecks = 0;
  const dependencies: DsiReminderDependencies = {
    listEligibleUsers: async () => [
      {
        authUserId: "auth-1",
        memberId: "member-1",
        subscriptions: [
          {
            id: "subscription-1",
            endpoint: "https://push.example.test/1",
            p256dh: "p256dh",
            authKey: "auth",
            expirationTime: null,
          },
        ],
      },
    ],
    hasSubmitted: async () => {
      submissionChecks += 1;
      return false;
    },
    claimDelivery: async () => true,
    sendNotification: async () => ({}),
    removeExpiredSubscription: async () => undefined,
    completeDelivery: async (_authUserId, _date, _slot, completion) => {
      completions.push(completion);
    },
    ...overrides,
  };

  return { dependencies, completions, getSubmissionChecks: () => submissionChecks };
}

test("recognizes all three approved reminder slots", () => {
  assert.equal(parseDsiReminderSlot("22-00"), "22:00");
  assert.equal(parseDsiReminderSlot("23-00"), "23:00");
  assert.equal(parseDsiReminderSlot("23-30"), "23:30");
  assert.equal(parseDsiReminderSlot("22-30"), null);
});

test("reminders are disabled unless the server flag is exactly true", () => {
  assert.equal(areDsiPushRemindersEnabled(undefined), false);
  assert.equal(areDsiPushRemindersEnabled("false"), false);
  assert.equal(areDsiPushRemindersEnabled("TRUE"), false);
  assert.equal(areDsiPushRemindersEnabled("true"), true);
});

test("each approved slot runs independently", async () => {
  for (const slot of ["22:00", "23:00", "23:30"] as const) {
    const { dependencies, completions } = createDependencies();
    const summary = await runDsiReminderSlot({ slot, dependencies });
    assert.equal(summary.reminderSlot, slot);
    assert.equal(summary.sentSubscriptions, 1);
    assert.equal(completions[0]?.status, "sent");
  }
});

test("uses the Malaysia calendar day across the UTC boundary", async () => {
  const { dependencies } = createDependencies();
  const summary = await runDsiReminderSlot({
    slot: "22:00",
    now: new Date("2026-11-16T16:30:00.000Z"),
    dependencies,
  });

  assert.equal(summary.activityDate, "2026-11-17");
  assert.equal(JSON.parse(buildDsiReminderPayload(summary.activityDate)).url, "/dsi");
});

test("submitted DSI prevents claiming or sending", async () => {
  let claims = 0;
  let sends = 0;
  const { dependencies } = createDependencies({
    hasSubmitted: async () => true,
    claimDelivery: async () => {
      claims += 1;
      return true;
    },
    sendNotification: async () => {
      sends += 1;
      return {};
    },
  });

  const summary = await runDsiReminderSlot({ slot: "23:00", dependencies });
  assert.equal(summary.alreadySubmitted, 1);
  assert.equal(claims, 0);
  assert.equal(sends, 0);
});

test("rechecks DSI after claiming and skips a newly submitted entry", async () => {
  let checks = 0;
  let sends = 0;
  const { dependencies, completions } = createDependencies({
    hasSubmitted: async () => {
      checks += 1;
      return checks === 2;
    },
    sendNotification: async () => {
      sends += 1;
      return {};
    },
  });

  const summary = await runDsiReminderSlot({ slot: "23:30", dependencies });
  assert.equal(summary.skippedAfterRecheck, 1);
  assert.equal(sends, 0);
  assert.equal(completions[0]?.status, "skipped_submitted");
});

test("a duplicate cron retry cannot send the same user and slot again", async () => {
  let sends = 0;
  const { dependencies } = createDependencies({
    claimDelivery: async () => false,
    sendNotification: async () => {
      sends += 1;
      return {};
    },
  });

  const summary = await runDsiReminderSlot({ slot: "22:00", dependencies });
  assert.equal(summary.duplicateClaims, 1);
  assert.equal(sends, 0);
});

test("concurrent cron executions can claim and send a slot only once", async () => {
  let claimed = false;
  let sends = 0;
  const sharedOverrides: Partial<DsiReminderDependencies> = {
    claimDelivery: async () => {
      if (claimed) return false;
      claimed = true;
      return true;
    },
    sendNotification: async () => {
      sends += 1;
      return {};
    },
  };
  const first = createDependencies(sharedOverrides);
  const second = createDependencies(sharedOverrides);

  const summaries = await Promise.all([
    runDsiReminderSlot({ slot: "23:00", dependencies: first.dependencies }),
    runDsiReminderSlot({ slot: "23:00", dependencies: second.dependencies }),
  ]);

  assert.equal(sends, 1);
  assert.equal(summaries.reduce((total, summary) => total + summary.duplicateClaims, 0), 1);
});

test("expired subscriptions are removed and audited without a retry", async () => {
  const removed: string[] = [];
  const { dependencies, completions, getSubmissionChecks } = createDependencies({
    sendNotification: async () => ({ statusCode: 410 }),
    removeExpiredSubscription: async (id) => {
      removed.push(id);
    },
  });

  const summary = await runDsiReminderSlot({ slot: "22:00", dependencies });
  assert.equal(getSubmissionChecks(), 2);
  assert.deepEqual(removed, ["subscription-1"]);
  assert.equal(summary.expiredSubscriptions, 1);
  assert.equal(completions[0]?.status, "expired");
});

test("expired-subscription cleanup failure cannot double-count one device", async () => {
  const { dependencies, completions } = createDependencies({
    sendNotification: async () => ({ statusCode: 410 }),
    removeExpiredSubscription: async () => {
      throw new Error("cleanup failed");
    },
  });

  const summary = await runDsiReminderSlot({ slot: "22:00", dependencies });
  assert.equal(summary.expiredSubscriptions, 1);
  assert.equal(summary.failedSubscriptions, 0);
  assert.equal(completions[0]?.expiredCount, 1);
  assert.equal(completions[0]?.failedCount, 0);
  assert.equal(completions[0]?.status, "expired");
});

test("successful delivery is recorded once", async () => {
  const { dependencies, completions } = createDependencies();
  const summary = await runDsiReminderSlot({ slot: "23:00", dependencies });
  assert.equal(summary.sentSubscriptions, 1);
  assert.equal(completions[0]?.status, "sent");
});

test("multiple devices receive one delivery each under one user-slot claim", async () => {
  const { dependencies, completions } = createDependencies({
    listEligibleUsers: async () => [
      {
        authUserId: "auth-1",
        memberId: "member-1",
        subscriptions: [
          {
            id: "subscription-1",
            endpoint: "https://push.example.test/1",
            p256dh: "p256dh-1",
            authKey: "auth-1",
            expirationTime: null,
          },
          {
            id: "subscription-2",
            endpoint: "https://push.example.test/2",
            p256dh: "p256dh-2",
            authKey: "auth-2",
            expirationTime: null,
          },
        ],
      },
    ],
  });

  const summary = await runDsiReminderSlot({ slot: "23:30", dependencies });
  assert.equal(summary.claimedUsers, 1);
  assert.equal(summary.sentSubscriptions, 2);
  assert.equal(completions[0]?.subscriptionCount, 2);
  assert.equal(completions[0]?.sentCount, 2);
});

test("cron authorization fails closed", () => {
  assert.equal(isAuthorizedCronRequest(null, "secret"), false);
  assert.equal(isAuthorizedCronRequest("Bearer wrong", "secret"), false);
  assert.equal(isAuthorizedCronRequest("Bearer secret", undefined), false);
  assert.equal(isAuthorizedCronRequest("Bearer secret", "secret"), true);
});
