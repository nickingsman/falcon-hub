"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const sidebarItems = [
  { label: "Dashboard", href: "/" },
  { label: "Projects", href: "/projects" },
  { label: "ROI Calculator", href: "#" },
  { label: "DSR Calculator", href: "#" },
  { label: "Proposal Generator", href: "#" },
  { label: "Check In", href: "#" },
  { label: "DSI", href: "#" },
  {
    label: "Team",
    href: "#",
    children: [{ label: "Members", href: "/team/members" }],
  },
  {
    label: "Sales",
    href: "#",
    children: [{ label: "Sales Records", href: "#" }],
  },
  { label: "Training", href: "#" },
  { label: "Settings", href: "#" },
];

function isItemActive(pathname: string, item: (typeof sidebarItems)[number]) {
  if (item.label === "Dashboard") {
    return pathname === "/";
  }

  if (item.label === "Projects") {
    return pathname === "/projects" || pathname.startsWith("/projects/");
  }

  if (item.label === "Team") {
    return pathname.startsWith("/team/");
  }

  return false;
}

function isChildActive(pathname: string, href: string) {
  return href !== "#" && pathname === href;
}

export default function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-full border-b border-zinc-200 bg-white/80 p-6 backdrop-blur lg:w-72 lg:border-b-0 lg:border-r">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-900 text-sm font-semibold text-white">
          FH
        </div>
        <div>
          <p className="text-lg font-semibold">Falcon Hub</p>
          <p className="text-sm text-zinc-500">Operations Center</p>
        </div>
      </div>

      <nav className="mt-8 space-y-1">
        {sidebarItems.map((item) => {
          const isActive = isItemActive(pathname, item);

          return (
            <div key={item.label}>
              <Link
                href={item.href}
                className={`flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? "bg-zinc-900 text-white shadow-sm"
                    : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                }`}
              >
                <span>{item.label}</span>
                {isActive ? <span className="text-xs">●</span> : null}
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
                            ? "bg-zinc-100 font-medium text-zinc-900"
                            : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
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

      <div className="mt-8 rounded-3xl border border-zinc-200 bg-zinc-50 p-4">
        <p className="text-sm font-semibold">Today&apos;s focus</p>
        <p className="mt-2 text-sm text-zinc-600">
          Keep momentum on active projects and follow-up outreach.
        </p>
        <button className="mt-4 rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white">
          View plan
        </button>
      </div>
    </aside>
  );
}
