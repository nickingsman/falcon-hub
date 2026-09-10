"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { HistoricalPreview, HistoricalValidationState } from "@/lib/historical-sales-import";
import { salesStatusLabels } from "@/lib/sales";
import { Button, EmptyState, PageHeader, StatusBadge } from "../../components/ui";

const money = new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR", maximumFractionDigits: 2 });
const filters: Array<{ value: "all" | HistoricalValidationState; label: string }> = [
  { value: "all", label: "All" }, { value: "ready", label: "Ready" },
  { value: "needs_review", label: "Needs Review" }, { value: "blocked", label: "Blocked" },
  { value: "ignored", label: "Ignored" },
];
const validationLabels: Record<HistoricalValidationState, string> = { ready: "Ready", needs_review: "Needs Review", blocked: "Blocked", ignored: "Ignored" };

function validationVariant(state: HistoricalValidationState): "success" | "warning" | "danger" | "neutral" {
  if (state === "ready") return "success";
  if (state === "needs_review") return "warning";
  if (state === "blocked") return "danger";
  return "neutral";
}

export default function HistoricalSalesImportClient() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<HistoricalPreview | null>(null);
  const [filter, setFilter] = useState<"all" | HistoricalValidationState>("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const visibleRows = useMemo(() => preview?.rows.filter((row) => filter === "all" || row.validation === filter) ?? [], [preview, filter]);

  async function generatePreview() {
    if (!file) return;
    setLoading(true); setError(""); setPreview(null);
    try {
      const body = new FormData(); body.set("file", file);
      const response = await fetch("/api/sales/import/preview", { method: "POST", body });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to preview workbook");
      setPreview(result.preview); setFilter("all");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to preview workbook"); }
    finally { setLoading(false); }
  }

  return <main className="space-y-5 px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
    <PageHeader eyebrow="Falcon Hub Sales" title="Historical Import" description="Preview and validate the 2026 Falcon Group Case Report before any production write." actions={<Link href="/sales" className="inline-flex min-h-11 items-center rounded-full border border-[var(--falcon-soft-border)] bg-white px-5 text-sm font-semibold text-zinc-900">Back to Sales</Link>} />
    <section className="rounded-[24px] border border-[var(--falcon-soft-border)] bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end"><label className="min-w-0 flex-1 text-sm font-medium text-zinc-900">2026 Case Report (.xlsx or .csv)<input type="file" accept=".xlsx,.csv" onChange={(event) => { setFile(event.target.files?.[0] ?? null); setPreview(null); setError(""); }} className="mt-2 block w-full rounded-2xl border border-[var(--falcon-soft-border)] bg-[#fafaf8] px-3 py-2 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-[#f4eddb] file:px-3 file:py-2 file:font-semibold file:text-[#6f571d]" /></label><Button disabled={!file || loading} onClick={() => void generatePreview()}>{loading ? "Parsing…" : "Generate Preview"}</Button></div>
      <p className="mt-3 text-xs leading-5 text-zinc-500">Preview is read-only. No Sales cases, members, projects, or login accounts will be created.</p>
      {error ? <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
    </section>

    {preview ? <>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{[
        ["Total Parsed", preview.summary.total], ["Ready", preview.summary.ready], ["Needs Review", preview.summary.needs_review], ["Blocked", preview.summary.blocked], ["Ignored", preview.summary.ignored],
      ].map(([label, value]) => <div key={label} className="rounded-[20px] border border-[var(--falcon-soft-border)] bg-white p-4 shadow-sm"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">{label}</p><p className="mt-2 text-2xl font-semibold text-zinc-950">{value}</p></div>)}</section>
      <div className="grid gap-5 xl:grid-cols-2"><section className="rounded-[24px] border border-[var(--falcon-soft-border)] bg-white p-5 shadow-sm"><h2 className="font-semibold text-zinc-950">Status Distribution</h2><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5 xl:grid-cols-3">{Object.entries(preview.statusDistribution).map(([status, count]) => <div key={status}><p className="text-xs text-zinc-500">{salesStatusLabels[status as keyof typeof salesStatusLabels]}</p><p className="mt-1 text-lg font-semibold">{count}</p></div>)}</div></section><section className="rounded-[24px] border border-[var(--falcon-soft-border)] bg-white p-5 shadow-sm"><h2 className="font-semibold text-zinc-950">Financial Preview</h2><div className="mt-4 grid grid-cols-2 gap-4"><div><p className="text-xs text-zinc-500">Total Nett Price</p><p className="mt-1 text-xl font-semibold">{money.format(preview.financials.totalNettPrice)}</p></div><div><p className="text-xs text-zinc-500">Falcon Credited GDV</p><p className="mt-1 text-xl font-semibold">{money.format(preview.financials.totalFalconCreditedGdv)}</p></div></div></section></div>
      <section className="rounded-[24px] border border-[var(--falcon-soft-border)] bg-white p-4 shadow-sm"><div className="flex flex-wrap gap-2">{filters.map((item) => <button key={item.value} onClick={() => setFilter(item.value)} className={`rounded-full px-3 py-2 text-xs font-semibold ${filter === item.value ? "bg-zinc-950 text-white" : "bg-zinc-100 text-zinc-600"}`}>{item.label}</button>)}</div></section>
      {!visibleRows.length ? <EmptyState title="No rows in this view" /> : <section className="overflow-x-auto rounded-[24px] border border-[var(--falcon-soft-border)] bg-white shadow-sm"><table className="min-w-[1500px] w-full text-left text-xs"><thead className="border-b border-zinc-100 bg-[#faf9f5] uppercase tracking-wide text-zinc-500"><tr>{["Month","Project Match","Unit","Booking Date","Nett Price","Falcon Portion","Falcon GDV","Status","Contributors","Member Match","Validation","Issues"].map((label) => <th key={label} className="px-3 py-3">{label}</th>)}</tr></thead><tbody className="divide-y divide-zinc-100">{visibleRows.map((row) => <tr key={row.sourceRow} className="align-top"><td className="px-3 py-4">{row.month || "—"}</td><td className="px-3 py-4"><p className="font-semibold text-zinc-900">{row.sourceProject || "—"}</p><p className="mt-1 text-zinc-500">→ {row.projectName ?? "Unmatched"}</p></td><td className="px-3 py-4 font-medium">{row.unitNo || "—"}</td><td className="px-3 py-4 whitespace-nowrap">{row.bookingDate ?? "Invalid"}</td><td className="px-3 py-4 whitespace-nowrap">{row.nettPrice === null ? "Invalid" : money.format(row.nettPrice)}</td><td className="px-3 py-4">{row.falconPortion === null ? "Invalid" : `${row.falconPortion}%`}</td><td className="px-3 py-4 whitespace-nowrap">{row.calculatedFalconGdv === null ? "—" : money.format(row.calculatedFalconGdv)}</td><td className="px-3 py-4">{row.statusLabel}</td><td className="px-3 py-4">{row.contributors.map((item, index) => <p key={`${item.sourceName}-${index}`} className="mb-1 whitespace-nowrap">{item.sourceName} · {item.portion ?? "?"}%</p>)}</td><td className="px-3 py-4">{row.contributors.map((item, index) => <p key={`${item.sourceName}-${index}`} className={`mb-1 whitespace-nowrap ${item.matchState === "matched" ? "text-emerald-700" : "text-amber-700"}`}>{item.sourceName} → {item.memberName ?? (item.matchState === "ambiguous" ? "Multiple matches" : "No member")}</p>)}</td><td className="px-3 py-4"><StatusBadge variant={validationVariant(row.validation)}>{validationLabels[row.validation]}</StatusBadge></td><td className="max-w-xs px-3 py-4">{row.issues.length ? <ul className="space-y-1">{row.issues.map((issue) => <li key={issue}>• {issue}</li>)}</ul> : <span className="text-emerald-700">Ready for review</span>}</td></tr>)}</tbody></table></section>}
      <section className="rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900"><p className="font-semibold">Import remains disabled</p><p className="mt-1 leading-6">Review and resolve every Needs Review or Blocked row first. This preparation build cannot write historical records.</p></section>
    </> : null}
  </main>;
}
