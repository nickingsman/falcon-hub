"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type Invitation = {
  id: string;
  email: string;
  status: "active" | "used" | "revoked" | "expired";
  expires_at: string | null;
  used_at: string | null;
  created_at: string;
  revoked_at: string | null;
};

function formatDate(value: string | null) {
  if (!value) return "No expiry";
  return new Intl.DateTimeFormat("en-MY", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

const statusStyles: Record<Invitation["status"], string> = {
  active: "bg-emerald-50 text-emerald-700",
  used: "bg-blue-50 text-blue-700",
  revoked: "bg-zinc-100 text-zinc-600",
  expired: "bg-amber-50 text-amber-700",
};

export default function InvitationManagement() {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [email, setEmail] = useState("");
  const [expiresOn, setExpiresOn] = useState("");
  const [generatedCode, setGeneratedCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const loadInvitations = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/invitations", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to load invitations");
      setInvitations(result.invitations ?? []);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load invitations");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void loadInvitations(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadInvitations]);

  async function createInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setSaving(true);
      setErrorMessage("");
      setGeneratedCode("");
      const response = await fetch("/api/admin/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, expiresOn: expiresOn || null }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to create invitation");
      setGeneratedCode(result.code);
      setEmail("");
      setExpiresOn("");
      await loadInvitations();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to create invitation");
    } finally {
      setSaving(false);
    }
  }

  async function revokeInvitation(invitation: Invitation) {
    if (!window.confirm(`Revoke the invitation for ${invitation.email}?`)) return;
    try {
      setSaving(true);
      setErrorMessage("");
      const response = await fetch(`/api/admin/invitations/${invitation.id}/revoke`, { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to revoke invitation");
      await loadInvitations();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to revoke invitation");
    } finally {
      setSaving(false);
    }
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(generatedCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setErrorMessage("Copy failed. Select and copy the invitation code manually.");
    }
  }

  return (
    <section className="mt-8 rounded-[28px] border border-zinc-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-zinc-500">Controlled Onboarding</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">Invitations</h2>
          <p className="mt-2 text-sm text-zinc-600">Generate a one-time code for a specific email address.</p>
        </div>
      </div>

      <form onSubmit={createInvitation} className="mt-6 grid gap-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 md:grid-cols-[minmax(0,1fr)_180px_auto] md:items-end">
        <label className="text-sm text-zinc-600">
          <span className="mb-2 block font-medium text-zinc-900">Invited email</span>
          <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 outline-none focus:border-zinc-900" placeholder="name@company.com" />
        </label>
        <label className="text-sm text-zinc-600">
          <span className="mb-2 block font-medium text-zinc-900">Expires on (optional)</span>
          <input type="date" value={expiresOn} onChange={(event) => setExpiresOn(event.target.value)} className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 outline-none focus:border-zinc-900" />
        </label>
        <button type="submit" disabled={saving} className="rounded-xl bg-zinc-900 px-5 py-3 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50">{saving ? "Generating..." : "Generate Invite"}</button>
      </form>

      {generatedCode ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
          <p className="text-sm font-semibold">Copy this code now</p>
          <p className="mt-1 text-xs leading-5 text-amber-800">For security, it cannot be retrieved after this page is closed or refreshed.</p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
            <code className="overflow-x-auto rounded-xl border border-amber-200 bg-white px-4 py-3 text-sm font-semibold tracking-wide">{generatedCode}</code>
            <button type="button" onClick={copyCode} className="rounded-xl border border-amber-300 bg-white px-4 py-3 text-sm font-medium hover:bg-amber-100">{copied ? "Copied" : "Copy"}</button>
            <button type="button" onClick={() => setGeneratedCode("")} className="px-3 py-2 text-sm font-medium text-amber-800 hover:text-amber-950">Dismiss</button>
          </div>
        </div>
      ) : null}

      {errorMessage ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</div> : null}

      <div className="mt-6 overflow-x-auto">
        <table className="min-w-[760px] w-full divide-y divide-zinc-200 text-sm">
          <thead className="bg-zinc-50 text-left text-zinc-500"><tr><th className="px-4 py-3 font-medium">Email</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Created</th><th className="px-4 py-3 font-medium">Expiry</th><th className="px-4 py-3 font-medium">Used</th><th className="px-4 py-3 font-medium">Action</th></tr></thead>
          <tbody className="divide-y divide-zinc-200">
            {loading ? <tr><td colSpan={6} className="px-4 py-8 text-center text-zinc-500">Loading invitations...</td></tr> : invitations.length === 0 ? <tr><td colSpan={6} className="px-4 py-8 text-center text-zinc-500">No invitations yet.</td></tr> : invitations.map((invitation) => <tr key={invitation.id}><td className="px-4 py-4 font-medium text-zinc-900">{invitation.email}</td><td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusStyles[invitation.status]}`}>{invitation.status}</span></td><td className="px-4 py-4 text-zinc-600">{formatDate(invitation.created_at)}</td><td className="px-4 py-4 text-zinc-600">{formatDate(invitation.expires_at)}</td><td className="px-4 py-4 text-zinc-600">{invitation.used_at ? formatDate(invitation.used_at) : "-"}</td><td className="px-4 py-4">{invitation.status === "active" ? <button type="button" disabled={saving} onClick={() => revokeInvitation(invitation)} className="font-medium text-red-600 hover:text-red-800 disabled:opacity-50">Revoke</button> : <span className="text-zinc-400">-</span>}</td></tr>)}
          </tbody>
        </table>
      </div>
    </section>
  );
}
