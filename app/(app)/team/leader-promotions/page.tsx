"use client";

import { useCallback, useEffect, useState } from "react";
import { formatMemberCode } from "@/lib/member-display";

type PromotionRequest = {
  id: string;
  agentName: string;
  memberCode: number | null;
  currentRole: string | null;
  status: "pending" | "approved" | "rejected";
  direct_downline_count: number;
  total_downline_count: number;
  created_at: string;
  decided_at: string | null;
  decision_note: string | null;
};

type PromotionResponse = {
  pendingCount: number;
  requests: PromotionRequest[];
  backfillPreview: Array<{ memberId: string; agentName: string; memberCode: number | null; directDownlineCount: number; totalDownlineCount: number }>;
};

export default function LeaderPromotionsPage() {
  const [data, setData] = useState<PromotionResponse | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/leader-promotions", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Unable to load requests");
    setData(payload);
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/leader-promotions", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Unable to load requests");
        return payload as PromotionResponse;
      })
      .then((payload) => { if (active) setData(payload); })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Unable to load requests"); });
    return () => { active = false; };
  }, []);

  async function decide(item: PromotionRequest, decision: "approved" | "rejected") {
    if (!window.confirm(`${decision === "approved" ? "Approve" : "Reject"} ${item.agentName}'s Leader promotion?`)) return;
    const note = decision === "rejected" ? window.prompt("Optional rejection note", "") : null;
    setBusyId(item.id);
    setError("");
    try {
      const response = await fetch(`/api/admin/leader-promotions/${item.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, note }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to update request");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to update request");
    } finally {
      setBusyId(null);
    }
  }

  const pending = data?.requests.filter((item) => item.status === "pending") ?? [];
  const history = data?.requests.filter((item) => item.status !== "pending") ?? [];

  return (
    <main className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-5">
        <header className="rounded-[28px] border border-[var(--falcon-soft-border)] bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--falcon-gold-dark)]">Team Management</p>
          <div className="mt-2 flex flex-wrap items-center gap-3"><h1 className="text-3xl font-semibold text-zinc-950">Leader Promotions</h1><span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-900">{data?.pendingCount ?? 0} pending</span></div>
          <p className="mt-2 text-sm text-zinc-600">Review Agents who have gained direct downline members. Promotion never happens automatically.</p>
        </header>

        {error ? <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p> : null}

        <section className="rounded-[24px] border border-[var(--falcon-soft-border)] bg-white p-5">
          <h2 className="text-lg font-semibold text-zinc-950">Pending requests</h2>
          <div className="mt-4 divide-y divide-zinc-100 rounded-2xl border border-zinc-200">
            {!pending.length ? <p className="p-4 text-sm text-zinc-500">No pending Leader Promotion Requests.</p> : pending.map((item) => (
              <article key={item.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div><p className="font-semibold text-zinc-950">{item.agentName}{item.memberCode ? ` (${formatMemberCode(item.memberCode)})` : ""}</p><p className="mt-1 text-sm text-zinc-500">Current role: Agent · {item.direct_downline_count} direct · {item.total_downline_count} total downline · {new Date(item.created_at).toLocaleDateString("en-MY")}</p></div>
                <div className="flex gap-2"><button type="button" disabled={busyId === item.id} onClick={() => void decide(item, "rejected")} className="min-h-11 rounded-full border border-zinc-300 px-4 text-sm font-semibold disabled:opacity-50">Reject</button><button type="button" disabled={busyId === item.id} onClick={() => void decide(item, "approved")} className="min-h-11 rounded-full bg-zinc-950 px-5 text-sm font-semibold text-white disabled:opacity-50">Approve</button></div>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-[24px] border border-[var(--falcon-soft-border)] bg-white p-5">
          <h2 className="text-lg font-semibold text-zinc-950">Existing-agent backfill preview</h2>
          <p className="mt-1 text-sm text-zinc-500">Read-only. No requests or role changes are created from this page.</p>
          <p className="mt-3 text-sm font-medium text-zinc-800">{data?.backfillPreview.length ?? 0} eligible Agent(s) would receive one pending request.</p>
        </section>

        {history.length ? <section className="rounded-[24px] border border-[var(--falcon-soft-border)] bg-white p-5"><h2 className="text-lg font-semibold">Decision history</h2><div className="mt-3 divide-y divide-zinc-100">{history.map((item) => <div key={item.id} className="flex justify-between gap-4 py-3 text-sm"><span>{item.agentName}</span><span className="font-semibold capitalize">{item.status}</span></div>)}</div></section> : null}
      </div>
    </main>
  );
}
