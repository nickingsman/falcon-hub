import { redirect } from "next/navigation";
import {
  getAuthenticatedUserProfile,
  getRouteForProfileStatus,
} from "@/lib/auth";
import { canManageProjects } from "@/lib/permissions";
import { createSupabaseSsrClient } from "@/lib/supabase-ssr";
import { AppPermissionProvider } from "./components/AppPermissionProvider";
import AppSidebar from "./components/AppSidebar";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const authContext = await getAuthenticatedUserProfile().catch(() => null);
  const profile = authContext?.profile ?? null;

  if (!authContext) {
    redirect("/login");
  }

  if (profile?.status !== "active") {
    redirect(getRouteForProfileStatus(profile?.status ?? null));
  }

  let memberDisplayName: string | null = null;

  if (profile?.member_id) {
    const supabase = await createSupabaseSsrClient();
    const { data: member } = await supabase
      .from("users")
      .select("full_name")
      .eq("id", profile.member_id)
      .maybeSingle();

    memberDisplayName =
      typeof member?.full_name === "string" && member.full_name.trim()
        ? member.full_name.trim()
        : null;
  }

  const metadataFullName = authContext?.user.user_metadata?.full_name;
  const metadataName = authContext?.user.user_metadata?.name;
  const displayName =
    memberDisplayName ||
    (typeof metadataFullName === "string" && metadataFullName.trim()
      ? metadataFullName.trim()
      : null) ||
    (typeof metadataName === "string" && metadataName.trim()
      ? metadataName.trim()
      : null) ||
    authContext?.user.email ||
    "User";
  const permissions = {
    displayName,
    email: authContext?.user.email ?? null,
    role: profile?.role ?? null,
    isActive: profile?.status === "active",
    canManageProjects: canManageProjects(profile),
  };

  return (
    <div className="min-h-screen bg-[#f7f7f3] text-zinc-900">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col lg:flex-row">
        <AppPermissionProvider permissions={permissions}>
          <AppSidebar />
          <div className="min-w-0 flex-1">
            {children}
          </div>
        </AppPermissionProvider>
      </div>
    </div>
  );
}
