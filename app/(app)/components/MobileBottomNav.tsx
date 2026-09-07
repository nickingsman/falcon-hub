"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  isMobilePrimaryActive,
  mobilePrimaryNavItems,
  type AppNavItem,
} from "./navigation";

type IconName = "home" | "dsi" | "check-in" | "calendar" | "more";

const navIcons: Record<string, IconName> = {
  Home: "home",
  DSI: "dsi",
  "Check In": "check-in",
  Calendar: "calendar",
  More: "more",
};

function NavIcon({ icon }: { icon: IconName }) {
  if (icon === "home") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
        <path
          d="M4.5 10.8 12 4.5l7.5 6.3v8.1a1.6 1.6 0 0 1-1.6 1.6h-3.1v-5.6H9.2v5.6H6.1a1.6 1.6 0 0 1-1.6-1.6z"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      </svg>
    );
  }

  if (icon === "dsi") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
        <path
          d="M5 19V9m4 10V5m4 14v-7m4 7V8"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.9"
        />
      </svg>
    );
  }

  if (icon === "check-in") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
        <path
          d="M12 21s6-5.2 6-10a6 6 0 0 0-12 0c0 4.8 6 10 6 10Z"
          fill="none"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
        <path
          d="M9.5 11.1 11.2 13l3.4-3.8"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      </svg>
    );
  }

  if (icon === "calendar") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
        <path
          d="M7 4v3m10-3v3M5 8.5h14M6.5 6h11A1.5 1.5 0 0 1 19 7.5v10A1.5 1.5 0 0 1 17.5 19h-11A1.5 1.5 0 0 1 5 17.5v-10A1.5 1.5 0 0 1 6.5 6Z"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
      <path
        d="M5 7h14M5 12h14M5 17h14"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.9"
      />
    </svg>
  );
}

function getItemIcon(item: AppNavItem) {
  return navIcons[item.label] ?? "more";
}

export default function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary mobile navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white/95 px-2 pt-2 shadow-[0_-12px_40px_rgba(15,23,42,0.08)] backdrop-blur lg:hidden"
      style={{ paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto grid max-w-lg grid-cols-5 gap-1">
        {mobilePrimaryNavItems.map((item) => {
          const isActive = isMobilePrimaryActive(pathname, item);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl px-1.5 text-[11px] font-semibold transition focus:outline-none focus:ring-2 focus:ring-zinc-300 ${
                isActive
                  ? "bg-zinc-950 text-white shadow-sm"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950"
              }`}
            >
              <NavIcon icon={getItemIcon(item)} />
              <span className="leading-none">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
