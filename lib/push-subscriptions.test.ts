import assert from "node:assert/strict";
import test from "node:test";
import {
  canUpdateExistingPushSubscription,
  getPushSubscriptionAccessFailure,
  isEligibleDsiReminderAccount,
  isExpiredPushSubscriptionStatus,
  isTrustedPushServiceEndpoint,
  validatePushSubscriptionPayload,
} from "./push-subscriptions";

const validSubscription = {
  endpoint: "https://fcm.googleapis.com/fcm/send/subscription-123",
  expirationTime: null,
  keys: {
    p256dh: "A_valid-p256dh_key_value",
    auth: "valid_auth_key",
  },
};

test("accepts a valid browser push subscription", () => {
  assert.deepEqual(validatePushSubscriptionPayload(validSubscription), validSubscription);
});

test("an existing endpoint can only be updated by its current auth user", () => {
  assert.equal(canUpdateExistingPushSubscription(null, "auth-1"), true);
  assert.equal(canUpdateExistingPushSubscription("auth-1", "auth-1"), true);
  assert.equal(canUpdateExistingPushSubscription("auth-2", "auth-1"), false);
});

test("accepts only explicitly supported browser push providers", () => {
  for (const endpoint of [
    "https://fcm.googleapis.com/fcm/send/chrome-token",
    "https://android.googleapis.com/gcm/send/legacy-chrome-token",
    "https://updates.push.services.mozilla.com/wpush/v2/firefox-token",
    "https://web.push.apple.com/QH8safari-token",
  ]) {
    assert.equal(isTrustedPushServiceEndpoint(endpoint), true, endpoint);
    assert.ok(validatePushSubscriptionPayload({ ...validSubscription, endpoint }));
  }
});

test("rejects SSRF targets, deceptive hosts, credentials, unsafe ports, and query redirects", () => {
  for (const endpoint of [
    "https://localhost/push",
    "https://127.0.0.1/push",
    "https://[::1]/push",
    "https://10.0.0.1/push",
    "https://169.254.169.254/latest/meta-data",
    "https://fcm.googleapis.com.evil.test/push",
    "https://evil.test/fcm.googleapis.com/push",
    "https://user:password@fcm.googleapis.com/push",
    "https://fcm.googleapis.com:8443/push",
    "https://fcm.googleapis.com/",
    "https://fcm.googleapis.com/push?redirect=https://127.0.0.1",
    "https://fcm.googleapis.com/push#redirect",
    "not a URL",
  ]) {
    assert.equal(isTrustedPushServiceEndpoint(endpoint), false, endpoint);
    assert.equal(
      validatePushSubscriptionPayload({ ...validSubscription, endpoint }),
      null,
      endpoint,
    );
  }
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
