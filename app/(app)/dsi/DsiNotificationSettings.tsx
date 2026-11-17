"use client";

import { useEffect, useState } from "react";
import { getExistingBrowserPushSubscription } from "@/lib/push-subscription-client";

type SetupState =
  | "loading"
  | "unsupported"
  | "disabled"
  | "denied"
  | "enabled"
  | "conflict"
  | "working"
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

async function getCurrentSubscription() {
  const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

export default function DsiNotificationSettings() {
  const [state, setState] = useState<SetupState>("loading");
  const [message, setMessage] = useState("");
  const [publicKey, setPublicKey] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadStatus() {
      if (!supportsWebPush()) {
        if (!cancelled) setState("unsupported");
        return;
      }

      if (Notification.permission === "denied") {
        if (!cancelled) setState("denied");
        return;
      }

      try {
        const subscription = await getExistingBrowserPushSubscription();
        const endpointQuery = subscription
          ? `?endpoint=${encodeURIComponent(subscription.endpoint)}`
          : "";
        const response = await fetch(`/api/push-subscriptions${endpointQuery}`, {
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
  }, []);

  async function enableNotifications() {
    if (!supportsWebPush() || !publicKey) return;

    setState("working");
    setMessage("");

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "disabled");
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      const subscription = existing ?? await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeVapidPublicKey(publicKey),
      });
      const response = await fetch("/api/push-subscriptions", {
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
        if (!existing) await subscription.unsubscribe();
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
    setState("working");
    setMessage("");

    try {
      const subscription = await getExistingBrowserPushSubscription();
      if (subscription) await subscription.unsubscribe();
      setState("disabled");
      setMessage("The previous account subscription was reset. You may now enable notifications.");
    } catch {
      setState("conflict");
      setMessage("Unable to reset this device subscription. Please try again.");
    }
  }

  async function disableNotifications() {
    if (!supportsWebPush()) return;

    setState("working");
    setMessage("");

    try {
      const subscription = await getCurrentSubscription();
      if (!subscription) {
        setState("disabled");
        return;
      }

      const response = await fetch("/api/push-subscriptions", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Unable to disable notifications");

      await subscription.unsubscribe();
      setState("disabled");
      setMessage("DSI reminders are disabled on this device.");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Unable to disable notifications");
    }
  }

  const isWorking = state === "loading" || state === "working";

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
              onClick={enableNotifications}
              disabled={isWorking || state === "unsupported" || state === "denied" || !publicKey}
              className="rounded-full bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
            >
              {isWorking ? "Checking..." : "Enable Notifications"}
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
