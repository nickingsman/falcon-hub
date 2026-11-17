import assert from "node:assert/strict";
import test from "node:test";
import {
  ensurePushServiceWorkerRegistration,
  withPushOperationTimeout,
} from "./push-subscription-client";

test("push operation timeout rejects a stalled browser operation", async () => {
  await assert.rejects(
    withPushOperationTimeout(new Promise<never>(() => undefined), "timed out", 5),
    /timed out/,
  );
});

test("push operation timeout preserves successful results", async () => {
  assert.equal(await withPushOperationTimeout(Promise.resolve("ready"), "timed out", 50), "ready");
});

test("service worker registration starts before waiting for readiness", async () => {
  const calls: string[] = [];
  const registration = {} as ServiceWorkerRegistration;
  const serviceWorkers = {
    register: async (scriptURL: string, options?: RegistrationOptions) => {
      calls.push(`register:${scriptURL}:${options?.scope}`);
      return registration;
    },
    get ready() {
      calls.push("ready");
      return Promise.resolve(registration);
    },
  } as ServiceWorkerContainer;

  assert.equal(await ensurePushServiceWorkerRegistration(serviceWorkers), registration);
  assert.deepEqual(calls, ["register:/sw.js:/", "ready"]);
});
