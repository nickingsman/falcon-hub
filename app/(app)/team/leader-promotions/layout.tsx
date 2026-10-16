import { notFound } from "next/navigation";
import { getAuthenticatedUserProfile } from "@/lib/auth";
import { canManageLeaderPromotions } from "@/lib/permissions";

export default async function LeaderPromotionsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const authContext = await getAuthenticatedUserProfile();
  if (!authContext || !canManageLeaderPromotions(authContext.profile)) notFound();
  return children;
}
