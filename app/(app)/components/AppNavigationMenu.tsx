"use client";

import Link from "next/link";
import { useState, type ComponentType } from "react";
import {
  BarChart3,
  BookOpen,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ChartNoAxesCombined,
  ChevronDown,
  ClipboardCheck,
  Clock3,
  Compass,
  CreditCard,
  FolderKanban,
  GraduationCap,
  Landmark,
  LayoutDashboard,
  MapPinned,
  PiggyBank,
  ReceiptText,
  Save,
  SearchCheck,
  Sparkles,
  UserCheck,
  Users,
  Wrench,
} from "lucide-react";
import {
  getActiveDesktopNavGroup,
  getNextExpandedNavGroup,
  isDesktopNavItemActive,
  type AppNavItem,
} from "./navigation";

type NavigationIcon = ComponentType<{
  "aria-hidden"?: boolean;
  className?: string;
  strokeWidth?: number;
}>;

const navigationIcons: Record<string, NavigationIcon> = {
  Dashboard: LayoutDashboard,
  Projects: Building2,
  "Agent Tools": Wrench,
  "Property Map": MapPinned,
  "Unit Calculation": ChartNoAxesCombined,
  "Loan Amortization": Landmark,
  "Investment Simulator": PiggyBank,
  "Project Comparison": BarChart3,
  "Smart Project Finder": SearchCheck,
  "Progressive Interest": Clock3,
  "Payment Schedule": CreditCard,
  "DSR Calculator": ReceiptText,
  "Saved Work": Save,
  生涯运数: Compass,
  "Daily Operations": CalendarDays,
  "Check In": ClipboardCheck,
  "DSI Update": Sparkles,
  Calendar: CalendarDays,
  "Customer Birthday": UserCheck,
  "Team Management": Users,
  Members: Users,
  "User Management": UserCheck,
  "Leader Meeting": BriefcaseBusiness,
  "Leader Promotions": UserCheck,
  Attendance: ClipboardCheck,
  "User Approval": UserCheck,
  Sales: ChartNoAxesCombined,
  "Sales Record": FolderKanban,
  "Falcon Academy": GraduationCap,
};

function NavigationItemIcon({ item }: { item: AppNavItem }) {
  const Icon = navigationIcons[item.label] ?? BookOpen;

  return (
    <Icon
      aria-hidden
      className="h-[18px] w-[18px] shrink-0"
      strokeWidth={1.8}
    />
  );
}

export default function AppNavigationMenu({
  items,
  pathname,
  variant = "sidebar",
}: {
  items: AppNavItem[];
  pathname: string;
  variant?: "sidebar" | "mobile";
}) {
  const [expandedGroup, setExpandedGroup] = useState<string | null>(() =>
    getActiveDesktopNavGroup(pathname, items),
  );
  const isSidebar = variant === "sidebar";

  return (
    <nav
      aria-label={isSidebar ? "Primary navigation" : "More navigation"}
      className={isSidebar ? "space-y-1" : "space-y-2"}
    >
      {items.map((item) => {
        const isActive = isDesktopNavItemActive(pathname, item);

        if (item.children) {
          const isExpanded = expandedGroup === item.label;
          const panelId = `navigation-group-${item.label
            .toLocaleLowerCase("en-MY")
            .replace(/[^a-z0-9]+/g, "-")}`;

          return (
            <div key={item.label}>
              <button
                type="button"
                aria-controls={panelId}
                aria-expanded={isExpanded}
                onClick={() =>
                  setExpandedGroup((currentGroup) =>
                    getNextExpandedNavGroup(currentGroup, item.label),
                  )
                }
                className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left text-sm font-medium transition focus:outline-none focus:ring-2 ${
                  isSidebar
                    ? isActive
                      ? "border-[rgba(184,146,74,0.34)] bg-zinc-900 text-white shadow-sm focus:ring-[var(--falcon-gold)]"
                      : "border-transparent text-zinc-400 hover:border-zinc-800 hover:bg-zinc-900/70 hover:text-white focus:ring-zinc-600"
                    : isActive
                      ? "border-zinc-300 bg-zinc-950 text-white shadow-sm focus:ring-zinc-400"
                      : "border-zinc-200 bg-zinc-50 text-zinc-800 hover:border-zinc-300 hover:bg-white focus:ring-zinc-300"
                }`}
              >
                <NavigationItemIcon item={item} />
                <span className="min-w-0 flex-1">{item.label}</span>
                <ChevronDown
                  aria-hidden
                  className={`h-4 w-4 shrink-0 transition-transform ${
                    isExpanded ? "rotate-180" : ""
                  }`}
                  strokeWidth={1.8}
                />
              </button>

              {isExpanded ? (
                <div
                  id={panelId}
                  role="group"
                  aria-label={`${item.label} links`}
                  className={`mt-1 space-y-1 ${isSidebar ? "ml-4" : "ml-3 border-l border-zinc-200 pl-3"}`}
                >
                  {item.children.map((child) => {
                    const isActiveChild = isDesktopNavItemActive(
                      pathname,
                      child,
                    );

                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        aria-current={isActiveChild ? "page" : undefined}
                        className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-sm transition focus:outline-none focus:ring-2 ${
                          isSidebar
                            ? isActiveChild
                              ? "border-[rgba(184,146,74,0.28)] bg-zinc-900 font-medium text-white focus:ring-[var(--falcon-gold)]"
                              : "border-transparent text-zinc-500 hover:border-zinc-800 hover:bg-zinc-900/70 hover:text-zinc-200 focus:ring-zinc-600"
                            : isActiveChild
                              ? "border-zinc-300 bg-zinc-100 font-semibold text-zinc-950 focus:ring-zinc-300"
                              : "border-transparent text-zinc-600 hover:border-zinc-200 hover:bg-zinc-50 hover:text-zinc-950 focus:ring-zinc-300"
                        }`}
                      >
                        <NavigationItemIcon item={child} />
                        <span className="min-w-0 flex-1">{child.label}</span>
                        {child.badgeCount ? (
                          <span className="rounded-full bg-[var(--falcon-gold)] px-2 py-0.5 text-xs font-semibold text-zinc-950">
                            {child.badgeCount}
                          </span>
                        ) : null}
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-sm font-medium transition focus:outline-none focus:ring-2 ${
              isSidebar
                ? isActive
                  ? "border-[rgba(184,146,74,0.34)] bg-zinc-900 text-white shadow-sm focus:ring-[var(--falcon-gold)]"
                  : "border-transparent text-zinc-400 hover:border-zinc-800 hover:bg-zinc-900/70 hover:text-white focus:ring-zinc-600"
                : isActive
                  ? "border-zinc-300 bg-zinc-950 text-white shadow-sm focus:ring-zinc-400"
                  : "border-zinc-200 bg-zinc-50 text-zinc-800 hover:border-zinc-300 hover:bg-white focus:ring-zinc-300"
            }`}
          >
            <NavigationItemIcon item={item} />
            <span className="min-w-0 flex-1">{item.label}</span>
            {isActive && isSidebar ? (
              <span
                className="h-2 w-2 rounded-full bg-[var(--falcon-gold)]"
                aria-hidden
              />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
