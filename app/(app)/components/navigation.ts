"use client";

import type { UserRole } from "@/lib/auth";

export type NavigationPermissions = {
  role: UserRole | null;
  canManageUserApprovals: boolean;
  canManageUsers: boolean;
  canAccessCustomerBirthdays: boolean;
  canAccessLeaderMeetings: boolean;
  canManageLeaderPromotions: boolean;
  leaderPromotionPendingCount: number;
};

export type AppNavItem = {
  label: string;
  href: string;
  permission?:
    | "canManageUserApprovals"
    | "canManageUsers"
    | "canAccessCustomerBirthdays"
    | "canAccessLeaderMeetings"
    | "canManageLeaderPromotions";
  badgeCount?: number;
  minRole?: "leader";
  children?: AppNavItem[];
};

export const desktopNavItems: AppNavItem[] = [
  { label: "Dashboard", href: "/" },
  { label: "Projects", href: "/projects" },
  {
    label: "Agent Tools",
    href: "#",
    children: [
      { label: "Property Map", href: "/property-map" },
      { label: "Unit Calculation", href: "/tools/roi-calculator" },
      { label: "Loan Amortization", href: "/tools/loan-amortization" },
      { label: "Investment Simulator", href: "/tools/investment-simulator" },
      { label: "Project Comparison", href: "/tools/project-comparison" },
      { label: "Smart Project Finder", href: "/tools/smart-project-finder" },
      { label: "Progressive Interest", href: "/tools/progressive-interest" },
      { label: "Payment Schedule", href: "/tools/buyer-payment-schedule" },
      { label: "DSR Calculator", href: "/tools/dsr-calculator" },
      { label: "Saved Work", href: "/saved-work" },
    ],
  },
  { label: "生涯运数", href: "/tools/career-numerology", permission: "canManageUsers" },
  {
    label: "Daily Operations",
    href: "#",
    children: [
      { label: "Check In", href: "/check-in" },
      { label: "DSI Update", href: "/dsi" },
      { label: "Calendar", href: "/calendar" },
      {
        label: "Customer Birthday",
        href: "/customer-birthdays",
        permission: "canAccessCustomerBirthdays",
      },
    ],
  },
  {
    label: "Team Management",
    href: "#",
    children: [
      { label: "Members", href: "/team/members" },
      { label: "User Management", href: "/team/user-management", permission: "canManageUsers" },
      { label: "Leader Meeting", href: "/team/leader-meetings", permission: "canAccessLeaderMeetings" },
      { label: "Leader Promotions", href: "/team/leader-promotions", permission: "canManageLeaderPromotions" },
      { label: "Attendance", href: "/team/attendance", minRole: "leader" },
      { label: "User Approval", href: "/team/user-approvals", permission: "canManageUserApprovals" },
    ],
  },
  {
    label: "Sales",
    href: "#",
    children: [{ label: "Sales Record", href: "/sales" }],
  },
  { label: "Falcon Academy", href: "/academy" },
];

export const mobilePrimaryNavItems: AppNavItem[] = [
  { label: "Home", href: "/" },
  { label: "DSI", href: "/dsi" },
  { label: "Check In", href: "/check-in" },
  { label: "Calendar", href: "/calendar" },
  { label: "More", href: "/more" },
];

function canViewAttendance(permissions: NavigationPermissions) {
  return (
    permissions.role === "super_admin" ||
    permissions.role === "admin" ||
    permissions.role === "leader"
  );
}

function isVisibleItem(item: AppNavItem, permissions: NavigationPermissions) {
  if (item.permission === "canManageUserApprovals") return permissions.canManageUserApprovals;
  if (item.permission === "canManageUsers") return permissions.canManageUsers;
  if (item.permission === "canAccessCustomerBirthdays") return permissions.canAccessCustomerBirthdays;
  if (item.permission === "canAccessLeaderMeetings") return permissions.canAccessLeaderMeetings;
  if (item.permission === "canManageLeaderPromotions") return permissions.canManageLeaderPromotions;
  if (item.minRole === "leader") return canViewAttendance(permissions);

  return true;
}

export function getVisibleDesktopNavItems(permissions: NavigationPermissions) {
  return desktopNavItems.flatMap((item) => {
    if (!isVisibleItem(item, permissions)) return [];
    if (!item.children) return [item];

    const children = item.children
      .filter((child) => isVisibleItem(child, permissions))
      .map((child) =>
        child.href === "/team/leader-promotions"
          ? { ...child, badgeCount: permissions.leaderPromotionPendingCount }
          : child,
      );

    return children.length ? [{ ...item, children }] : [];
  });
}

export function isNavHrefActive(pathname: string, item: AppNavItem) {
  if (item.href === "/") return pathname === "/";
  if (item.href === "#") return false;

  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function isDesktopNavItemActive(
  pathname: string,
  item: AppNavItem,
): boolean {
  if (item.children) {
    return item.children.some((child) => isDesktopNavItemActive(pathname, child));
  }
  if (item.label === "Property Map") {
    return pathname === "/projects/map" || isNavHrefActive(pathname, item);
  }
  if (item.label === "Projects") {
    return pathname === "/projects" || (
      pathname.startsWith("/projects/") && pathname !== "/projects/map"
    );
  }

  return isNavHrefActive(pathname, item);
}

export function getActiveDesktopNavGroup(
  pathname: string,
  items: AppNavItem[],
) {
  return (
    items.find(
      (item) => item.children && isDesktopNavItemActive(pathname, item),
    )?.label ?? null
  );
}

export function getNextExpandedNavGroup(
  currentGroup: string | null,
  selectedGroup: string,
) {
  return currentGroup === selectedGroup ? null : selectedGroup;
}

export function isMobilePrimaryActive(pathname: string, item: AppNavItem) {
  if (item.href === "/more") {
    return !mobilePrimaryNavItems
      .filter((navItem) => navItem.href !== "/more")
      .some((navItem) => isNavHrefActive(pathname, navItem));
  }

  return isNavHrefActive(pathname, item);
}

export function getRoleLabel(role: UserRole | null) {
  if (role === "super_admin") return "Super Admin";
  if (role === "admin") return "Admin";
  if (role === "leader") return "Leader";
  if (role === "agent") return "Agent";

  return "Read Only";
}
