import { notFound } from "next/navigation";

import { getAuthenticatedUserProfile } from "@/lib/auth";
import { canManageUsers } from "@/lib/permissions";

export default async function CareerNumerologyLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const authContext = await getAuthenticatedUserProfile();

  if (!canManageUsers(authContext?.profile ?? null)) notFound();

  return children;
}
