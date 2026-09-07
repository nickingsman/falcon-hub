import { getAuthenticatedUserProfile } from "@/lib/auth";
import { hasRole } from "@/lib/permissions";
import AcademyCourseEditorClient from "./AcademyCourseEditorClient";

export const dynamic = "force-dynamic";

function AccessDenied() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-[24px] border border-zinc-200 bg-white p-6 shadow-[0_12px_34px_rgba(15,23,42,0.05)]">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-zinc-500">
          Falcon Academy
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-950">Access Denied</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600">
          Academy management is available only to Admin and Super Admin users.
        </p>
      </section>
    </main>
  );
}

export default async function AcademyCourseEditorPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const authContext = await getAuthenticatedUserProfile();

  if (!hasRole(authContext?.profile ?? null, ["super_admin", "admin"])) {
    return <AccessDenied />;
  }

  const { courseId } = await params;

  return <AcademyCourseEditorClient courseId={courseId} />;
}
