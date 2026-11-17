"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { logoutWithPushCleanup } from "@/lib/push-subscription-client";
import { useAppPermissions } from "../components/AppPermissionProvider";
import AppNavigationMenu from "../components/AppNavigationMenu";
import {
  getRoleLabel,
  getVisibleDesktopNavItems,
} from "../components/navigation";

export default function MorePage() {
  const router = useRouter();
  const pathname = usePathname();
  const permissions = useAppPermissions();
  const navigationItems = getVisibleDesktopNavItems(permissions);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");

  async function handleLogout() {
    try {
      setIsLoggingOut(true);
      setLogoutError("");
      await logoutWithPushCleanup();

      router.replace("/login");
      router.refresh();
    } catch (error) {
      setLogoutError(error instanceof Error ? error.message : "Unable to sign out safely");
      setIsLoggingOut(false);
    }
  }

  return (
    <main className="overflow-x-hidden px-4 py-6 text-zinc-950 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
        <section className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-[0_14px_42px_rgba(15,23,42,0.05)] sm:p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#087F6B]">
            Falcon Hub
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">
            More
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
            Tools, team pages and your saved work.
          </p>
        </section>

        <section className="rounded-[24px] border border-zinc-200 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.04)] sm:p-5">
          <AppNavigationMenu
            key={pathname}
            items={navigationItems}
            pathname={pathname}
            variant="mobile"
          />
        </section>

        <section className="rounded-[24px] border border-zinc-200 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.04)] sm:p-5">
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
            Account
          </h2>
          <div className="mt-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <p className="truncate text-sm font-semibold text-zinc-950">
              {permissions.displayName}
            </p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
              {getRoleLabel(permissions.role)}
            </p>
            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="mt-4 min-h-11 rounded-full border border-zinc-300 bg-white px-5 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-300"
            >
              {isLoggingOut ? "Signing out..." : "Logout"}
            </button>
            {logoutError ? (
              <p role="alert" className="mt-2 text-sm text-red-700">
                {logoutError}
              </p>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
