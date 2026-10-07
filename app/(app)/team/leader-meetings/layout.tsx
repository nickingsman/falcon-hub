import { notFound } from "next/navigation";
import { getAuthenticatedUserProfile } from "@/lib/auth";
import { canAccessLeaderMeetings } from "@/lib/permissions";

export default async function LeaderMeetingsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const authContext = await getAuthenticatedUserProfile();
  if (!authContext || !(await canAccessLeaderMeetings(authContext.user.id, authContext.profile))) notFound();
  return children;
}
