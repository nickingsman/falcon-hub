"use client";

import { useMemo, useState } from "react";

import {
  generateAmortizationSchedule,
  getLoanSavings,
  summarizeAmortizationByYear,
  type LoanAmortizationResult,
  type YearlyAmortizationSummary,
} from "@/lib/loan-amortization";

import { Button, PageHeader, StatusBadge } from "../../components/ui";

type LoanForm = {
  loanAmount: string;
  annualInterestRatePercent: string;
  tenureYears: string;
  extraMonthlyPayment: string;
};

type ScheduleView = "yearly" | "monthly";

const defaultForm: LoanForm = {
  loanAmount: "",
  annualInterestRatePercent: "3.70",
  tenureYears: "35",
  extraMonthlyPayment: "0",
};

const quickExtras = [100, 300, 500, 1000];
const moneyFormatter = new Intl.NumberFormat("en-MY", {
  style: "currency",
  currency: "MYR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
function parseNumericInput(value: string) {
  const normalized = value.replace(/,/g, "").trim();
  if (!normalized) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatMoney(value: number) {
  return moneyFormatter.format(Number.isFinite(value) ? Math.max(0, value) : 0);
}

function formatDuration(totalMonths: number) {
  const safeMonths = Math.max(0, Math.round(totalMonths));
  const years = Math.floor(safeMonths / 12);
  const months = safeMonths % 12;
  const parts: string[] = [];

  if (years > 0) parts.push(`${years} ${years === 1 ? "Year" : "Years"}`);
  if (months > 0) parts.push(`${months} ${months === 1 ? "Month" : "Months"}`);

  return parts.join(" ") || "0 Months";
}

function Field({
  label,
  prefix,
  suffix,
  value,
  onChange,
  error,
}: {
  label: string;
  prefix?: string;
  suffix?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="font-semibold text-zinc-700">{label}</span>
      <div
        className={`mt-2 flex overflow-hidden rounded-2xl border bg-white transition focus-within:border-[var(--falcon-gold-dark)] focus-within:ring-2 focus-within:ring-[#b8924a]/15 ${
          error ? "border-amber-300" : "border-[var(--falcon-soft-border)]"
        }`}
      >
        {prefix ? (
          <span className="flex min-w-14 items-center justify-center border-r border-[var(--falcon-soft-border)] bg-[var(--falcon-warm-background)] px-3 text-xs font-semibold text-[var(--falcon-muted-text)]">
            {prefix}
          </span>
        ) : null}
        <input
          inputMode="decimal"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="min-h-12 min-w-0 flex-1 bg-white px-4 py-3 text-sm font-medium text-zinc-950 outline-none"
        />
        {suffix ? (
          <span className="flex items-center border-l border-[var(--falcon-soft-border)] bg-[var(--falcon-warm-background)] px-3 text-xs font-semibold text-[var(--falcon-muted-text)]">
            {suffix}
          </span>
        ) : null}
      </div>
      {error ? <span className="mt-1 block text-xs font-medium text-amber-700">{error}</span> : null}
    </label>
  );
}

function Metric({
  label,
  value,
  featured = false,
  positive = false,
}: {
  label: string;
  value: string;
  featured?: boolean;
  positive?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        positive
          ? "border-emerald-200 bg-emerald-50/70"
          : featured
            ? "border-[#d8c48e] bg-[#fbf8ef]"
            : "border-[var(--falcon-soft-border)] bg-white"
      }`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--falcon-muted-text)]">
        {label}
      </p>
      <p
        className={`mt-1 font-semibold ${featured ? "text-3xl" : "text-xl"} ${
          positive ? "text-emerald-800" : "text-[var(--falcon-charcoal)]"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function LoanChart({
  years,
  loanAmount,
}: {
  years: YearlyAmortizationSummary[];
  loanAmount: number;
}) {
  const width = 800;
  const height = 280;
  const plotLeft = 54;
  const plotRight = 20;
  const plotTop = 22;
  const plotBottom = 42;
  const plotWidth = width - plotLeft - plotRight;
  const plotHeight = height - plotTop - plotBottom;
  const slotWidth = plotWidth / Math.max(years.length, 1);
  const barWidth = Math.max(4, Math.min(16, slotWidth * 0.62));
  const balancePoints = years
    .map((year, index) => {
      const x = plotLeft + slotWidth * (index + 0.5);
      const y = plotTop + plotHeight * (1 - year.closingBalance / loanAmount);
      return `${x},${y}`;
    })
    .join(" ");
  const yearLabels = years.filter((_, index) => {
    const interval = years.length > 24 ? 5 : years.length > 12 ? 3 : 1;
    return index === 0 || index === years.length - 1 || (index + 1) % interval === 0;
  });

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-zinc-600">
        <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-[#b8924a]" />Principal</span>
        <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-zinc-300" />Interest</span>
        <span className="inline-flex items-center gap-2"><span className="h-0.5 w-4 bg-zinc-800" />Outstanding Balance</span>
      </div>
      <div className="overflow-hidden rounded-2xl border border-[var(--falcon-soft-border)] bg-[#fdfcf9] p-2 sm:p-4">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="Year-by-year principal, interest and outstanding loan balance"
          className="h-auto w-full min-w-[580px]"
        >
          {[0, 0.5, 1].map((ratio) => {
            const y = plotTop + plotHeight * ratio;
            return (
              <g key={ratio}>
                <line x1={plotLeft} x2={width - plotRight} y1={y} y2={y} stroke="#e7e5e4" />
                <text x={plotLeft - 8} y={y + 4} textAnchor="end" fontSize="10" fill="#71717a">
                  {Math.round((1 - ratio) * 100)}%
                </text>
              </g>
            );
          })}
          {years.map((year, index) => {
            const x = plotLeft + slotWidth * (index + 0.5) - barWidth / 2;
            const principalShare = year.totalPayment > 0 ? year.principalPaid / year.totalPayment : 0;
            const principalHeight = principalShare * plotHeight;
            const interestHeight = plotHeight - principalHeight;
            const baseY = plotTop + plotHeight;
            return (
              <g key={year.year}>
                <rect x={x} y={baseY - principalHeight} width={barWidth} height={principalHeight} fill="#b8924a" rx="1" />
                <rect x={x} y={baseY - principalHeight - interestHeight} width={barWidth} height={interestHeight} fill="#d4d4d8" rx="1" />
              </g>
            );
          })}
          <polyline points={`${plotLeft},${plotTop} ${balancePoints}`} fill="none" stroke="#27272a" strokeWidth="2.5" strokeLinejoin="round" />
          {yearLabels.map((year) => {
            const index = year.year - 1;
            const x = plotLeft + slotWidth * (index + 0.5);
            return <text key={year.year} x={x} y={height - 14} textAnchor="middle" fontSize="10" fill="#71717a">Y{year.year}</text>;
          })}
        </svg>
      </div>
    </div>
  );
}

function ComparisonColumn({
  title,
  result,
}: {
  title: string;
  result: LoanAmortizationResult;
}) {
  return (
    <div className="rounded-2xl border border-[var(--falcon-soft-border)] bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--falcon-gold-dark)]">{title}</p>
      <dl className="mt-3 space-y-2 text-sm">
        <div className="flex justify-between gap-4"><dt className="text-zinc-500">Monthly Payment</dt><dd className="font-semibold text-zinc-950">{formatMoney(result.actualMonthlyPayment)}</dd></div>
        <div className="flex justify-between gap-4"><dt className="text-zinc-500">Loan Duration</dt><dd className="text-right font-semibold text-zinc-950">{formatDuration(result.payoffMonth)}</dd></div>
        <div className="flex justify-between gap-4"><dt className="text-zinc-500">Total Interest</dt><dd className="font-semibold text-zinc-950">{formatMoney(result.totalInterest)}</dd></div>
      </dl>
    </div>
  );
}

export default function LoanAmortizationPage() {
  const [form, setForm] = useState<LoanForm>(defaultForm);
  const [scheduleView, setScheduleView] = useState<ScheduleView>("yearly");
  const [selectedYear, setSelectedYear] = useState(1);

  const calculation = useMemo(() => {
    const loanAmount = parseNumericInput(form.loanAmount);
    const annualInterestRatePercent = parseNumericInput(form.annualInterestRatePercent);
    const tenureYears = parseNumericInput(form.tenureYears);
    const extraMonthlyPayment = parseNumericInput(form.extraMonthlyPayment) ?? 0;
    const errors: Partial<Record<keyof LoanForm, string>> = {};

    if (loanAmount === null || loanAmount <= 0 || loanAmount > 100_000_000) errors.loanAmount = "Enter a loan amount between RM1 and RM100,000,000.";
    if (annualInterestRatePercent === null || annualInterestRatePercent < 0 || annualInterestRatePercent > 20) errors.annualInterestRatePercent = "Use an annual interest rate from 0% to 20%.";
    if (tenureYears === null || tenureYears <= 0 || tenureYears > 40 || !Number.isInteger(tenureYears * 12)) errors.tenureYears = "Use a tenure from 1 month to 40 years.";
    if (extraMonthlyPayment < 0 || extraMonthlyPayment > 10_000_000) errors.extraMonthlyPayment = "Use an extra payment from RM0 to RM10,000,000.";

    if (Object.keys(errors).length > 0 || loanAmount === null || annualInterestRatePercent === null || tenureYears === null) {
      return { errors, normal: null, selected: null, yearly: [], savings: null };
    }

    const normal = generateAmortizationSchedule({ loanAmount, annualInterestRatePercent, tenureYears });
    const selected = generateAmortizationSchedule({ loanAmount, annualInterestRatePercent, tenureYears, extraMonthlyPayment });

    if (!normal || !selected) return { errors, normal: null, selected: null, yearly: [], savings: null };

    return {
      errors,
      normal,
      selected,
      yearly: summarizeAmortizationByYear(selected.schedule),
      savings: extraMonthlyPayment > 0 ? getLoanSavings(normal, selected) : null,
    };
  }, [form]);

  function updateField(field: keyof LoanForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setSelectedYear(1);
  }

  const hasLoanAmount = form.loanAmount.trim().length > 0;
  const selectedYearSummary = calculation.yearly[selectedYear - 1] ?? calculation.yearly[0];
  const selectedMonthlyRows = calculation.selected?.schedule.slice(
    (selectedYear - 1) * 12,
    selectedYear * 12,
  ) ?? [];

  return (
    <main className="min-h-screen bg-[var(--falcon-warm-background)] px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <PageHeader
          eyebrow="Customer Tools"
          title="Loan Amortization"
          description="Explain how principal, interest and outstanding loan balance change over time—and how extra repayment can shorten the loan."
          actions={<Button type="button" variant="secondary" onClick={() => setForm(defaultForm)}>Reset</Button>}
          meta={<StatusBadge variant="accent">Estimate only</StatusBadge>}
        />

        <section className="rounded-[28px] border border-[var(--falcon-soft-border)] bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--falcon-gold-dark)]">Loan Details</p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--falcon-charcoal)]">Housing Loan Assumptions</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Loan Amount" prefix="RM" value={form.loanAmount} onChange={(value) => updateField("loanAmount", value)} error={hasLoanAmount ? calculation.errors.loanAmount : undefined} />
            <Field label="Interest Rate" suffix="% p.a." value={form.annualInterestRatePercent} onChange={(value) => updateField("annualInterestRatePercent", value)} error={calculation.errors.annualInterestRatePercent} />
            <Field label="Loan Tenure" suffix="Years" value={form.tenureYears} onChange={(value) => updateField("tenureYears", value)} error={calculation.errors.tenureYears} />
            <Field label="Extra Monthly Payment" prefix="RM" value={form.extraMonthlyPayment} onChange={(value) => updateField("extraMonthlyPayment", value)} error={calculation.errors.extraMonthlyPayment} />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="mr-1 text-xs font-medium text-zinc-500">Quick extra payment</span>
            {quickExtras.map((amount) => (
              <button key={amount} type="button" onClick={() => updateField("extraMonthlyPayment", String(amount))} className="min-h-9 rounded-full border border-[var(--falcon-soft-border)] bg-white px-3 text-xs font-semibold text-zinc-700 transition hover:border-[#d8c48e] hover:bg-[#fbf8ef]">
                + RM{amount.toLocaleString("en-MY")}
              </button>
            ))}
            <button type="button" onClick={() => updateField("extraMonthlyPayment", "0")} className="min-h-9 rounded-full px-3 text-xs font-semibold text-zinc-500 transition hover:bg-zinc-100">Reset to RM0</button>
          </div>
        </section>

        {!calculation.selected || !calculation.normal ? (
          <section className="rounded-[28px] border border-dashed border-[var(--falcon-soft-border)] bg-white px-5 py-12 text-center">
            <p className="text-base font-semibold text-zinc-950">Enter a valid loan amount to view the repayment estimate.</p>
            <p className="mt-2 text-sm text-zinc-500">Interest rate and tenure can be adjusted for the customer&apos;s scenario.</p>
          </section>
        ) : (
          <>
            <section className="rounded-[28px] border border-[var(--falcon-soft-border)] bg-white p-5 shadow-sm sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--falcon-gold-dark)]">Normal Loan Summary</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Metric label="Monthly Instalment" value={formatMoney(calculation.normal.monthlyInstalment)} featured />
                <Metric label="Total Interest" value={formatMoney(calculation.normal.totalInterest)} />
                <Metric label="Total Repayment" value={formatMoney(calculation.normal.totalRepayment)} />
                <Metric label="Loan Tenure" value={formatDuration(calculation.normal.contractualMonths)} />
              </div>
            </section>

            {calculation.savings ? (
              <section className="rounded-[28px] border border-[var(--falcon-soft-border)] bg-white p-5 shadow-sm sm:p-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--falcon-gold-dark)]">Extra Payment Impact</p>
                  <h2 className="mt-1 text-lg font-semibold text-[var(--falcon-charcoal)]">Normal Repayment vs Extra Payment</h2>
                </div>
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  <ComparisonColumn title="Normal Loan" result={calculation.normal} />
                  <ComparisonColumn title="With Extra Payment" result={calculation.selected} />
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Metric label="Time Saved" value={formatDuration(calculation.savings.monthsSaved)} positive />
                  <Metric label="Interest Saved" value={formatMoney(calculation.savings.interestSaved)} positive />
                </div>
              </section>
            ) : null}

            <section className="rounded-[28px] border border-[var(--falcon-soft-border)] bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--falcon-gold-dark)]">Repayment Over Time</p>
                <h2 className="mt-1 text-lg font-semibold text-[var(--falcon-charcoal)]">Principal, Interest & Outstanding Balance</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--falcon-muted-text)]">At the beginning of a housing loan, a larger portion of each instalment goes toward interest. As the outstanding balance reduces, more of each payment goes toward principal.</p>
              </div>
              <div className="overflow-x-auto pb-1"><LoanChart years={calculation.yearly} loanAmount={calculation.selected.loanAmount} /></div>
            </section>

            <section className="overflow-hidden rounded-[28px] border border-[var(--falcon-soft-border)] bg-white shadow-sm">
              <div className="p-5 sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--falcon-gold-dark)]">Amortization Schedule</p>
                    <h2 className="mt-1 text-lg font-semibold text-[var(--falcon-charcoal)]">{scheduleView === "yearly" ? "Year-by-Year Summary" : "Month-to-Month Detail"}</h2>
                    {calculation.savings ? <p className="mt-1 text-sm text-zinc-500">Reflects the selected extra monthly payment.</p> : null}
                  </div>
                  <div className="inline-flex w-fit rounded-full border border-[var(--falcon-soft-border)] bg-[var(--falcon-warm-background)] p-1" aria-label="Amortization schedule view">
                    {(["yearly", "monthly"] as const).map((view) => (
                      <button
                        key={view}
                        type="button"
                        onClick={() => setScheduleView(view)}
                        aria-pressed={scheduleView === view}
                        className={`min-h-9 rounded-full px-4 text-xs font-semibold transition ${scheduleView === view ? "bg-[var(--falcon-charcoal)] text-white shadow-sm" : "text-zinc-600 hover:bg-white"}`}
                      >
                        {view === "yearly" ? "Yearly" : "Monthly"}
                      </button>
                    ))}
                  </div>
                </div>

                {scheduleView === "monthly" && selectedYearSummary ? (
                  <div className="mt-5 space-y-4">
                    <label className="block w-full max-w-48 text-sm font-semibold text-zinc-700">
                      Year
                      <select
                        value={selectedYear}
                        onChange={(event) => setSelectedYear(Number(event.target.value))}
                        className="mt-2 min-h-11 w-full rounded-xl border border-[var(--falcon-soft-border)] bg-white px-3 text-sm font-medium text-zinc-950 outline-none focus:border-[var(--falcon-gold-dark)] focus:ring-2 focus:ring-[#b8924a]/15"
                      >
                        {calculation.yearly.map((year) => <option key={year.year} value={year.year}>Year {year.year}</option>)}
                      </select>
                    </label>
                    <div className="rounded-2xl border border-[var(--falcon-soft-border)] bg-[var(--falcon-warm-background)] p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--falcon-gold-dark)]">Year {selectedYearSummary.year}</p>
                      <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <div><dt className="text-xs text-zinc-500">Opening Balance</dt><dd className="mt-1 text-sm font-semibold tabular-nums text-zinc-950">{formatMoney(selectedYearSummary.openingBalance)}</dd></div>
                        <div><dt className="text-xs text-zinc-500">Principal Paid</dt><dd className="mt-1 text-sm font-semibold tabular-nums text-zinc-950">{formatMoney(selectedYearSummary.principalPaid)}</dd></div>
                        <div><dt className="text-xs text-zinc-500">Interest Paid</dt><dd className="mt-1 text-sm font-semibold tabular-nums text-zinc-950">{formatMoney(selectedYearSummary.interestPaid)}</dd></div>
                        <div><dt className="text-xs text-zinc-500">Closing Balance</dt><dd className="mt-1 text-sm font-semibold tabular-nums text-zinc-950">{formatMoney(selectedYearSummary.closingBalance)}</dd></div>
                      </dl>
                    </div>
                  </div>
                ) : null}
              </div>

              {scheduleView === "yearly" ? (
                <div className="overflow-x-auto border-t border-[var(--falcon-soft-border)]">
                  <table className="w-full min-w-[840px] text-left text-sm">
                    <thead className="bg-[var(--falcon-warm-background)] text-xs uppercase tracking-[0.1em] text-zinc-500">
                      <tr><th className="px-5 py-3">Year</th><th className="px-5 py-3 text-right">Opening Balance</th><th className="px-5 py-3 text-right">Principal Paid</th><th className="px-5 py-3 text-right">Interest Paid</th><th className="px-5 py-3 text-right">Total Payment</th><th className="px-5 py-3 text-right">Closing Balance</th></tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--falcon-soft-border)]">
                      {calculation.yearly.map((year) => (
                        <tr key={year.year} className="text-zinc-700">
                          <td className="px-5 py-3 font-semibold text-zinc-950">Year {year.year}</td><td className="px-5 py-3 text-right tabular-nums">{formatMoney(year.openingBalance)}</td><td className="px-5 py-3 text-right tabular-nums">{formatMoney(year.principalPaid)}</td><td className="px-5 py-3 text-right tabular-nums">{formatMoney(year.interestPaid)}</td><td className="px-5 py-3 text-right tabular-nums">{formatMoney(year.totalPayment)}</td><td className="px-5 py-3 text-right font-semibold tabular-nums text-zinc-950">{formatMoney(year.closingBalance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="overflow-x-auto border-t border-[var(--falcon-soft-border)]">
                  <table className="w-full min-w-[1080px] text-left text-sm">
                    <thead className="bg-[var(--falcon-warm-background)] text-xs uppercase tracking-[0.1em] text-zinc-500">
                      <tr><th className="sticky left-0 bg-[var(--falcon-warm-background)] px-5 py-3">Month</th><th className="px-5 py-3 text-right">Opening Balance</th><th className="px-5 py-3 text-right">Payment</th><th className="px-5 py-3 text-right">Principal</th><th className="px-5 py-3 text-right">Interest</th><th className="px-5 py-3 text-right">Extra Payment</th><th className="px-5 py-3 text-right">Closing Balance</th></tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--falcon-soft-border)]">
                      {selectedMonthlyRows.map((row) => (
                        <tr key={row.month} className="text-zinc-700">
                          <td className="sticky left-0 bg-white px-5 py-3 font-semibold text-zinc-950">Month {row.month}</td><td className="px-5 py-3 text-right tabular-nums">{formatMoney(row.openingBalance)}</td><td className="px-5 py-3 text-right font-semibold tabular-nums text-zinc-950">{formatMoney(row.payment)}</td><td className="px-5 py-3 text-right tabular-nums">{formatMoney(row.principal)}</td><td className="px-5 py-3 text-right tabular-nums">{formatMoney(row.interest)}</td><td className="px-5 py-3 text-right tabular-nums">{formatMoney(row.extraPayment)}</td><td className="px-5 py-3 text-right font-semibold tabular-nums text-zinc-950">{formatMoney(row.closingBalance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}

        <p className="rounded-2xl border border-[var(--falcon-soft-border)] bg-white px-5 py-4 text-xs leading-5 text-[var(--falcon-muted-text)]">Figures are estimates for illustration purposes only. Actual loan repayment may vary depending on bank calculation methods, interest-rate changes, payment dates, fees, and loan terms.</p>
      </div>
    </main>
  );
}
