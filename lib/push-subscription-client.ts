export async function getExistingBrowserPushSubscription() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return null;
  }

  const registration = await navigator.serviceWorker.getRegistration("/");
  return registration?.pushManager.getSubscription() ?? null;
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
    await subscription.unsubscribe().catch(() => false);
  }
}
