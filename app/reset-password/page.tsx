import { cookies } from "next/headers";
import AuthFrame from "@/app/components/AuthFrame";
import ResetPasswordForm from "@/app/reset-password/ResetPasswordForm";
import { passwordRecoveryCookieName } from "@/lib/password-recovery";
import { createSupabaseSsrClient } from "@/lib/supabase-ssr";

export default async function ResetPasswordPage() {
  const cookieStore = await cookies();
  const hasRecoveryContext = cookieStore.get(passwordRecoveryCookieName)?.value === "1";
  let hasAuthenticatedUser = false;

  if (hasRecoveryContext) {
    const supabase = await createSupabaseSsrClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    hasAuthenticatedUser = Boolean(user);
  }

  return (
    <AuthFrame
      eyebrow="Account recovery"
      title="Reset Password"
      description="Choose a new password for your Falcon Hub account."
    >
      <ResetPasswordForm recoveryValid={hasRecoveryContext && hasAuthenticatedUser} />
    </AuthFrame>
  );
}
