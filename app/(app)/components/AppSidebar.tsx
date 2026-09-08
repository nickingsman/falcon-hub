"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAppPermissions } from "./AppPermissionProvider";
import {
  getRoleLabel,
  getVisibleDesktopNavItems,
  isDesktopNavItemActive,
  isNavHrefActive,
} from "./navigation";

function isChildActive(pathname: string, href: string) {
  return isNavHrefActive(pathname, { label: "", href });
}

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
    <aside className="hidden w-full flex-col border-b border-zinc-800 bg-[var(--falcon-charcoal)] p-6 text-white lg:flex lg:min-h-screen lg:w-72 lg:border-b-0 lg:border-r">
      <div>
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

        <nav className="mt-7 space-y-1">
          {visibleSidebarItems.map((item) => {
            const isActive = isDesktopNavItemActive(pathname, item);

            return (
              <div key={item.label}>
                <Link
                  href={item.href}
                  className={`flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-sm font-medium transition ${
                    isActive
                      ? "border border-[rgba(184,146,74,0.34)] bg-zinc-900 text-white shadow-sm"
                      : "border border-transparent text-zinc-400 hover:border-zinc-800 hover:bg-zinc-900/70 hover:text-white"
                  }`}
                >
                  <span>{item.label}</span>
                  {isActive ? (
                    <span className="h-2 w-2 rounded-full bg-[var(--falcon-gold)]" aria-hidden />
                  ) : null}
                </Link>
                {item.children ? (
                  <div className="ml-4 mt-1 space-y-1">
                    {item.children.map((child) => {
                      const isActiveChild = isChildActive(pathname, child.href);

                      return (
                        <Link
                          key={child.label}
                          href={child.href}
                          className={`flex rounded-xl px-3 py-2 text-sm transition ${
                            isActiveChild
                              ? "border border-[rgba(184,146,74,0.28)] bg-zinc-900 font-medium text-white"
                              : "border border-transparent text-zinc-500 hover:border-zinc-800 hover:bg-zinc-900/70 hover:text-zinc-200"
                          }`}
                        >
                          {child.label}
                        </Link>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>
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
