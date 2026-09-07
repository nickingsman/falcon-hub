"use client";

import type { UserRole } from "@/lib/auth";

export type NavigationPermissions = {
  role: UserRole | null;
  canManageUserApprovals: boolean;
  canManageUsers: boolean;
};

export type AppNavItem = {
  label: string;
  href: string;
  permission?: "canManageUsers";
  minRole?: "leader";
  children?: AppNavItem[];
};

export type MoreNavSection = {
  title: string;
  items: AppNavItem[];
};

export const desktopNavItems: AppNavItem[] = [
  { label: "Dashboard", href: "/" },
  { label: "Projects", href: "/projects" },
  { label: "Unit Calculation", href: "/tools/roi-calculator" },
  { label: "Project Comparison", href: "/tools/project-comparison" },
  { label: "Smart Project Finder", href: "/tools/smart-project-finder" },
  { label: "Progressive Interest", href: "/tools/progressive-interest" },
  { label: "Payment Schedule", href: "/tools/buyer-payment-schedule" },
  { label: "DSR Calculator", href: "#" },
  { label: "Proposal Generator", href: "#" },
  { label: "Check In", href: "/check-in" },
  { label: "Calendar", href: "/calendar" },
  { label: "Customer Birthdays", href: "/customer-birthdays" },
  { label: "Saved Work", href: "/saved-work" },
  { label: "DSI", href: "/dsi" },
  {
    label: "Team",
    href: "#",
    children: [
      { label: "Members", href: "/team/members" },
      { label: "User Management", href: "/team/user-management", permission: "canManageUsers" },
    ],
  },
  {
    label: "Sales",
    href: "#",
    children: [{ label: "Sales Records", href: "#" }],
  },
  { label: "Training", href: "#" },
  { label: "Settings", href: "#" },
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
  if (item.permission === "canManageUsers") return permissions.canManageUsers;
  if (item.minRole === "leader") return canViewAttendance(permissions);

  return true;
}

export function getVisibleDesktopNavItems(permissions: NavigationPermissions) {
  return desktopNavItems.map((item) => {
    if (item.label !== "Team") return item;

    return {
      ...item,
      children: [
        ...((item.children ?? []).filter((child) => isVisibleItem(child, permissions))),
        ...(canViewAttendance(permissions)
          ? [{ label: "Attendance", href: "/team/attendance" }]
          : []),
        ...(permissions.canManageUserApprovals
          ? [{ label: "User Approvals", href: "/team/user-approvals" }]
          : []),
      ],
    };
  });
}

export function getMoreNavSections(permissions: NavigationPermissions): MoreNavSection[] {
  return [
    {
      title: "Work / Projects",
      items: [{ label: "Projects", href: "/projects" }],
    },
    {
      title: "Customer Tools",
      items: [
        { label: "Unit Calculation", href: "/tools/roi-calculator" },
        { label: "Project Comparison", href: "/tools/project-comparison" },
        { label: "Smart Project Finder", href: "/tools/smart-project-finder" },
        { label: "Progressive Interest", href: "/tools/progressive-interest" },
        { label: "Payment Schedule", href: "/tools/buyer-payment-schedule" },
      ],
    },
    {
      title: "My Work",
      items: [
        { label: "Saved Work", href: "/saved-work" },
        { label: "Customer Birthdays", href: "/customer-birthdays" },
      ],
    },
    {
      title: "Team",
      items: [
        { label: "Members", href: "/team/members" },
        ...(canViewAttendance(permissions)
          ? [{ label: "Attendance", href: "/team/attendance" }]
          : []),
        ...(permissions.canManageUsers
          ? [{ label: "User Management", href: "/team/user-management" }]
          : []),
        ...(permissions.canManageUserApprovals
          ? [{ label: "User Approvals", href: "/team/user-approvals" }]
          : []),
      ],
    },
  ].filter((section) => section.items.length > 0);
}

export function isNavHrefActive(pathname: string, item: AppNavItem) {
  if (item.href === "/") return pathname === "/";
  if (item.href === "#") return false;

  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function isDesktopNavItemActive(pathname: string, item: AppNavItem) {
  if (item.label === "Team") return pathname.startsWith("/team/");
  if (item.label === "Projects") return pathname === "/projects" || pathname.startsWith("/projects/");

  return isNavHrefActive(pathname, item);
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
