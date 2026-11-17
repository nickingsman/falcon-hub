"use client";

import { useEffect, useState } from "react";
import {
  ensurePushServiceWorkerRegistration,
  fetchPushSubscriptionApi,
  getExistingBrowserPushSubscription,
  getPushSubscription,
  requestPushNotificationPermission,
  subscribeToPushNotifications,
  withPushOperationTimeout,
} from "@/lib/push-subscription-client";

type SetupState =
  | "checking"
  | "unsupported"
  | "disabled"
  | "denied"
  | "enabled"
  | "conflict"
  | "requesting-permission"
  | "registering"
  | "subscribing"
  | "saving"
  | "disabling"
  | "resetting"
  | "error";

function decodeVapidPublicKey(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

function supportsWebPush() {
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export default function DsiNotificationSettings() {
  const [state, setState] = useState<SetupState>("checking");
  const [message, setMessage] = useState("");
  const [publicKey, setPublicKey] = useState("");
  const [statusCheckAttempt, setStatusCheckAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadStatus() {
      setMessage("");

      if (!supportsWebPush()) {
        if (!cancelled) setState("unsupported");
        return;
      }

      if (Notification.permission === "denied") {
        if (!cancelled) setState("denied");
        return;
      }

      try {
        if (!cancelled) setState("registering");
        const registration = await ensurePushServiceWorkerRegistration();
        if (cancelled) return;

        setState("checking");
        const subscription = await getPushSubscription(registration);
        const endpointQuery = subscription
          ? `?endpoint=${encodeURIComponent(subscription.endpoint)}`
          : "";
        const response = await fetchPushSubscriptionApi(`/api/push-subscriptions${endpointQuery}`, {
          cache: "no-store",
        });
        const result = (await response.json()) as {
          vapidPublicKey?: string;
          enabledForCurrentDevice?: boolean;
          error?: string;
        };
        if (!response.ok || !result.vapidPublicKey) {
          throw new Error(result.error || "Notifications are not configured");
        }

        if (cancelled) return;

        setPublicKey(result.vapidPublicKey);
        setState(subscription && result.enabledForCurrentDevice ? "enabled" : "disabled");
      } catch (error) {
        if (cancelled) return;
        setMessage(error instanceof Error ? error.message : "Unable to load notification settings");
        setState("error");
      }
    }

    void loadStatus();
    return () => {
      cancelled = true;
    };
  }, [statusCheckAttempt]);

  async function enableNotifications() {
    if (!supportsWebPush() || !publicKey) return;

    setMessage("");

    try {
      setState("requesting-permission");
      const permission = await requestPushNotificationPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "disabled");
        return;
      }

      setState("registering");
      const registration = await ensurePushServiceWorkerRegistration();
      setState("subscribing");
      const existing = await getPushSubscription(registration);
      const subscription = existing ?? await subscribeToPushNotifications(
        registration,
        decodeVapidPublicKey(publicKey),
      );

      setState("saving");
      const response = await fetchPushSubscriptionApi("/api/push-subscriptions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        if (response.status === 409 && existing) {
          setState("conflict");
          setMessage(
            "This device has a notification subscription from another account. Reset it before enabling reminders for this account.",
          );
          return;
        }
        if (!existing) {
          await withPushOperationTimeout(
            subscription.unsubscribe(),
            "This device took too long to clean up the incomplete subscription.",
          ).catch(() => false);
        }
        throw new Error(result.error || "Unable to enable notifications");
      }

      setState("enabled");
      setMessage("DSI reminders are enabled on this device.");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Unable to enable notifications");
    }
  }

  async function resetNotificationsForThisAccount() {
    setState("resetting");
    setMessage("");

    try {
      const subscription = await getExistingBrowserPushSubscription();
      if (subscription) {
        await withPushOperationTimeout(
          subscription.unsubscribe(),
          "This device took too long to reset notifications. Please try again.",
        );
      }
      setState("disabled");
      setMessage("The previous account subscription was reset. You may now enable notifications.");
    } catch {
      setState("conflict");
      setMessage("Unable to reset this device subscription. Please try again.");
    }
  }

  async function disableNotifications() {
    if (!supportsWebPush()) return;

    setState("disabling");
    setMessage("");

    try {
      const registration = await ensurePushServiceWorkerRegistration();
      const subscription = await getPushSubscription(registration);
      if (!subscription) {
        setState("disabled");
        return;
      }

      const response = await fetchPushSubscriptionApi("/api/push-subscriptions", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Unable to disable notifications");

      await withPushOperationTimeout(
        subscription.unsubscribe(),
        "This device took too long to disable notifications. Please try again.",
      );
      setState("disabled");
      setMessage("DSI reminders are disabled on this device.");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Unable to disable notifications");
    }
  }

  const workingLabels: Partial<Record<SetupState, string>> = {
    checking: "Checking...",
    "requesting-permission": "Requesting permission...",
    registering: "Registering app...",
    subscribing: "Subscribing device...",
    saving: "Saving subscription...",
    disabling: "Disabling...",
    resetting: "Resetting...",
  };
  const workingMessages: Partial<Record<SetupState, string>> = {
    checking: "Checking this device's notification status...",
    "requesting-permission": "Waiting for your notification permission choice...",
    registering: "Preparing Falcon Hub notifications on this device...",
    subscribing: "Creating this device's secure notification subscription...",
    saving: "Saving this device's subscription to your Falcon Hub account...",
    disabling: "Removing this device's notification subscription...",
    resetting: "Resetting the previous account's subscription on this device...",
  };
  const isWorking = state in workingLabels;
  const buttonLabel = workingLabels[state] ?? (state === "error" ? "Try Again" : "Enable Notifications");

  return (
    <section className="mt-4 rounded-[24px] border border-zinc-200 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.04)] sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
            DSI Reminders
          </p>
          <h2 className="mt-1 text-lg font-semibold text-zinc-950">Browser notifications</h2>
          <p className="mt-1 text-sm leading-6 text-zinc-600">
            Receive reminders at 10:00 PM, 11:00 PM and 11:30 PM Malaysia time only when
            today&apos;s DSI is still not submitted.
          </p>
          <p className="mt-2 text-xs leading-5 text-zinc-500">
            iPhone and iPad: add Falcon Hub to the Home Screen, open the installed app, then
            enable notifications here. Android users may enable notifications in a supported
            browser or installed web app.
          </p>
        </div>

        <div className="shrink-0">
          {state === "conflict" ? (
            <button
              type="button"
              onClick={resetNotificationsForThisAccount}
              disabled={isWorking}
              className="rounded-full border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-900 transition hover:bg-amber-100 disabled:opacity-50"
            >
              Reset this device
            </button>
          ) : state === "enabled" ? (
            <button
              type="button"
              onClick={disableNotifications}
              disabled={isWorking}
              className="rounded-full border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50 disabled:opacity-50"
            >
              Disable on this device
            </button>
          ) : (
            <button
              type="button"
              onClick={state === "error"
                ? () => setStatusCheckAttempt((attempt) => attempt + 1)
                : enableNotifications}
              disabled={
                isWorking ||
                state === "unsupported" ||
                state === "denied" ||
                (state !== "error" && !publicKey)
              }
              className="rounded-full bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
            >
              {buttonLabel}
            </button>
          )}
        </div>
      </div>

      <div className="mt-3 text-sm">
        {state === "enabled" ? (
          <p className="font-medium text-emerald-700">● Enabled on this device</p>
        ) : state === "denied" ? (
          <p className="text-amber-700">
            Notifications are blocked in this device&apos;s settings. Allow Falcon Hub
            notifications there, then return to this page.
          </p>
        ) : state === "unsupported" ? (
          <p className="text-amber-700">
            This browser does not support Web Push. On iPhone or iPad, use the Home Screen app.
          </p>
        ) : state === "disabled" ? (
          <p className="text-zinc-500">Not enabled on this device.</p>
        ) : workingMessages[state] ? (
          <p aria-live="polite" className="text-zinc-500">
            {workingMessages[state]}
          </p>
        ) : null}
        {message ? (
          <p className={`mt-1 ${state === "error" ? "text-red-700" : "text-zinc-600"}`}>
            {message}
          </p>
        ) : null}
      </div>
    </section>
  );
}
