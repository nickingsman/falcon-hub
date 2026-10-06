import { notFound } from "next/navigation";
import { getAuthenticatedUserProfile } from "@/lib/auth";
import { canAccessWhatsAppFlow } from "@/lib/permissions";

export default async function WhatsAppFlowLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const authContext = await getAuthenticatedUserProfile();
  if (!canAccessWhatsAppFlow(authContext?.profile ?? null)) notFound();
  return children;
}
