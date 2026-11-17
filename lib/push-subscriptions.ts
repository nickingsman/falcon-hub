export type BrowserPushSubscription = {
  endpoint: string;
  expirationTime: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
};

export function getPushSubscriptionAccessFailure(input: {
  authenticated: boolean;
  profileStatus: string | null;
  memberId: string | null;
}) {
  if (!input.authenticated) {
    return { status: 401, message: "Authentication required" } as const;
  }

  if (input.profileStatus !== "active" || !input.memberId) {
    return { status: 403, message: "Active linked member is required" } as const;
  }

  return null;
}

const base64UrlPattern = /^[A-Za-z0-9_-]+$/;

// Browser PushManager subscriptions currently used by FalconHub resolve to one
// of these production services. Chromium browsers (including Android Chrome,
// Edge, and Opera) use FCM; android.googleapis.com is retained for existing
// legacy Chromium subscriptions. Firefox and Apple Safari/iOS use their own
// production services. Keep this exact-host allowlist deliberately small:
// accepting arbitrary HTTPS endpoints would let a subscription become an SSRF
// target when the server later delivers a notification.
const trustedPushServiceHosts = new Set([
  "fcm.googleapis.com",
  "android.googleapis.com",
  "updates.push.services.mozilla.com",
  "web.push.apple.com",
]);

export function isTrustedPushServiceEndpoint(endpoint: string) {
  if (endpoint.length > 4096) return false;

  try {
    const parsed = new URL(endpoint);

    return (
      parsed.protocol === "https:" &&
      parsed.username === "" &&
      parsed.password === "" &&
      parsed.port === "" &&
      parsed.search === "" &&
      parsed.hash === "" &&
      parsed.pathname.length > 1 &&
      trustedPushServiceHosts.has(parsed.hostname)
    );
  } catch {
    return false;
  }
}

export function canUpdateExistingPushSubscription(
  existingAuthUserId: string | null,
  currentAuthUserId: string,
) {
  return existingAuthUserId === null || existingAuthUserId === currentAuthUserId;
}

function isValidBase64Url(value: unknown, minLength: number, maxLength: number) {
  return (
    typeof value === "string" &&
    value.length >= minLength &&
    value.length <= maxLength &&
    base64UrlPattern.test(value)
  );
}

export function validatePushSubscriptionPayload(
  value: unknown,
): BrowserPushSubscription | null {
  if (!value || typeof value !== "object") return null;

  const candidate = value as Partial<BrowserPushSubscription>;
  const expirationTime = candidate.expirationTime ?? null;

  if (
    typeof candidate.endpoint !== "string" ||
    !isTrustedPushServiceEndpoint(candidate.endpoint) ||
    (expirationTime !== null &&
      (!Number.isFinite(expirationTime) || expirationTime <= Date.now())) ||
    !candidate.keys ||
    !isValidBase64Url(candidate.keys.p256dh, 16, 512) ||
    !isValidBase64Url(candidate.keys.auth, 8, 256)
  ) {
    return null;
  }

  return {
    endpoint: new URL(candidate.endpoint).href,
    expirationTime,
    keys: {
      p256dh: candidate.keys.p256dh,
      auth: candidate.keys.auth,
    },
  };
}

export function isEligibleDsiReminderAccount(input: {
  profileStatus: string | null;
  memberStatus: string | null;
  memberIsDeleted: boolean | null;
}) {
  return (
    input.profileStatus === "active" &&
    input.memberStatus === "Active" &&
    input.memberIsDeleted === false
  );
}

export function isExpiredPushSubscriptionStatus(statusCode: number | undefined) {
  return statusCode === 404 || statusCode === 410;
}
