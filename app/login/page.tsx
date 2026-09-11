"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import AuthFrame from "@/app/components/AuthFrame";

const inputClass = "w-full rounded-2xl border border-[var(--falcon-soft-border)] bg-[#fbfaf7] px-4 py-3.5 text-[15px] text-zinc-950 outline-none transition placeholder:text-zinc-400 hover:border-zinc-300 focus:border-[var(--falcon-gold-dark)] focus:bg-white focus:ring-4 focus:ring-[#b8924a]/10";

function getSafeNextDestination() {
  const requested = new URLSearchParams(window.location.search).get("next");
  if (!requested || !requested.startsWith("/") || requested.startsWith("//")) return "/";

  const destination = new URL(requested, window.location.origin);
  if (destination.origin !== window.location.origin) return "/";
  if (destination.pathname === "/login" || destination.pathname === "/welcome") return "/";

  return `${destination.pathname}${destination.search}${destination.hash}`;
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setIsSubmitting(true);
      setErrorMessage("");

      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        throw error;
      }

      const response = await fetch("/api/auth/me", {
        cache: "no-store",
      });
      const currentUser = await response.json();

      if (!response.ok) {
        throw new Error(currentUser.error || "Unable to load account status");
      }

      if (currentUser.statusRoute === "/") {
        const destination = getSafeNextDestination();
        let handoffCreated = false;

        try {
          const handoffResponse = await fetch("/api/auth/welcome-handoff", {
            method: "POST",
          });
          handoffCreated = handoffResponse.ok;
        } catch {
          // A handoff failure must not turn a successful login into an error.
        }

        router.replace(
          handoffCreated
            ? `/welcome?next=${encodeURIComponent(destination)}`
            : destination,
        );
        return;
      }

      router.replace(currentUser.statusRoute || "/account-disabled");
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to sign in"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthFrame eyebrow="Secure sign in" title="Falcon Hub" description="One place to run Falcon.">
        <form onSubmit={handleSubmit} className="space-y-5">
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
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={inputClass}
              placeholder="Password"
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
            {isSubmitting ? "Signing in..." : "Sign In"}
          </button>

          <p className="border-t border-[var(--falcon-soft-border)] pt-5 text-center text-sm text-zinc-500">
            Have a Falcon invitation?{" "}
            <Link href="/register" className="font-semibold text-[var(--falcon-gold-dark)] underline-offset-4 hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--falcon-gold)]/40">
              Register
            </Link>
          </p>
        </form>
    </AuthFrame>
  );
}
