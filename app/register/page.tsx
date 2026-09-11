"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import AuthFrame from "@/app/components/AuthFrame";

const inputClass = "w-full rounded-2xl border border-[var(--falcon-soft-border)] bg-[#fbfaf7] px-4 py-3.5 text-[15px] text-zinc-950 outline-none transition placeholder:text-zinc-400 hover:border-zinc-300 focus:border-[var(--falcon-gold-dark)] focus:bg-white focus:ring-4 focus:ring-[#b8924a]/10";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setIsSubmitting(true);
      setErrorMessage("");

      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
          confirmPassword,
          inviteCode,
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to register account");
      }

      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        router.replace("/login");
        router.refresh();
        return;
      }

      router.replace("/pending-approval");
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to register account"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthFrame eyebrow="Invited registration" title="Join Falcon Hub" description="Registration is available by Falcon invitation only.">
        <form onSubmit={handleSubmit} className="space-y-5">
          <label className="block text-sm text-zinc-600">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-zinc-700">Invite Code</span>
            <input
              type="text"
              required
              autoCapitalize="characters"
              autoComplete="off"
              value={inviteCode}
              onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
              className={`${inputClass} font-mono uppercase tracking-wide`}
              placeholder="FALCON-XXXX-XXXX-XXXX-XXXX"
            />
          </label>

          <label className="block text-sm text-zinc-600">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-zinc-700">Email</span>
            <input
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={inputClass}
              placeholder="name@company.com"
            />
          </label>

          <label className="block text-sm text-zinc-600">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-zinc-700">Password</span>
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={inputClass}
              placeholder="At least 8 characters"
            />
          </label>

          <label className="block text-sm text-zinc-600">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-zinc-700">Confirm Password</span>
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className={inputClass}
              placeholder="Repeat your password"
            />
          </label>

          {errorMessage ? (
            <div role="alert" aria-live="polite" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
              {errorMessage}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="min-h-12 w-full rounded-full bg-zinc-950 px-5 py-3 text-sm font-semibold text-white shadow-[0_8px_22px_rgba(24,24,27,0.16)] transition hover:bg-zinc-800 focus:outline-none focus:ring-4 focus:ring-zinc-900/15 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Creating account..." : "Register"}
          </button>

          <p className="border-t border-[var(--falcon-soft-border)] pt-5 text-center text-sm text-zinc-500">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-[var(--falcon-gold-dark)] underline-offset-4 hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--falcon-gold)]/40">
              Sign in
            </Link>
          </p>
        </form>
    </AuthFrame>
  );
}
