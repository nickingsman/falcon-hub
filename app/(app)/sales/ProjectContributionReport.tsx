"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { SearchCombobox } from "../components/SearchCombobox";
import { salesStatusLabels, type SalesPeriod, type SalesStatus } from "@/lib/sales";
import { buildProjectContributionExportRows, type ProjectContributionReport as Report, type ProjectContributionStatusFilter } from "@/lib/sales-project-contribution";

type ProjectOption = { id: string; label: string; kind: "current" | "historical" };
type SortKey = "portion" | "cases" | "gdv";
type Props = { period: SalesPeriod; customFrom: string; customTo: string };

const inputClass = "min-h-11 w-full rounded-2xl border border-[var(--falcon-soft-border)] bg-[#fafaf8] px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-[#b59a55] focus:bg-white";
const money = new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const portion = new Intl.NumberFormat("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
const percentage = new Intl.NumberFormat("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 4 });

const statusOptions: Array<{ value: ProjectContributionStatusFilter; label: string }> = [
  { value: "all", label: "All Sales" },
  { value: "booking", label: "Booking" },
  { value: "submitted", label: "Submitted" },
  { value: "loan_approved", label: "Loan Approved" },
  { value: "converted", label: "Converted" },
  { value: "cancelled", label: "Cancelled" },
];

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-MY", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${value}T00:00:00Z`));
}

function statusLabel(status: SalesStatus) {
  return status === "sign_spa" ? "Converted" : salesStatusLabels[status];
}

function safeFilename(value: string) {
  return value.trim().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "project";
}

export function ProjectContributionReport({ period, customFrom, customTo }: Props) {
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [projectKey, setProjectKey] = useState("");
  const [status, setStatus] = useState<ProjectContributionStatusFilter>("all");
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedMember, setExpandedMember] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("portion");
  const [exporting, setExporting] = useState(false);

  const projectOptions = useMemo(() => [
    { id: "", label: "Select a project" },
    ...projects.map((project) => ({
      id: project.id,
      label: project.label,
      description: project.kind === "historical" ? "Historical Sales snapshot" : undefined,
      searchText: project.label,
    })),
  ], [projects]);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      if (period === "custom" && (!customFrom || !customTo)) {
        setLoading(false);
        setReport(null);
        return;
      }
      setLoading(true);
      setError("");
      const params = new URLSearchParams({ period, status });
      if (projectKey) params.set("projectKey", projectKey);
      if (period === "custom") {
        params.set("from", customFrom);
        params.set("to", customTo);
      }
      try {
        const response = await fetch(`/api/sales/project-contributions?${params}`, { cache: "no-store", signal: controller.signal });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Unable to load Project Contribution Report");
        setProjects(payload.projects ?? []);
        setReport(payload.report ?? null);
        setExpandedMember(null);
      } catch (loadError) {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : "Unable to load Project Contribution Report");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [projectKey, status, period, customFrom, customTo]);

  const sortedRows = useMemo(() => {
    if (!report) return [];
    return [...report.rows].sort((a, b) => {
      const primary = sortKey === "cases" ? b.salesCases - a.salesCases : sortKey === "gdv" ? b.creditedGdv - a.creditedGdv : b.totalPortion - a.totalPortion;
      return primary || b.totalPortion - a.totalPortion || b.creditedGdv - a.creditedGdv || b.salesCases - a.salesCases || a.memberName.localeCompare(b.memberName, "en-MY") || a.memberKey.localeCompare(b.memberKey);
    }).map((row, index) => ({ ...row, rank: index + 1 }));
  }, [report, sortKey]);

  async function exportExcel() {
    if (!report) return;
    setExporting(true);
    setError("");
    try {
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "Falcon Hub";
      const exportRows = buildProjectContributionExportRows({ ...report, rows: sortedRows });
      const summary = workbook.addWorksheet("Contribution Summary");
      summary.columns = [
        { header: "Project", key: "Project", width: 28 }, { header: "Date Range", key: "Date Range", width: 24 },
        { header: "Status Filter", key: "Status Filter", width: 18 }, { header: "Rank", key: "Rank", width: 9 },
        { header: "Member", key: "Member", width: 28 }, { header: "Sales Cases", key: "Sales Cases", width: 14 },
        { header: "Total Portion", key: "Total Portion", width: 16 }, { header: "Credited GDV", key: "Credited GDV", width: 18 },
      ];
      const selectedStatus = statusOptions.find((option) => option.value === report.statusFilter)?.label ?? report.statusFilter;
      exportRows.summary.forEach((row) => summary.addRow({ ...row, "Status Filter": selectedStatus }));
      const details = workbook.addWorksheet("Contribution Details");
      details.columns = [
        { header: "Booking Date", key: "Booking Date", width: 16 }, { header: "Project", key: "Project", width: 28 },
        { header: "Unit", key: "Unit", width: 16 }, { header: "Status", key: "Status", width: 18 },
        { header: "Member", key: "Member", width: 28 }, { header: "Contributor Percentage", key: "Contributor Percentage", width: 24 },
        { header: "Portion", key: "Portion", width: 14 }, { header: "Credited GDV", key: "Credited GDV", width: 18 },
      ];
      exportRows.details.forEach((row) => details.addRow({ ...row, Status: statusLabel(row.Status as SalesStatus) }));
      for (const sheet of [summary, details]) {
        sheet.views = [{ state: "frozen", ySplit: 1 }];
        sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
        sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF26231E" } };
        sheet.autoFilter = { from: "A1", to: `${String.fromCharCode(64 + sheet.columnCount)}1` };
      }
      summary.getColumn("Total Portion").numFmt = "0.0000";
      summary.getColumn("Credited GDV").numFmt = '"RM" #,##0.00';
      details.getColumn("Contributor Percentage").numFmt = "0.0000%";
      details.getColumn("Portion").numFmt = "0.0000";
      details.getColumn("Credited GDV").numFmt = '"RM" #,##0.00';
      details.eachRow((row, rowNumber) => {
        if (rowNumber > 1) row.getCell("Contributor Percentage").value = Number(row.getCell("Contributor Percentage").value) / 100;
      });
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `project-contribution-${safeFilename(report.projectName)}-${report.from}-to-${report.to}.xlsx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Unable to export Project Contribution Report");
    } finally {
      setExporting(false);
    }
  }

  return <section className="rounded-[24px] border border-[var(--falcon-soft-border)] bg-white p-5 shadow-sm">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--falcon-gold-dark)]">Project Performance</p><h2 className="mt-1 text-lg font-semibold text-zinc-950">Project Contribution Report</h2><p className="mt-1 text-sm text-zinc-500">Individual contribution based on actual Sales allocations and current status.</p></div>
      <button type="button" onClick={() => void exportExcel()} disabled={!report || exporting} className="min-h-10 rounded-full border border-[#d8c48e] bg-[#fbf8ef] px-4 text-sm font-semibold text-[var(--falcon-gold-dark)] disabled:cursor-not-allowed disabled:opacity-50">{exporting ? "Exporting…" : "Export Excel"}</button>
    </div>
    <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_220px_180px]">
      <label className="text-sm font-medium text-zinc-800">Project<SearchCombobox value={projectKey} options={projectOptions} placeholder="Search project..." emptyLabel="No matching projects." onChange={setProjectKey} /></label>
      <label className="text-sm font-medium text-zinc-800">Status<select value={status} onChange={(event) => setStatus(event.target.value as ProjectContributionStatusFilter)} className={`${inputClass} mt-2`}>{statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      <label className="text-sm font-medium text-zinc-800">Sort by<select value={sortKey} onChange={(event) => setSortKey(event.target.value as SortKey)} className={`${inputClass} mt-2`}><option value="portion">Total Portion</option><option value="cases">Sales Cases</option><option value="gdv">Credited GDV</option></select></label>
    </div>
    {error ? <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
    {!projectKey ? <p className="mt-6 rounded-2xl border border-dashed border-[var(--falcon-soft-border)] bg-[#faf9f5] px-4 py-8 text-center text-sm text-zinc-500">Select a Project to view its contribution report.</p> : loading ? <p className="py-10 text-center text-sm text-zinc-500">Loading contribution report…</p> : report ? <>
      <p className="mt-4 text-xs text-zinc-500">Booking Date: {formatDate(report.from)} – {formatDate(report.to)} · {statusOptions.find((option) => option.value === report.statusFilter)?.label}</p>
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[['Total Sales Cases', String(report.summary.totalSalesCases)], ['Total Contributors', String(report.summary.totalContributors)], ['Total Portion', portion.format(report.summary.totalPortion)], ['Total Credited GDV', money.format(report.summary.totalCreditedGdv)]].map(([label, value]) => <div key={label} className="rounded-2xl border border-[var(--falcon-soft-border)] bg-[#faf9f5] px-4 py-3"><p className="text-xs text-zinc-500">{label}</p><p className="mt-1 font-semibold text-zinc-950">{value}</p></div>)}
      </div>
      {!sortedRows.length ? <p className="mt-4 rounded-2xl border border-dashed border-[var(--falcon-soft-border)] px-4 py-8 text-center text-sm text-zinc-500">No matching Sales records for this Project and period.</p> : <div className="mt-4 overflow-x-auto rounded-2xl border border-[var(--falcon-soft-border)]">
        <table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-[#faf9f5] text-xs uppercase tracking-wide text-zinc-500"><tr><th className="px-4 py-3">Rank</th><th className="px-4 py-3">Member</th><th className="px-4 py-3 text-right">Sales Cases</th><th className="px-4 py-3 text-right">Total Portion</th><th className="px-4 py-3 text-right">Credited GDV</th></tr></thead><tbody className="divide-y divide-zinc-100">{sortedRows.map((row) => <Fragment key={row.memberKey}>
          <tr><td className="px-4 py-3 font-semibold text-[#806521]">{row.rank}</td><td className="px-4 py-3"><button type="button" onClick={() => setExpandedMember(expandedMember === row.memberKey ? null : row.memberKey)} className="font-semibold text-zinc-950 underline decoration-zinc-300 underline-offset-4">{row.memberName}</button></td><td className="px-4 py-3 text-right">{row.salesCases}</td><td className="px-4 py-3 text-right font-semibold">{portion.format(row.totalPortion)}</td><td className="px-4 py-3 text-right font-semibold">{money.format(row.creditedGdv)}</td></tr>
          {expandedMember === row.memberKey ? <tr><td colSpan={5} className="bg-[#fcfbf8] px-4 py-4"><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-xs"><thead className="text-left uppercase tracking-wide text-zinc-500"><tr><th className="pb-2">Booking Date</th><th className="pb-2">Project</th><th className="pb-2">Unit</th><th className="pb-2">Status</th><th className="pb-2">Member / Source Name</th><th className="pb-2 text-right">Contributor %</th><th className="pb-2 text-right">Portion</th><th className="pb-2 text-right">Credited GDV</th></tr></thead><tbody className="divide-y divide-zinc-200">{row.details.map((detail) => <tr key={`${detail.salesCaseId}:${detail.memberKey}`}><td className="py-2 whitespace-nowrap">{formatDate(detail.bookingDate)}</td><td className="py-2 font-medium">{detail.projectName}</td><td className="py-2 whitespace-nowrap">{detail.unitNo}</td><td className="py-2 whitespace-nowrap">{statusLabel(detail.status)}</td><td className="py-2">{detail.memberName}</td><td className="py-2 text-right">{percentage.format(detail.contributorPercentage)}%</td><td className="py-2 text-right">{portion.format(detail.portion)}</td><td className="py-2 text-right whitespace-nowrap">{money.format(detail.creditedGdv)}</td></tr>)}</tbody></table></div></td></tr> : null}
        </Fragment>)}</tbody></table>
      </div>}
    </> : null}
  </section>;
}
