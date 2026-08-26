"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { UserRole } from "@/lib/auth";

type AppPermissions = {
  displayName: string;
  email: string | null;
  role: UserRole | null;
  isActive: boolean;
  canManageProjects: boolean;
  canManageUserApprovals: boolean;
  canManageUsers: boolean;
};

const readOnlyPermissions: AppPermissions = {
  displayName: "User",
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
  const [currentPermissions, setCurrentPermissions] = useState<AppPermissions>({
    ...permissions,
    canManageProjects: false,
    canManageUserApprovals: false,
    canManageUsers: false,
  });

  useEffect(() => {
    let isMounted = true;

    async function refreshCurrentUser() {
      try {
        const response = await fetch("/api/auth/me", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Unable to verify current user");
        }

        const nextPermissions = await response.json();

        if (isMounted) {
          setCurrentPermissions(nextPermissions);
        }
      } catch (error) {
        console.error("Current user refresh error:", error);

        if (isMounted) {
          setCurrentPermissions(readOnlyPermissions);
        }
      }
    }

    void refreshCurrentUser();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <AppPermissionContext.Provider value={currentPermissions}>
      {children}
    </AppPermissionContext.Provider>
  );
}

export function useAppPermissions() {
  return useContext(AppPermissionContext);
}
