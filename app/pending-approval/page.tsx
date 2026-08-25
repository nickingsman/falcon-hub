import { redirect } from "next/navigation";
import {
  getAuthenticatedUserProfile,
  getRouteForProfileStatus,
} from "@/lib/auth";

const currentPath = "/pending-approval";

async function enforceStatusPage() {
  const authContext = await getAuthenticatedUserProfile();
  const statusRoute = getRouteForProfileStatus(authContext?.profile?.status ?? null);

  if (!authContext) {
    redirect("/login");
  }

  if (statusRoute !== currentPath) {
    redirect(statusRoute);
  }
}

export default async function PendingApprovalPage() {
  await enforceStatusPage();

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f7f3] px-6 py-12 text-zinc-900">
      <div className="w-full max-w-lg rounded-[28px] border border-zinc-200 bg-white p-8 text-center shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-900 text-sm font-semibold text-white">
          FH
        </div>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight text-zinc-900">
          Account Pending Approval
        </h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600">
          Your Falcon Hub account is pending approval. An administrator will
          review your registration before you can access the workspace.
        </p>
      </div>
    </main>
  );
}
