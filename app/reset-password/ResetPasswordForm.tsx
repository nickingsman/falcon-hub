"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { minimumPasswordLength } from "@/lib/password-recovery";

const inputClass = "w-full rounded-2xl border border-[var(--falcon-soft-border)] bg-[#fbfaf7] px-4 py-3.5 text-[15px] text-zinc-950 outline-none transition placeholder:text-zinc-400 hover:border-zinc-300 focus:border-[var(--falcon-gold-dark)] focus:bg-white focus:ring-4 focus:ring-[#b8924a]/10";

export default function ResetPasswordForm({ recoveryValid }: { recoveryValid: boolean }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  if (!recoveryValid) {
    return (
      <div className="space-y-5">
        <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
          This password reset link is invalid or has expired.
        </div>
        <Link href="/forgot-password" className="flex min-h-12 w-full items-center justify-center rounded-full bg-zinc-950 px-5 py-3 text-sm font-semibold text-white shadow-[0_8px_22px_rgba(24,24,27,0.16)] transition hover:bg-zinc-800 focus:outline-none focus:ring-4 focus:ring-zinc-900/15">
          Request a New Reset Link
        </Link>
      </div>
    );
  }

  if (isComplete) {
    return (
      <div className="space-y-5">
        <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-800">
          Password updated successfully.
        </div>
        <Link href="/login" className="flex min-h-12 w-full items-center justify-center rounded-full bg-zinc-950 px-5 py-3 text-sm font-semibold text-white shadow-[0_8px_22px_rgba(24,24,27,0.16)] transition hover:bg-zinc-800 focus:outline-none focus:ring-4 focus:ring-zinc-900/15">
          Back to Login
        </Link>
      </div>
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    if (password.length < minimumPasswordLength) {
      setErrorMessage(`Password must be at least ${minimumPasswordLength} characters.`);
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, confirmPassword }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to update password");
      }

      setPassword("");
      setConfirmPassword("");
      setIsComplete(true);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update password");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <label className="block text-sm text-zinc-600">
        <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-zinc-700">New Password</span>
        <input
          type="password"
          required
          minLength={minimumPasswordLength}
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className={inputClass}
          placeholder={`At least ${minimumPasswordLength} characters`}
        />
      </label>

      <label className="block text-sm text-zinc-600">
        <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-zinc-700">Confirm New Password</span>
        <input
          type="password"
          required
          minLength={minimumPasswordLength}
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          className={inputClass}
          placeholder="Repeat your new password"
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
        {isSubmitting ? "Updating password..." : "Update Password"}
      </button>
    </form>
  );
}
