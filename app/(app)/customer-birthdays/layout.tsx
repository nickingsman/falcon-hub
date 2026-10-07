import { notFound } from "next/navigation";
import { getAuthenticatedUserProfile } from "@/lib/auth";
import { canAccessCustomerBirthdays } from "@/lib/permissions";

export default async function CustomerBirthdaysLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const authContext = await getAuthenticatedUserProfile();
  if (!canAccessCustomerBirthdays(authContext?.profile ?? null)) notFound();
  return children;
}
