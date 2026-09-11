import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getAuthenticatedUserProfile, getRouteForProfileStatus } from "@/lib/auth";
import { welcomeHandoffHeaderName } from "@/lib/welcome-handoff";
import WelcomeIntroClient from "./WelcomeIntroClient";

export const dynamic = "force-dynamic";

function getSafeDestination(value: string | string[] | undefined) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return "/";

  const destination = new URL(value, "https://falcon-hub.local");
  if (destination.origin !== "https://falcon-hub.local") return "/";
  if (destination.pathname === "/login" || destination.pathname === "/welcome") return "/";

  return `${destination.pathname}${destination.search}${destination.hash}`;
}

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const destination = getSafeDestination((await searchParams).next);
  const shouldPlay = (await headers()).get(welcomeHandoffHeaderName) === "1";
  const authContext = await getAuthenticatedUserProfile().catch(() => null);

  if (!authContext) {
    redirect(`/login?next=${encodeURIComponent(destination)}`);
  }

  if (authContext.profile?.status !== "active") {
    redirect(getRouteForProfileStatus(authContext.profile?.status ?? null));
  }

  return <WelcomeIntroClient destination={destination} shouldPlay={shouldPlay} />;
}
