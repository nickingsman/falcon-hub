"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import AuthFrame from "@/app/components/AuthFrame";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

const inputClass = "w-full rounded-2xl border border-[var(--falcon-soft-border)] bg-[#fbfaf7] px-4 py-3.5 text-[15px] text-zinc-950 outline-none transition placeholder:text-zinc-400 hover:border-zinc-300 focus:border-[var(--falcon-gold-dark)] focus:bg-white focus:ring-4 focus:ring-[#b8924a]/10";
const confirmationMessage = "If an account exists for this email, we've sent a password reset link.";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setIsSubmitting(true);
      setMessage("");
      setErrorMessage("");

      const supabase = createSupabaseBrowserClient();
      await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/callback`,
      });

      setMessage(confirmationMessage);
    } catch {
      setErrorMessage("Unable to send a reset link right now. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthFrame
      eyebrow="Account recovery"
      title="Forgot Password"
      description="Enter your email and we'll send you a link to reset your password."
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <label className="block text-sm text-zinc-600">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-zinc-700">
            Email Address
          </span>
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

        {message ? (
          <div role="status" aria-live="polite" className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-800">
            {message}
          </div>
        ) : null}

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
          {isSubmitting ? "Sending reset link..." : "Send Reset Link"}
        </button>

        <p className="border-t border-[var(--falcon-soft-border)] pt-5 text-center text-sm text-zinc-500">
          <Link href="/login" className="font-semibold text-[var(--falcon-gold-dark)] underline-offset-4 hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--falcon-gold)]/40">
            Back to Login
          </Link>
        </p>
      </form>
    </AuthFrame>
  );
}
