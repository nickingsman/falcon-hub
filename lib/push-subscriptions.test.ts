import assert from "node:assert/strict";
import test from "node:test";
import {
  getPushSubscriptionAccessFailure,
  isEligibleDsiReminderAccount,
  isExpiredPushSubscriptionStatus,
  validatePushSubscriptionPayload,
} from "./push-subscriptions";

const validSubscription = {
  endpoint: "https://push.example.test/subscription/123",
  expirationTime: null,
  keys: {
    p256dh: "A_valid-p256dh_key_value",
    auth: "valid_auth_key",
  },
};

test("accepts a valid browser push subscription", () => {
  assert.deepEqual(validatePushSubscriptionPayload(validSubscription), validSubscription);
});

test("subscription access rejects unauthenticated and inactive accounts", () => {
  assert.deepEqual(
    getPushSubscriptionAccessFailure({
      authenticated: false,
      profileStatus: null,
      memberId: null,
    }),
    { status: 401, message: "Authentication required" },
  );
  assert.deepEqual(
    getPushSubscriptionAccessFailure({
      authenticated: true,
      profileStatus: "inactive",
      memberId: "member-1",
    }),
    { status: 403, message: "Active linked member is required" },
  );
  assert.equal(
    getPushSubscriptionAccessFailure({
      authenticated: true,
      profileStatus: "active",
      memberId: "member-1",
    }),
    null,
  );
});

test("rejects non-HTTPS, malformed keys, and expired subscriptions", () => {
  assert.equal(
    validatePushSubscriptionPayload({ ...validSubscription, endpoint: "http://push.test/1" }),
    null,
  );
  assert.equal(
    validatePushSubscriptionPayload({
      ...validSubscription,
      keys: { ...validSubscription.keys, auth: "not valid!" },
    }),
    null,
  );
  assert.equal(
    validatePushSubscriptionPayload({ ...validSubscription, expirationTime: Date.now() - 1 }),
    null,
  );
});

test("only active linked Falcon Hub accounts are reminder eligible", () => {
  assert.equal(
    isEligibleDsiReminderAccount({
      profileStatus: "active",
      memberStatus: "Active",
      memberIsDeleted: false,
    }),
    true,
  );

  for (const input of [
    { profileStatus: "inactive", memberStatus: "Active", memberIsDeleted: false },
    { profileStatus: "active", memberStatus: "Resigned", memberIsDeleted: false },
    { profileStatus: "active", memberStatus: "Active", memberIsDeleted: true },
  ]) {
    assert.equal(isEligibleDsiReminderAccount(input), false);
  }
});

test("404 and 410 push responses expire a subscription", () => {
  assert.equal(isExpiredPushSubscriptionStatus(404), true);
  assert.equal(isExpiredPushSubscriptionStatus(410), true);
  assert.equal(isExpiredPushSubscriptionStatus(429), false);
  assert.equal(isExpiredPushSubscriptionStatus(500), false);
});
