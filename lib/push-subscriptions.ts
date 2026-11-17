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
    !candidate.endpoint.startsWith("https://") ||
    candidate.endpoint.length > 4096 ||
    (expirationTime !== null &&
      (!Number.isFinite(expirationTime) || expirationTime <= Date.now())) ||
    !candidate.keys ||
    !isValidBase64Url(candidate.keys.p256dh, 16, 512) ||
    !isValidBase64Url(candidate.keys.auth, 8, 256)
  ) {
    return null;
  }

  return {
    endpoint: candidate.endpoint,
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
