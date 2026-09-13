"use client";

import { createContext, useContext } from "react";
import type { UserRole } from "@/lib/auth";

type AppPermissions = {
  displayName: string;
  memberCode: number | null;
  phone: string | null;
  email: string | null;
  role: UserRole | null;
  isActive: boolean;
  canManageProjects: boolean;
  canManageUserApprovals: boolean;
  canManageUsers: boolean;
};

const readOnlyPermissions: AppPermissions = {
  displayName: "User",
  memberCode: null,
  phone: null,
  email: null,
  role: null,
  isActive: false,
  canManageProjects: false,
  canManageUserApprovals: false,
  canManageUsers: false,
};

const AppPermissionContext = createContext<AppPermissions>(readOnlyPermissions);

export function AppPermissionProvider({
  children,
  permissions,
}: Readonly<{
  children: React.ReactNode;
  permissions: AppPermissions;
}>) {
  return (
    <AppPermissionContext.Provider value={permissions}>
      {children}
    </AppPermissionContext.Provider>
  );
}

export function useAppPermissions() {
  return useContext(AppPermissionContext);
}
