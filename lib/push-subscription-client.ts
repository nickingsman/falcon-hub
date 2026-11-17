const PUSH_BROWSER_OPERATION_TIMEOUT_MS = 15_000;
const PUSH_PERMISSION_TIMEOUT_MS = 60_000;

export async function withPushOperationTimeout<T>(
  operation: PromiseLike<T>,
  timeoutMessage: string,
  timeoutMs = PUSH_BROWSER_OPERATION_TIMEOUT_MS,
) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      Promise.resolve(operation),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export async function ensurePushServiceWorkerRegistration(
  serviceWorkers: ServiceWorkerContainer = navigator.serviceWorker,
) {
  await withPushOperationTimeout(
    serviceWorkers.register("/sw.js", { scope: "/" }),
    "Notification setup timed out while registering Falcon Hub. Please close and reopen the Home Screen app, then try again.",
  );

  return withPushOperationTimeout(
    serviceWorkers.ready,
    "Notification setup timed out while activating Falcon Hub. Please close and reopen the Home Screen app, then try again.",
  );
}

export async function getPushSubscription(registration: ServiceWorkerRegistration) {
  return withPushOperationTimeout(
    registration.pushManager.getSubscription(),
    "Falcon Hub could not check this device's notification status. Please try again.",
  );
}

export async function requestPushNotificationPermission() {
  return withPushOperationTimeout(
    Notification.requestPermission(),
    "The notification permission request timed out. Check this app's notification settings, then try again.",
    PUSH_PERMISSION_TIMEOUT_MS,
  );
}

export async function subscribeToPushNotifications(
  registration: ServiceWorkerRegistration,
  applicationServerKey: Uint8Array<ArrayBuffer>,
) {
  return withPushOperationTimeout(
    registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    }),
    "This device took too long to create a notification subscription. Please try again.",
  );
}

export async function fetchPushSubscriptionApi(
  input: string,
  init?: RequestInit,
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PUSH_BROWSER_OPERATION_TIMEOUT_MS);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Falcon Hub took too long to check notification settings. Please try again.");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function getExistingBrowserPushSubscription() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return null;
  }

  const registration = await withPushOperationTimeout(
    navigator.serviceWorker.getRegistration("/"),
    "Falcon Hub could not check this device's notification service. Please try again.",
  );
  return registration ? getPushSubscription(registration) : null;
}

export async function logoutWithPushCleanup() {
  let subscription: PushSubscription | null;

  try {
    subscription = await getExistingBrowserPushSubscription();
  } catch {
    throw new Error("Unable to verify notification cleanup. Please try again.");
  }

  const response = await fetch("/api/auth/logout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      pushSubscriptionEndpoint: subscription?.endpoint ?? null,
    }),
  });
  const result = (await response.json()) as { error?: string };

  if (!response.ok) {
    throw new Error(result.error || "Unable to sign out safely");
  }

  // The server-side owner record is already gone. Browser cleanup is best
  // effort; even if WebKit cannot unsubscribe, FalconHub can no longer send to
  // this endpoint for the signed-out account.
  if (subscription) {
    await withPushOperationTimeout(
      subscription.unsubscribe(),
      "This device took too long to finish notification cleanup.",
    ).catch(() => false);
  }
}
