"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Button, EmptyState, PageHeader, StatusBadge } from "../components/ui";
import { parseSalesPercentage, salesStatusLabels, type SalesCase, type SalesStatus } from "@/lib/sales";

type Period = "this_week" | "last_week" | "this_month" | "this_year" | "custom";
type Option = { id: string; project_name?: string; full_name?: string; display_name?: string | null; position?: string | null };
type ContributorForm = { memberId: string; portion: string };
type CaseForm = {
  projectId: string; unitNo: string; bookingDate: string; nettPrice: string; falconPortion: string;
  status: SalesStatus; spaSignedDate: string; cancelDate: string; remark: string; contributors: ContributorForm[];
};
type SalesResponse = {
  error?: string; canManage: boolean; range: { from: string; to: string }; records: SalesCase[];
  projects: Option[]; members: Option[];
  analytics: {
    closingFigure: number; creditedGdv: number; convertFigure: number; convertedCreditedGdv: number;
    conversionRate: number; cancelledCount: number; cancelledCreditedGdv: number;
    topClosers: Array<{ memberId: string; memberName: string; position: string | null; closingFigure: number; creditedGdv: number }>;
    projects: Array<{ projectId: string; projectName: string; closingFigure: number; creditedGdv: number; convertFigure: number }>;
  };
};

const periodOptions: Array<{ value: Period; label: string }> = [
  { value: "this_week", label: "This Week" }, { value: "last_week", label: "Last Week" },
  { value: "this_month", label: "This Month" }, { value: "this_year", label: "This Year" },
  { value: "custom", label: "Custom" },
];
const emptyForm: CaseForm = { projectId: "", unitNo: "", bookingDate: "", nettPrice: "", falconPortion: "100", status: "booking", spaSignedDate: "", cancelDate: "", remark: "", contributors: [{ memberId: "", portion: "100" }] };
const inputClass = "min-h-11 w-full rounded-2xl border border-[var(--falcon-soft-border)] bg-[#fafaf8] px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-[#b59a55] focus:bg-white";
const money = new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR", maximumFractionDigits: 0 });
const number = new Intl.NumberFormat("en-MY", { maximumFractionDigits: 2, minimumFractionDigits: 2 });

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-MY", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${value}T00:00:00Z`));
}
function statusVariant(status: SalesStatus): "neutral" | "warning" | "success" | "danger" | "accent" {
  if (status === "sign_spa") return "success"; if (status === "cancelled") return "danger";
  if (status === "loan_approved") return "accent"; if (status === "submitted") return "warning"; return "neutral";
}
function formFromCase(item: SalesCase): CaseForm {
  return { projectId: item.projectId, unitNo: item.unitNo, bookingDate: item.bookingDate, nettPrice: String(item.nettPrice), falconPortion: String(item.falconPortion), status: item.status, spaSignedDate: item.spaSignedDate ?? "", cancelDate: item.cancelDate ?? "", remark: item.remark ?? "", contributors: item.contributors.map((contributor) => ({ memberId: contributor.memberId, portion: String(contributor.portion) })) };
}

function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return <div className="rounded-[22px] border border-[var(--falcon-soft-border)] bg-white p-4 shadow-sm"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">{label}</p><p className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">{value}</p>{detail ? <p className="mt-1 text-xs text-zinc-500">{detail}</p> : null}</div>;
}

function SearchCombobox({ value, options, placeholder, emptyLabel, disabledIds, onChange }: { value: string; options: Array<{ id: string; label: string; searchText?: string }>; placeholder: string; emptyLabel: string; disabledIds?: Set<string>; onChange: (id: string) => void }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const selectedLabel = options.find((option) => option.id === value)?.label ?? "";
  const [query, setQuery] = useState(selectedLabel);
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredOptions = options.filter((option) => !disabledIds?.has(option.id) && (!normalizedQuery || `${option.label} ${option.searchText ?? ""}`.trim().toLowerCase().includes(normalizedQuery)));

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
      setQuery(selectedLabel);
    }
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [selectedLabel]);

  function selectOption(option: { id: string; label: string; searchText?: string }) {
    onChange(option.id);
    setQuery(option.label);
    setOpen(false);
    setHighlightedIndex(0);
  }

  return <div ref={rootRef} className="relative mt-1">
    <input
      role="combobox"
      aria-autocomplete="list"
      aria-expanded={open}
      aria-controls={listboxId}
      value={query}
      placeholder={placeholder}
      className={inputClass}
      onFocus={() => { setQuery(""); setOpen(true); setHighlightedIndex(0); }}
      onChange={(event) => { setQuery(event.target.value); onChange(""); setOpen(true); setHighlightedIndex(0); }}
      onKeyDown={(event) => {
        if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); setHighlightedIndex((index) => Math.min(index + 1, Math.max(filteredOptions.length - 1, 0))); }
        if (event.key === "ArrowUp") { event.preventDefault(); setHighlightedIndex((index) => Math.max(index - 1, 0)); }
        if (event.key === "Enter" && open && filteredOptions[highlightedIndex]) { event.preventDefault(); selectOption(filteredOptions[highlightedIndex]); }
        if (event.key === "Escape") { event.preventDefault(); setOpen(false); setQuery(selectedLabel); }
      }}
    />
    {open ? <div id={listboxId} role="listbox" className="absolute z-40 mt-1 max-h-52 w-full overflow-y-auto rounded-2xl border border-[var(--falcon-soft-border)] bg-white p-1 shadow-lg">
      {filteredOptions.length ? filteredOptions.map((option, index) => <button key={option.id} type="button" role="option" aria-selected={option.id === value} onMouseEnter={() => setHighlightedIndex(index)} onClick={() => selectOption(option)} className={`block w-full rounded-xl px-3 py-2 text-left text-sm ${index === highlightedIndex ? "bg-[#f4eddb] text-zinc-950" : "text-zinc-700 hover:bg-zinc-50"}`}>{option.label}</button>) : <p className="px-3 py-4 text-center text-sm text-zinc-500">{emptyLabel}</p>}
    </div> : null}
  </div>;
}

function CaseModal({ form, setForm, members, projects, editingCase, saving, error, onClose, onSave, onCorrectSpa }: { form: CaseForm; setForm: (form: CaseForm) => void; members: Option[]; projects: Option[]; editingCase: SalesCase | null; saving: boolean; error: string; onClose: () => void; onSave: () => void; onCorrectSpa: (status: SalesStatus, note: string) => void }) {
  const [correctionStatus, setCorrectionStatus] = useState<SalesStatus>("submitted");
  const [correctionNote, setCorrectionNote] = useState("");
  const contributorPercentages = form.contributors.map((item) => parseSalesPercentage(item.portion));
  const falconPercentage = parseSalesPercentage(form.falconPortion);
  const allocatedScaled = contributorPercentages.reduce((sum, item) => sum + (item?.scaled ?? 0), 0);
  const allocationMatches = Boolean(falconPercentage && contributorPercentages.every(Boolean) && allocatedScaled === falconPercentage.scaled);
  const duplicateMembers = new Set(form.contributors.filter((item) => item.memberId).map((item) => item.memberId)).size !== form.contributors.filter((item) => item.memberId).length;
  const chronologyError = form.spaSignedDate && form.bookingDate && form.spaSignedDate < form.bookingDate ? "SPA Signed Date cannot be before Booking Date." : form.cancelDate && form.bookingDate && form.cancelDate < form.bookingDate ? "Cancel Date cannot be before Booking Date." : form.spaSignedDate && form.cancelDate && form.cancelDate < form.spaSignedDate ? "Cancel Date cannot be before SPA Signed Date." : "";
  const valid = Boolean(form.projectId && form.unitNo.trim() && form.bookingDate && Number(form.nettPrice) > 0 && falconPercentage && allocationMatches && !duplicateMembers && form.contributors.every((item) => item.memberId) && (form.status !== "sign_spa" || form.spaSignedDate) && (form.status !== "cancelled" || form.cancelDate) && !chronologyError);
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/45 px-3 py-4 sm:items-center">
    <div className="flex max-h-[94dvh] w-full max-w-3xl flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl">
      <div className="flex items-start justify-between border-b border-zinc-100 px-5 py-4"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--falcon-gold-dark)]">Sales Records</p><h2 className="mt-1 text-xl font-semibold text-zinc-950">{editingCase ? "Edit Case" : "Add Case"}</h2></div><button onClick={onClose} disabled={saving} className="rounded-full border border-zinc-200 px-3 py-1.5 text-sm font-semibold">Close</button></div>
      <div className="space-y-6 overflow-y-auto px-5 py-5">
        <section><h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Case Details</h3><div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-sm font-medium text-zinc-800">Project *<SearchCombobox value={form.projectId} options={projects.flatMap((item) => item.project_name ? [{ id: item.id, label: item.project_name }] : [])} placeholder="Search project..." emptyLabel="No projects found" onChange={(projectId) => setForm({ ...form, projectId })} /></label>
          <label className="text-sm font-medium text-zinc-800">Unit No *<input value={form.unitNo} maxLength={80} onChange={(e) => setForm({ ...form, unitNo: e.target.value })} className={`${inputClass} mt-1`} /></label>
          <label className="text-sm font-medium text-zinc-800">Booking Date *<input type="date" value={form.bookingDate} onChange={(e) => setForm({ ...form, bookingDate: e.target.value })} className={`${inputClass} mt-1`} /></label>
          <label className="text-sm font-medium text-zinc-800">Nett Price (RM) *<input type="number" min="0.01" step="0.01" value={form.nettPrice} onChange={(e) => setForm({ ...form, nettPrice: e.target.value })} className={`${inputClass} mt-1`} /></label>
          <label className="text-sm font-medium text-zinc-800">Falcon Portion % *<input type="number" min="0.0001" max="100" step="0.0001" value={form.falconPortion} onChange={(e) => setForm({ ...form, falconPortion: e.target.value })} className={`${inputClass} mt-1`} /></label>
          <label className="text-sm font-medium text-zinc-800">Status *<select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as SalesStatus })} className={`${inputClass} mt-1`}>{Object.entries(salesStatusLabels).map(([value, label]) => <option key={value} value={value} disabled={editingCase?.status === "cancelled" ? value !== "cancelled" : editingCase?.status === "sign_spa" ? !["sign_spa", "cancelled"].includes(value) : false}>{label}</option>)}</select>{editingCase?.status === "cancelled" ? <span className="mt-1 block text-xs font-normal text-zinc-500">Cancelled is terminal. Create a new case for a rebooking.</span> : null}</label>
          {form.status === "sign_spa" ? <label className="text-sm font-medium text-zinc-800">SPA Signed Date *<input type="date" value={form.spaSignedDate} onChange={(e) => setForm({ ...form, spaSignedDate: e.target.value })} className={`${inputClass} mt-1`} /></label> : null}
          {form.status === "cancelled" ? <label className="text-sm font-medium text-zinc-800">Cancel Date *<input type="date" value={form.cancelDate} onChange={(e) => setForm({ ...form, cancelDate: e.target.value })} className={`${inputClass} mt-1`} /></label> : null}
        </div></section>
        <section><div className="flex items-center justify-between gap-3"><h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Contribution</h3><button type="button" onClick={() => setForm({ ...form, contributors: [...form.contributors, { memberId: "", portion: "" }] })} className="text-sm font-semibold text-[var(--falcon-gold-dark)]">+ Add Agent</button></div>
          <div className="mt-3 space-y-3">{form.contributors.map((contributor, index) => <div key={index} className="grid grid-cols-[minmax(0,1fr)_110px_auto] gap-2"><SearchCombobox value={contributor.memberId} options={members.flatMap((item) => item.full_name ? [{ id: item.id, label: item.display_name?.trim() || item.full_name, searchText: item.full_name }] : [])} placeholder="Search member..." emptyLabel="No members found" disabledIds={new Set(form.contributors.filter((_, selectedIndex) => selectedIndex !== index).map((selected) => selected.memberId).filter(Boolean))} onChange={(memberId) => setForm({ ...form, contributors: form.contributors.map((item, itemIndex) => itemIndex === index ? { ...item, memberId } : item) })} /><input aria-label="Contributor portion" type="number" min="0.0001" max="100" step="0.0001" value={contributor.portion} onChange={(e) => setForm({ ...form, contributors: form.contributors.map((item, itemIndex) => itemIndex === index ? { ...item, portion: e.target.value } : item) })} className={inputClass} placeholder="%" /><button type="button" aria-label="Remove contributor" disabled={form.contributors.length === 1} onClick={() => setForm({ ...form, contributors: form.contributors.filter((_, itemIndex) => itemIndex !== index) })} className="px-2 text-lg text-zinc-400 disabled:opacity-30">×</button></div>)}</div>
          <div className={`mt-3 rounded-2xl border px-4 py-3 text-sm font-semibold ${allocationMatches && !duplicateMembers ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>Allocated {number.format(allocatedScaled / 10_000)}% / Falcon Portion {falconPercentage ? number.format(falconPercentage.scaled / 10_000) : "—"}% {allocationMatches && !duplicateMembers ? "✓" : ""}{duplicateMembers ? <span className="mt-1 block font-normal">A contributor can only be selected once.</span> : !allocationMatches ? <span className="mt-1 block font-normal">Use no more than four decimal places. Allocations must exactly equal the Falcon Portion.</span> : null}</div>
        </section>
        <label className="block text-sm font-medium text-zinc-800">Remark / Issue<textarea rows={3} maxLength={2000} value={form.remark} onChange={(e) => setForm({ ...form, remark: e.target.value })} className={`${inputClass} mt-1 resize-none`} /></label>
        {chronologyError ? <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{chronologyError}</p> : null}
        {editingCase?.spaSignedDate ? <section className="rounded-2xl border border-red-200 bg-red-50 p-4"><h3 className="text-sm font-semibold text-red-900">Correct an incorrect SPA record</h3><p className="mt-1 text-xs leading-5 text-red-700">Use only when SPA was entered by mistake. Genuine post-SPA cancellation history must remain.</p><div className="mt-3 grid gap-3 sm:grid-cols-2"><select value={correctionStatus} onChange={(e) => setCorrectionStatus(e.target.value as SalesStatus)} disabled={editingCase.status === "cancelled"} className={inputClass}><option value="booking">Booking</option><option value="submitted">Submitted</option><option value="loan_approved">Loan Approved</option></select><input value={correctionNote} onChange={(e) => setCorrectionNote(e.target.value)} maxLength={1000} placeholder="Required correction note" className={inputClass} /></div><button type="button" disabled={saving || !correctionNote.trim()} onClick={() => { if (window.confirm("Remove this SPA Signed Date as a data-entry correction? This action is recorded in history.")) onCorrectSpa(correctionStatus, correctionNote.trim()); }} className="mt-3 text-sm font-semibold text-red-800 disabled:opacity-50">Remove Incorrect SPA Record</button></section> : null}
        {error ? <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
      </div>
      <div className="flex justify-end gap-3 border-t border-zinc-100 px-5 py-4"><Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button><Button onClick={onSave} disabled={!valid || saving}>{saving ? "Saving…" : editingCase ? "Save Changes" : "Submit Case"}</Button></div>
    </div>
  </div>;
}

export default function SalesPage() {
  const [tab, setTab] = useState<"overview" | "records">("overview");
  const [period, setPeriod] = useState<Period>("this_month");
  const [customFrom, setCustomFrom] = useState(""); const [customTo, setCustomTo] = useState("");
  const [projectId, setProjectId] = useState(""); const [status, setStatus] = useState("");
  const [memberId, setMemberId] = useState(""); const [search, setSearch] = useState("");
  const [data, setData] = useState<SalesResponse | null>(null); const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true); const [modalOpen, setModalOpen] = useState(false);
  const [editingCase, setEditingCase] = useState<SalesCase | null>(null); const [form, setForm] = useState<CaseForm>(emptyForm);
  const [saving, setSaving] = useState(false); const [saveError, setSaveError] = useState("");

  const query = useMemo(() => { const params = new URLSearchParams({ period }); if (period === "custom") { params.set("from", customFrom); params.set("to", customTo); } if (projectId) params.set("projectId", projectId); if (status) params.set("status", status); if (memberId) params.set("memberId", memberId); if (search) params.set("search", search); return params.toString(); }, [period, customFrom, customTo, projectId, status, memberId, search]);
  const load = useCallback(async () => { if (period === "custom" && (!customFrom || !customTo)) return; setLoading(true); setLoadError(""); try { const response = await fetch(`/api/sales?${query}`, { cache: "no-store" }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "Unable to load Sales"); setData(payload); } catch (error) { setLoadError(error instanceof Error ? error.message : "Unable to load Sales"); } finally { setLoading(false); } }, [query, period, customFrom, customTo]);
  useEffect(() => {
    // Loading is the external synchronization performed by this effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  function openCreate() { setEditingCase(null); setForm({ ...emptyForm, contributors: [{ memberId: "", portion: "100" }] }); setSaveError(""); setModalOpen(true); }
  function openEdit(item: SalesCase) { setEditingCase(item); setForm(formFromCase(item)); setSaveError(""); setModalOpen(true); }
  async function save() { setSaving(true); setSaveError(""); try { const response = await fetch(editingCase ? `/api/sales/${editingCase.id}` : "/api/sales", { method: editingCase ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, nettPrice: Number(form.nettPrice), contributors: form.contributors.map((item) => ({ memberId: item.memberId, portion: item.portion })) }) }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "Unable to save case"); setModalOpen(false); await load(); } catch (error) { setSaveError(error instanceof Error ? error.message : "Unable to save case"); } finally { setSaving(false); } }
  async function correctSpa(restoredStatus: SalesStatus, note: string) { if (!editingCase) return; setSaving(true); setSaveError(""); try { const response = await fetch(`/api/sales/${editingCase.id}/correct-spa`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ restoredStatus, note, confirm: true }) }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "Unable to correct SPA record"); setModalOpen(false); await load(); } catch (error) { setSaveError(error instanceof Error ? error.message : "Unable to correct SPA record"); } finally { setSaving(false); } }
  const analytics = data?.analytics;

  return <main className="space-y-5 px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
    <PageHeader eyebrow="Falcon Hub Sales" title="Sales" description="Internal closing intelligence, conversion tracking and credited GDV performance." actions={data?.canManage ? <Button onClick={openCreate}>+ Add Case</Button> : null} />
    <div className="flex gap-1 rounded-full border border-[var(--falcon-soft-border)] bg-white p-1 shadow-sm sm:w-fit">{([['overview','Overview'],['records','Sales Records']] as const).map(([value,label]) => <button key={value} onClick={() => setTab(value)} className={`min-h-10 flex-1 rounded-full px-5 text-sm font-semibold transition ${tab === value ? "bg-zinc-950 text-white" : "text-zinc-600 hover:bg-zinc-50"}`}>{label}</button>)}</div>
    <section className="rounded-[24px] border border-[var(--falcon-soft-border)] bg-white p-4 shadow-sm"><div className="flex flex-wrap gap-2">{periodOptions.map((item) => <button key={item.value} onClick={() => setPeriod(item.value)} className={`rounded-full px-3 py-2 text-xs font-semibold ${period === item.value ? "bg-[#efe6ce] text-[#6f571d]" : "bg-zinc-100 text-zinc-600"}`}>{item.label}</button>)}</div>{period === "custom" ? <div className="mt-3 grid gap-3 sm:max-w-md sm:grid-cols-2"><input aria-label="From date" type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className={inputClass} /><input aria-label="To date" type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className={inputClass} /></div> : null}{data?.range ? <p className="mt-3 text-xs text-zinc-500">{formatDate(data.range.from)} – {formatDate(data.range.to)}</p> : null}</section>
    {loadError ? <p className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{loadError}</p> : null}
    {loading && !data ? <p className="py-12 text-center text-sm text-zinc-500">Loading Sales…</p> : null}
    {tab === "overview" && analytics ? <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"><Metric label="Closing Figure" value={number.format(analytics.closingFigure)} detail="Attributed by booking date" /><Metric label="Falcon Credited GDV" value={money.format(analytics.creditedGdv)} detail="Nett price × Falcon Portion" /><Metric label="Convert Figure" value={number.format(analytics.convertFigure)} detail="Attributed by SPA signed date" /><Metric label="Converted Credited GDV" value={money.format(analytics.convertedCreditedGdv)} /><Metric label="Conversion Rate" value={`${number.format(analytics.conversionRate)}%`} /><Metric label="Cancelled Cases" value={String(analytics.cancelledCount)} detail={`${money.format(analytics.cancelledCreditedGdv)} historical credited GDV`} /></section>
      <div className="grid gap-5 xl:grid-cols-2"><section className="rounded-[24px] border border-[var(--falcon-soft-border)] bg-white p-5 shadow-sm"><h2 className="text-lg font-semibold">Top Closers</h2><p className="mt-1 text-sm text-zinc-500">Project Managers and Managing Partners are excluded from ranking only.</p><div className="mt-4 divide-y divide-zinc-100">{analytics.topClosers.length ? analytics.topClosers.map((item,index) => <div key={item.memberId} className="flex items-center gap-3 py-3"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f4eddb] text-sm font-bold text-[#806521]">{index+1}</span><div className="min-w-0 flex-1"><p className="truncate font-semibold">{item.memberName}</p><p className="text-xs text-zinc-500">{item.position || "Falcon member"}</p></div><div className="text-right"><p className="font-semibold">{number.format(item.closingFigure)}</p><p className="text-xs text-zinc-500">{money.format(item.creditedGdv)}</p></div></div>) : <p className="py-8 text-center text-sm text-zinc-500">No closings in this period.</p>}</div></section>
      <section className="rounded-[24px] border border-[var(--falcon-soft-border)] bg-white p-5 shadow-sm"><h2 className="text-lg font-semibold">Project Performance</h2><div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs uppercase tracking-wide text-zinc-500"><tr><th className="pb-3">Project</th><th className="pb-3 text-right">Closing</th><th className="pb-3 text-right">Convert</th><th className="pb-3 text-right">GDV</th></tr></thead><tbody className="divide-y divide-zinc-100">{analytics.projects.map((item) => <tr key={item.projectId}><td className="py-3 font-medium">{item.projectName}</td><td className="py-3 text-right">{number.format(item.closingFigure)}</td><td className="py-3 text-right">{number.format(item.convertFigure)}</td><td className="py-3 text-right">{money.format(item.creditedGdv)}</td></tr>)}</tbody></table>{!analytics.projects.length ? <p className="py-8 text-center text-sm text-zinc-500">No project performance yet.</p> : null}</div></section></div>
    </div> : null}
    {tab === "records" && data ? <div className="space-y-4"><section className="grid gap-3 rounded-[24px] border border-[var(--falcon-soft-border)] bg-white p-4 shadow-sm sm:grid-cols-2 xl:grid-cols-4"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search project or unit" className={inputClass} /><select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={inputClass}><option value="">All projects</option>{data.projects.map((item) => <option key={item.id} value={item.id}>{item.project_name}</option>)}</select><select value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}><option value="">All statuses</option>{Object.entries(salesStatusLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select>{data.canManage ? <select value={memberId} onChange={(e) => setMemberId(e.target.value)} className={inputClass}><option value="">All contributors</option>{data.members.map((item) => <option key={item.id} value={item.id}>{item.display_name?.trim() || item.full_name}</option>)}</select> : <div className="flex items-center px-3 text-sm text-zinc-500">Showing cases you contributed to</div>}</section>
      {!data.records.length ? <EmptyState title="No sales records found" description="Try another period or filter." /> : <><div className="hidden overflow-x-auto rounded-[24px] border border-[var(--falcon-soft-border)] bg-white shadow-sm lg:block"><table className="w-full min-w-[1000px] text-left text-sm"><thead className="border-b border-zinc-100 bg-[#faf9f5] text-xs uppercase tracking-wide text-zinc-500"><tr>{["Booking Date","Project","Unit","Nett Price","Falcon Portion","Contributors","Status","Falcon Credited GDV",...(data.canManage ? ["Actions"] : [])].map((label) => <th key={label} className={`px-4 py-3 ${label === "Actions" ? "sticky right-0 z-20 bg-[#faf9f5] shadow-[-8px_0_12px_-12px_rgba(24,24,27,0.35)]" : ""}`}>{label}</th>)}</tr></thead><tbody className="divide-y divide-zinc-100">{data.records.map((item) => <tr key={item.id}><td className="px-4 py-4 whitespace-nowrap">{formatDate(item.bookingDate)}</td><td className="px-4 py-4 font-semibold">{item.projectName}</td><td className="px-4 py-4">{item.unitNo}</td><td className="px-4 py-4 whitespace-nowrap">{money.format(item.nettPrice)}</td><td className="px-4 py-4">{number.format(item.falconPortion)}%</td><td className="px-4 py-4"><div className="space-y-1">{item.contributors.map((contributor) => <p key={contributor.memberId} className="whitespace-nowrap">{contributor.memberName} · {number.format(contributor.portion)}%</p>)}</div></td><td className="px-4 py-4"><StatusBadge variant={statusVariant(item.status)}>{salesStatusLabels[item.status]}</StatusBadge></td><td className="px-4 py-4 whitespace-nowrap font-semibold">{money.format(item.nettPrice * item.falconPortion / 100)}</td>{data.canManage ? <td className="sticky right-0 z-10 bg-white px-4 py-4 shadow-[-8px_0_12px_-12px_rgba(24,24,27,0.35)]"><button type="button" aria-label={`Edit ${item.projectName}, unit ${item.unitNo}`} onClick={() => openEdit(item)} className="rounded-full border border-[#d8c48e] bg-[#fbf8ef] px-3 py-1.5 text-xs font-semibold text-[var(--falcon-gold-dark)] transition hover:bg-[#f4eddb]">Edit</button></td> : null}</tr>)}</tbody></table></div>
      <div className="space-y-3 lg:hidden">{data.records.map((item) => <article key={item.id} className="rounded-[22px] border border-[var(--falcon-soft-border)] bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-zinc-950">{item.projectName}</p><p className="mt-1 text-sm text-zinc-500">Unit {item.unitNo} · {formatDate(item.bookingDate)}</p></div><StatusBadge variant={statusVariant(item.status)}>{salesStatusLabels[item.status]}</StatusBadge></div><div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><p className="text-xs text-zinc-500">Nett Price</p><p className="mt-1 font-semibold">{money.format(item.nettPrice)}</p></div><div><p className="text-xs text-zinc-500">Falcon Credited GDV</p><p className="mt-1 font-semibold">{money.format(item.nettPrice * item.falconPortion / 100)}</p></div></div><div className="mt-4 border-t border-zinc-100 pt-3 text-sm">{item.contributors.map((contributor) => <p key={contributor.memberId}>{contributor.memberName} · {number.format(contributor.portion)}%</p>)}</div>{data.canManage ? <button type="button" aria-label={`Edit ${item.projectName}, unit ${item.unitNo}`} onClick={() => openEdit(item)} className="mt-4 rounded-full border border-[#d8c48e] bg-[#fbf8ef] px-3 py-1.5 text-sm font-semibold text-[var(--falcon-gold-dark)] transition hover:bg-[#f4eddb]">Edit Case</button> : null}</article>)}</div></>}</div> : null}
    {modalOpen && data ? <CaseModal form={form} setForm={setForm} members={data.members} projects={data.projects} editingCase={editingCase} saving={saving} error={saveError} onClose={() => setModalOpen(false)} onSave={() => void save()} onCorrectSpa={(restoredStatus, note) => void correctSpa(restoredStatus, note)} /> : null}
  </main>;
}
