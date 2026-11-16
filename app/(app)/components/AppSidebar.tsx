"use client";

import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useAppPermissions } from "./AppPermissionProvider";
import AppNavigationMenu from "./AppNavigationMenu";
import {
  getRoleLabel,
  getVisibleDesktopNavItems,
} from "./navigation";

export default function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const permissions = useAppPermissions();
  const { displayName, role } = permissions;
  const visibleSidebarItems = getVisibleDesktopNavItems(permissions);

  async function handleLogout() {
    await fetch("/api/auth/logout", {
      method: "POST",
    });

    router.replace("/login");
    router.refresh();
  }

  return (
    <aside className="hidden w-full flex-col border-b border-zinc-800 bg-[var(--falcon-charcoal)] p-6 text-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-72 lg:border-b-0 lg:border-r">
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <div className="flex items-center gap-3">
          <div className="flex h-[88px] w-[76px] items-center justify-center">
            <Image
              src="/brand/kingsman-falcon-logo-transparent.png"
              alt="Kingsman Falcon"
              width={1350}
              height={1625}
              priority
              className="h-full w-full object-contain"
            />
          </div>
          <div>
            <p className="text-base font-semibold text-white">Falcon Hub</p>
            <p className="text-sm text-zinc-400">Operations Center</p>
          </div>
        </div>

        <div className="mt-7">
          <AppNavigationMenu
            key={pathname}
            items={visibleSidebarItems}
            pathname={pathname}
          />
        </div>
      </div>

      <div className="mt-auto pt-6">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-3">
          <p className="text-sm font-semibold text-white">Today&apos;s focus</p>
          <p className="mt-1 text-xs leading-5 text-zinc-400">
            Keep momentum on active projects.
          </p>
        </div>

        <div className="mt-3 rounded-3xl border border-zinc-800 bg-zinc-950/40 p-4">
          <p className="truncate text-sm font-semibold text-white">
            {displayName}
          </p>
          <p className="mt-1 text-xs font-medium uppercase tracking-wide text-zinc-500">
            {getRoleLabel(role)}
          </p>
          <button
            type="button"
            onClick={handleLogout}
            className="mt-4 rounded-full border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:border-[var(--falcon-gold)] hover:bg-zinc-900 hover:text-white focus:outline-none focus:ring-2 focus:ring-[var(--falcon-gold)] focus:ring-offset-2 focus:ring-offset-[var(--falcon-charcoal)]"
          >
            Logout
          </button>
        </div>
      </div>
    </aside>
  );
}
