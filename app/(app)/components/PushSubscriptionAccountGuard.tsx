"use client";

import { useEffect } from "react";
import {
  getExistingBrowserPushSubscription,
  withPushOperationTimeout,
} from "@/lib/push-subscription-client";

export default function PushSubscriptionAccountGuard() {
  useEffect(() => {
    let cancelled = false;

    async function invalidateStaleSubscription() {
      try {
        const subscription = await getExistingBrowserPushSubscription();
        if (!subscription || cancelled) return;

        const response = await fetch(
          `/api/push-subscriptions?endpoint=${encodeURIComponent(subscription.endpoint)}`,
          { cache: "no-store" },
        );
        const result = (await response.json()) as {
          enabledForCurrentDevice?: boolean;
        };

        if (
          !cancelled &&
          response.ok &&
          result.enabledForCurrentDevice === false
        ) {
          // This endpoint is not owned by the signed-in account. Invalidating it
          // prevents a stale shared-device subscription from receiving another
          // account's reminders. The new account must explicitly opt in.
          await withPushOperationTimeout(
            subscription.unsubscribe(),
            "Falcon Hub could not reset the previous account's notification subscription.",
          );
        }
      } catch {
        // A transient status check must not alter a valid subscription. The
        // guard runs again on the next authenticated app load.
      }
    }

    void invalidateStaleSubscription();
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
