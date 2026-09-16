"use client";

import { useEffect, useMemo, useState } from "react";

import { SearchCombobox } from "../../components/SearchCombobox";
import { Button, PageHeader, StatusBadge } from "../../components/ui";
import {
  calculateInvestmentSimulation,
  investmentScenarioAssumptions,
  type InvestmentScenario,
  type InvestmentSimulatorInput,
  type InvestmentYearResult,
} from "@/lib/investment-simulator";

type ScenarioSelection = InvestmentScenario | "custom";

type SimulatorForm = {
  purchasePrice: string;
  initialCashRequired: string;
  loanMarginPercent: string;
  annualInterestRatePercent: string;
  loanTenureYears: string;
  startingMonthlyRental: string;
  rentalAppreciationPercent: string;
  monthlyMaintenance: string;
  otherMonthlyExpenses: string;
  capitalAppreciationPercent: string;
  estimatedSellingCostPercent: string;
  holdingPeriodYears: string;
};

type ProjectOption = {
  id: string;
  project_name: string;
  developer: string | null;
  location: string | null;
  maintenance_fee_per_sqft: number | null;
};

type UnitTypeOption = {
  id: string;
  type_code: string;
  type_name: string | null;
  display_configuration: string | null;
  size_sqft: number | null;
  spa_price_from: number | null;
  price_from: number | null;
  estimated_rental_from: number | null;
};

const defaultForm: SimulatorForm = {
  purchasePrice: "",
  initialCashRequired: "",
  loanMarginPercent: "90",
  annualInterestRatePercent: "3.70",
  loanTenureYears: "35",
  startingMonthlyRental: "",
  rentalAppreciationPercent: "2",
  monthlyMaintenance: "0",
  otherMonthlyExpenses: "0",
  capitalAppreciationPercent: "3",
  estimatedSellingCostPercent: "3",
  holdingPeriodYears: "10",
};

const quickHoldingPeriods = [5, 10, 15, 20];
const exitYears = [5, 10, 15, 20];
const moneyFormatter = new Intl.NumberFormat("en-MY", {
  style: "currency",
  currency: "MYR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const percentFormatter = new Intl.NumberFormat("en-MY", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function parseInput(value: string) {
  const normalized = value.replace(/,/g, "").trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatMoney(value: number) {
  return moneyFormatter.format(Number.isFinite(value) ? value : 0);
}

function formatSignedMoney(value: number) {
  if (!Number.isFinite(value) || value === 0) return formatMoney(0);
  return `${value > 0 ? "+" : "−"} ${formatMoney(Math.abs(value))}`;
}

function formatPercent(value: number | null) {
  return value === null || !Number.isFinite(value)
    ? "Not available"
    : `${percentFormatter.format(value)}%`;
}

function InputField({
  label,
  value,
  onChange,
  prefix,
  suffix,
  helper,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  prefix?: string;
  suffix?: string;
  helper?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="font-semibold text-zinc-700">{label}</span>
      <div className="mt-2 flex overflow-hidden rounded-2xl border border-[var(--falcon-soft-border)] bg-white transition focus-within:border-[var(--falcon-gold-dark)] focus-within:ring-2 focus-within:ring-[#b8924a]/15">
        {prefix ? <span className="flex min-w-14 items-center justify-center border-r border-[var(--falcon-soft-border)] bg-[var(--falcon-warm-background)] px-3 text-xs font-semibold text-zinc-500">{prefix}</span> : null}
        <input inputMode="decimal" value={value} onChange={(event) => onChange(event.target.value)} className="min-h-12 min-w-0 flex-1 px-4 py-3 font-medium text-zinc-950 outline-none" />
        {suffix ? <span className="flex items-center border-l border-[var(--falcon-soft-border)] bg-[var(--falcon-warm-background)] px-3 text-xs font-semibold text-zinc-500">{suffix}</span> : null}
      </div>
      {helper ? <span className="mt-1 block text-xs leading-5 text-zinc-500">{helper}</span> : null}
    </label>
  );
}

function Metric({
  label,
  value,
  featured = false,
  tone = "neutral",
}: {
  label: string;
  value: string;
  featured?: boolean;
  tone?: "neutral" | "positive" | "negative";
}) {
  const toneClass = tone === "positive" ? "text-emerald-800" : tone === "negative" ? "text-red-700" : "text-[var(--falcon-charcoal)]";
  return (
    <div className={`rounded-2xl border p-4 ${featured ? "border-[#d8c48e] bg-[#fbf8ef]" : "border-[var(--falcon-soft-border)] bg-white"}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">{label}</p>
      <p className={`mt-1 font-semibold ${featured ? "text-3xl" : "text-xl"} ${toneClass}`}>{value}</p>
    </div>
  );
}

function EquityChart({ years }: { years: InvestmentYearResult[] }) {
  const width = 800;
  const height = 280;
  const left = 64;
  const right = 20;
  const top = 22;
  const bottom = 40;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const maxValue = Math.max(...years.map((year) => year.propertyValue), 1);
  const x = (index: number) => left + (years.length === 1 ? plotWidth / 2 : (index / (years.length - 1)) * plotWidth);
  const y = (value: number) => top + plotHeight * (1 - value / maxValue);
  const propertyPoints = years.map((year, index) => `${x(index)},${y(year.propertyValue)}`).join(" ");
  const loanPoints = years.map((year, index) => `${x(index)},${y(year.outstandingLoan)}`).join(" ");
  const labelInterval = years.length > 24 ? 5 : years.length > 12 ? 3 : 1;

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-5 text-xs font-medium text-zinc-600">
        <span className="inline-flex items-center gap-2"><span className="h-0.5 w-4 bg-[#b8924a]" />Projected Property Value</span>
        <span className="inline-flex items-center gap-2"><span className="h-0.5 w-4 bg-zinc-700" />Outstanding Loan</span>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-[var(--falcon-soft-border)] bg-[#fdfcf9] p-3">
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Projected property value and outstanding loan by year" className="h-auto w-full min-w-[600px]">
          {[0, 0.5, 1].map((ratio) => {
            const lineY = top + plotHeight * ratio;
            return <g key={ratio}><line x1={left} x2={width - right} y1={lineY} y2={lineY} stroke="#e7e5e4" /><text x={left - 8} y={lineY + 4} textAnchor="end" fontSize="10" fill="#71717a">RM{Math.round(maxValue * (1 - ratio) / 1000)}k</text></g>;
          })}
          <polyline points={propertyPoints} fill="none" stroke="#b8924a" strokeWidth="3" strokeLinejoin="round" />
          <polyline points={loanPoints} fill="none" stroke="#3f3f46" strokeWidth="2.5" strokeLinejoin="round" />
          {years.map((year, index) => index === 0 || index === years.length - 1 || year.year % labelInterval === 0 ? <text key={year.year} x={x(index)} y={height - 12} textAnchor="middle" fontSize="10" fill="#71717a">Y{year.year}</text> : null)}
        </svg>
      </div>
    </div>
  );
}

export default function InvestmentSimulatorPage() {
  const [form, setForm] = useState<SimulatorForm>(defaultForm);
  const [scenario, setScenario] = useState<ScenarioSelection>("base");
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [unitTypes, setUnitTypes] = useState<UnitTypeOption[]>([]);
  const [selectedUnitTypeId, setSelectedUnitTypeId] = useState("");
  const [projectMessage, setProjectMessage] = useState("");
  const [loadingUnitTypes, setLoadingUnitTypes] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/projects", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Unable to load projects");
        return response.json() as Promise<ProjectOption[]>;
      })
      .then(setProjects)
      .catch((error) => {
        if (!controller.signal.aborted) setProjectMessage(error instanceof Error ? error.message : "Unable to load projects");
      });
    return () => controller.abort();
  }, []);

  const parsedInput = useMemo<InvestmentSimulatorInput | null>(() => {
    const values = {
      purchasePrice: parseInput(form.purchasePrice),
      initialCashRequired: parseInput(form.initialCashRequired),
      loanMarginPercent: parseInput(form.loanMarginPercent),
      annualInterestRatePercent: parseInput(form.annualInterestRatePercent),
      loanTenureYears: parseInput(form.loanTenureYears),
      startingMonthlyRental: parseInput(form.startingMonthlyRental),
      rentalAppreciationPercent: parseInput(form.rentalAppreciationPercent),
      monthlyMaintenance: parseInput(form.monthlyMaintenance),
      otherMonthlyExpenses: parseInput(form.otherMonthlyExpenses),
      capitalAppreciationPercent: parseInput(form.capitalAppreciationPercent),
      estimatedSellingCostPercent: parseInput(form.estimatedSellingCostPercent),
      holdingPeriodYears: parseInput(form.holdingPeriodYears),
    };
    if (Object.values(values).some((value) => value === null)) return null;
    return values as InvestmentSimulatorInput;
  }, [form]);
  const result = useMemo(() => parsedInput ? calculateInvestmentSimulation(parsedInput) : null, [parsedInput]);
  const selected = result?.selectedYear ?? null;
  const journey = result?.years.slice(0, parsedInput?.holdingPeriodYears ?? 0) ?? [];
  const exitScenarios = result?.years.filter((year) => exitYears.includes(year.year)) ?? [];

  function updateField(field: keyof SimulatorForm, value: string, growthField = false) {
    setForm((current) => ({ ...current, [field]: value }));
    if (growthField) setScenario("custom");
  }

  function applyScenario(nextScenario: InvestmentScenario) {
    const assumptions = investmentScenarioAssumptions[nextScenario];
    setScenario(nextScenario);
    setForm((current) => ({ ...current, capitalAppreciationPercent: String(assumptions.capitalAppreciationPercent), rentalAppreciationPercent: String(assumptions.rentalAppreciationPercent) }));
  }

  async function selectProject(projectId: string) {
    setSelectedProjectId(projectId);
    setSelectedUnitTypeId("");
    setUnitTypes([]);
    setProjectMessage("");
    if (!projectId) return;
    setLoadingUnitTypes(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/unit-types?audience=customer`);
      if (!response.ok) throw new Error("Unable to load Unit Types");
      setUnitTypes((await response.json()) as UnitTypeOption[]);
    } catch (error) {
      setProjectMessage(error instanceof Error ? error.message : "Unable to load Unit Types");
    } finally {
      setLoadingUnitTypes(false);
    }
  }

  function selectUnitType(unitTypeId: string) {
    setSelectedUnitTypeId(unitTypeId);
    const unitType = unitTypes.find((item) => item.id === unitTypeId);
    const project = projects.find((item) => item.id === selectedProjectId);
    if (!unitType) return;
    const purchasePrice = unitType.price_from ?? unitType.spa_price_from;
    const maintenance = unitType.size_sqft !== null && project?.maintenance_fee_per_sqft !== null && project?.maintenance_fee_per_sqft !== undefined ? unitType.size_sqft * project.maintenance_fee_per_sqft : null;
    setForm((current) => ({
      ...current,
      purchasePrice: purchasePrice === null ? current.purchasePrice : String(purchasePrice),
      startingMonthlyRental: unitType.estimated_rental_from === null ? current.startingMonthlyRental : String(unitType.estimated_rental_from),
      monthlyMaintenance: maintenance === null ? current.monthlyMaintenance : String(maintenance),
    }));
  }

  return (
    <main className="min-h-screen bg-[var(--falcon-warm-background)] px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <PageHeader eyebrow="Customer Tools" title="Investment Simulator" description="Explore projected value, rental, financing, cash flow and exit outcomes using transparent assumptions." actions={<Button type="button" variant="secondary" onClick={() => { setForm(defaultForm); setScenario("base"); setSelectedProjectId(""); setSelectedUnitTypeId(""); setUnitTypes([]); }}>Reset</Button>} meta={<StatusBadge variant="accent">Illustrative assumptions</StatusBadge>} />

        <section className="rounded-[28px] border border-[var(--falcon-soft-border)] bg-white p-5 shadow-sm sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--falcon-gold-dark)]">Project Reference</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div><label className="text-sm font-semibold text-zinc-700">Project <span className="font-normal text-zinc-400">(Optional)</span><SearchCombobox value={selectedProjectId} options={projects.map((project) => ({ id: project.id, label: project.project_name, description: [project.developer, project.location].filter(Boolean).join(" · "), searchText: [project.project_name, project.developer, project.location].filter(Boolean).join(" ") }))} placeholder="Search project..." emptyLabel="No projects found" onChange={(id) => void selectProject(id)} /></label>{selectedProjectId ? <button type="button" onClick={() => void selectProject("")} className="mt-2 text-xs font-semibold text-zinc-500 hover:text-zinc-900">Clear project selection</button> : null}</div>
            <label className="text-sm font-semibold text-zinc-700">Unit Type <span className="font-normal text-zinc-400">(Optional)</span><select value={selectedUnitTypeId} onChange={(event) => selectUnitType(event.target.value)} disabled={!selectedProjectId || loadingUnitTypes} className="mt-2 min-h-12 w-full rounded-2xl border border-[var(--falcon-soft-border)] bg-white px-4 text-sm outline-none disabled:bg-zinc-50 disabled:text-zinc-400"><option value="">{loadingUnitTypes ? "Loading Unit Types..." : "Select Unit Type"}</option>{unitTypes.map((unitType) => <option key={unitType.id} value={unitType.id}>{unitType.type_code}{unitType.type_name ? ` · ${unitType.type_name}` : ""}</option>)}</select></label>
          </div>
          <p className="mt-3 text-xs text-zinc-500">Project data can prefill available unit price, rental and maintenance assumptions. Every value remains editable.</p>
          {projectMessage ? <p className="mt-2 text-xs font-medium text-amber-700">{projectMessage}</p> : null}
        </section>

        <div className="grid gap-6 xl:grid-cols-2">
          <section className="rounded-[28px] border border-[var(--falcon-soft-border)] bg-white p-5 shadow-sm sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--falcon-gold-dark)]">Property / Purchase</p><h2 className="mt-1 text-lg font-semibold text-[var(--falcon-charcoal)]">Entry Capital</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2"><InputField label="Purchase Price / Final Nett Price" prefix="RM" value={form.purchasePrice} onChange={(value) => updateField("purchasePrice", value)} /><InputField label="Initial Cash Required" prefix="RM" value={form.initialCashRequired} onChange={(value) => updateField("initialCashRequired", value)} helper="Estimated initial capital entering the investment." /></div>
          </section>
          <section className="rounded-[28px] border border-[var(--falcon-soft-border)] bg-white p-5 shadow-sm sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--falcon-gold-dark)]">Financing</p><h2 className="mt-1 text-lg font-semibold text-[var(--falcon-charcoal)]">Housing Loan</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-3"><InputField label="Loan Margin" suffix="%" value={form.loanMarginPercent} onChange={(value) => updateField("loanMarginPercent", value)} /><InputField label="Interest Rate" suffix="% p.a." value={form.annualInterestRatePercent} onChange={(value) => updateField("annualInterestRatePercent", value)} /><InputField label="Loan Tenure" suffix="Years" value={form.loanTenureYears} onChange={(value) => updateField("loanTenureYears", value)} /></div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2"><Metric label="Derived Loan Amount" value={result ? formatMoney(result.loanAmount) : "—"} /><Metric label="Estimated Monthly Instalment" value={result ? formatMoney(result.monthlyInstalment) : "—"} /></div>
          </section>
          <section className="rounded-[28px] border border-[var(--falcon-soft-border)] bg-white p-5 shadow-sm sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--falcon-gold-dark)]">Rental</p><h2 className="mt-1 text-lg font-semibold text-[var(--falcon-charcoal)]">Operating Assumptions</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2"><InputField label="Starting Monthly Rental" prefix="RM" value={form.startingMonthlyRental} onChange={(value) => updateField("startingMonthlyRental", value)} helper="Starting rental applies throughout Year 1." /><InputField label="Rental Appreciation" suffix="% p.a." value={form.rentalAppreciationPercent} onChange={(value) => updateField("rentalAppreciationPercent", value, true)} /><InputField label="Monthly Maintenance" prefix="RM" value={form.monthlyMaintenance} onChange={(value) => updateField("monthlyMaintenance", value)} /><InputField label="Other Monthly Expenses" prefix="RM" value={form.otherMonthlyExpenses} onChange={(value) => updateField("otherMonthlyExpenses", value)} /></div>
          </section>
          <section className="rounded-[28px] border border-[var(--falcon-soft-border)] bg-white p-5 shadow-sm sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--falcon-gold-dark)]">Capital Growth / Exit</p><h2 className="mt-1 text-lg font-semibold text-[var(--falcon-charcoal)]">Holding Assumptions</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-3"><InputField label="Capital Appreciation" suffix="% p.a." value={form.capitalAppreciationPercent} onChange={(value) => updateField("capitalAppreciationPercent", value, true)} /><InputField label="Estimated Selling Cost" suffix="%" value={form.estimatedSellingCostPercent} onChange={(value) => updateField("estimatedSellingCostPercent", value)} helper="Illustrative disposal cost; not RPGT." /><InputField label="Holding Period" suffix="Years" value={form.holdingPeriodYears} onChange={(value) => updateField("holdingPeriodYears", value)} /></div>
            <div className="mt-4 flex flex-wrap gap-2">{quickHoldingPeriods.map((year) => <button key={year} type="button" onClick={() => updateField("holdingPeriodYears", String(year))} className={`min-h-9 rounded-full border px-3 text-xs font-semibold ${form.holdingPeriodYears === String(year) ? "border-[var(--falcon-charcoal)] bg-[var(--falcon-charcoal)] text-white" : "border-[var(--falcon-soft-border)] bg-white text-zinc-600"}`}>{year} Years</button>)}</div>
          </section>
        </div>

        <section className="rounded-[28px] border border-[var(--falcon-soft-border)] bg-white p-5 shadow-sm sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--falcon-gold-dark)]">Growth Scenario</p><h2 className="mt-1 text-lg font-semibold text-[var(--falcon-charcoal)]">Assumption Presets</h2>
          <div className="mt-4 flex flex-wrap gap-2">{(["conservative", "base", "optimistic"] as const).map((item) => { const assumptions = investmentScenarioAssumptions[item]; return <button key={item} type="button" onClick={() => applyScenario(item)} className={`rounded-2xl border px-4 py-3 text-left text-sm ${scenario === item ? "border-[var(--falcon-charcoal)] bg-[var(--falcon-charcoal)] text-white" : "border-[var(--falcon-soft-border)] bg-white text-zinc-700"}`}><span className="block font-semibold capitalize">{item}</span><span className={`mt-1 block text-xs ${scenario === item ? "text-zinc-300" : "text-zinc-500"}`}>{assumptions.capitalAppreciationPercent}% value · {assumptions.rentalAppreciationPercent}% rental</span></button>; })}<div className={`rounded-2xl border px-4 py-3 text-sm ${scenario === "custom" ? "border-[var(--falcon-charcoal)] bg-[var(--falcon-charcoal)] text-white" : "border-[var(--falcon-soft-border)] text-zinc-500"}`}><span className="block font-semibold">Custom</span><span className="mt-1 block text-xs">Manual growth assumptions</span></div></div>
          <p className="mt-3 text-xs text-zinc-500">Presets change only capital and rental appreciation assumptions. They are not market forecasts.</p>
        </section>

        {!selected ? <section className="rounded-[28px] border border-dashed border-[var(--falcon-soft-border)] bg-white px-5 py-12 text-center"><p className="font-semibold text-zinc-950">Enter valid purchase, cash and rental assumptions to run the simulation.</p><p className="mt-2 text-sm text-zinc-500">Purchase Price, Initial Cash Required and Starting Monthly Rental are not assumed automatically.</p></section> : <>
          <section className="rounded-[28px] border border-[var(--falcon-soft-border)] bg-white p-5 shadow-sm sm:p-6"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--falcon-gold-dark)]">Year {selected.year} Projection</p><h2 className="mt-1 text-lg font-semibold text-[var(--falcon-charcoal)]">Investment Snapshot</h2></div><StatusBadge variant="neutral">{scenario === "custom" ? "Custom assumptions" : `${scenario[0].toUpperCase()}${scenario.slice(1)} assumptions`}</StatusBadge></div><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3"><Metric label="Projected Property Value" value={formatMoney(selected.propertyValue)} featured /><Metric label="Estimated Equity" value={formatMoney(selected.equity)} featured /><Metric label="Estimated Investment Profit" value={formatSignedMoney(selected.estimatedInvestmentProfit)} featured tone={selected.estimatedInvestmentProfit >= 0 ? "positive" : "negative"} /><Metric label="Outstanding Loan" value={formatMoney(selected.outstandingLoan)} /><Metric label="Projected Monthly Rental" value={formatMoney(selected.monthlyRental)} /><Metric label="Average Monthly Cash Flow" value={formatSignedMoney(selected.averageMonthlyCashFlow)} tone={selected.averageMonthlyCashFlow >= 0 ? "positive" : "negative"} /><Metric label="Total Cash Invested" value={formatMoney(selected.totalCashInvested)} /><Metric label="Net Sale Proceeds Before Tax" value={formatMoney(selected.netSaleProceedsBeforeTax)} /><Metric label="Estimated ROI" value={formatPercent(selected.estimatedRoiPercent)} tone={(selected.estimatedRoiPercent ?? 0) >= 0 ? "positive" : "negative"} /></div></section>

          <section className="rounded-[28px] border border-[var(--falcon-soft-border)] bg-white p-5 shadow-sm sm:p-6"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--falcon-gold-dark)]">Equity Creation</p><h2 className="mt-1 text-lg font-semibold text-[var(--falcon-charcoal)]">Property Value vs Outstanding Loan</h2><p className="mt-2 text-sm text-zinc-500">Projected value is shown at each year end. The gap between the lines represents estimated equity, not profit.</p><div className="mt-5"><EquityChart years={journey} /></div></section>

          <section className="overflow-hidden rounded-[28px] border border-[var(--falcon-soft-border)] bg-white shadow-sm"><div className="p-5 sm:p-6"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--falcon-gold-dark)]">Exit Scenarios</p><h2 className="mt-1 text-lg font-semibold text-[var(--falcon-charcoal)]">Year 5 / 10 / 15 / 20 Comparison</h2></div><div className="overflow-x-auto border-t border-[var(--falcon-soft-border)]"><table className="w-full min-w-[1280px] text-sm"><thead className="bg-[var(--falcon-warm-background)] text-xs uppercase tracking-[0.08em] text-zinc-500"><tr><th className="px-4 py-3 text-left">Exit Year</th><th className="px-4 py-3 text-right">Property Value</th><th className="px-4 py-3 text-right">Outstanding Loan</th><th className="px-4 py-3 text-right">Equity</th><th className="px-4 py-3 text-right">Net Sale Proceeds</th><th className="px-4 py-3 text-right">Cash Invested</th><th className="px-4 py-3 text-right">Investment Profit</th><th className="px-4 py-3 text-right">Estimated ROI</th></tr></thead><tbody className="divide-y divide-[var(--falcon-soft-border)]">{exitScenarios.map((year) => <tr key={year.year} className={year.year === selected.year ? "bg-[#fbf8ef]" : ""}><td className="px-4 py-3 font-semibold text-zinc-950">Year {year.year}</td><td className="px-4 py-3 text-right tabular-nums">{formatMoney(year.propertyValue)}</td><td className="px-4 py-3 text-right tabular-nums">{formatMoney(year.outstandingLoan)}</td><td className="px-4 py-3 text-right tabular-nums">{formatMoney(year.equity)}</td><td className="px-4 py-3 text-right tabular-nums">{formatMoney(year.netSaleProceedsBeforeTax)}</td><td className="px-4 py-3 text-right tabular-nums">{formatMoney(year.totalCashInvested)}</td><td className={`px-4 py-3 text-right font-semibold tabular-nums ${year.estimatedInvestmentProfit >= 0 ? "text-emerald-700" : "text-red-700"}`}>{formatSignedMoney(year.estimatedInvestmentProfit)}</td><td className="px-4 py-3 text-right font-semibold tabular-nums">{formatPercent(year.estimatedRoiPercent)}</td></tr>)}</tbody></table></div></section>

          <section className="overflow-hidden rounded-[28px] border border-[var(--falcon-soft-border)] bg-white shadow-sm"><div className="p-5 sm:p-6"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--falcon-gold-dark)]">Investment Journey</p><h2 className="mt-1 text-lg font-semibold text-[var(--falcon-charcoal)]">Year-by-Year Through Year {selected.year}</h2></div><div className="overflow-x-auto border-t border-[var(--falcon-soft-border)]"><table className="w-full min-w-[1080px] text-sm"><thead className="bg-[var(--falcon-warm-background)] text-xs uppercase tracking-[0.08em] text-zinc-500"><tr><th className="px-4 py-3 text-left">Year</th><th className="px-4 py-3 text-right">Property Value</th><th className="px-4 py-3 text-right">Outstanding Loan</th><th className="px-4 py-3 text-right">Equity</th><th className="px-4 py-3 text-right">Monthly Rental</th><th className="px-4 py-3 text-right">Monthly Cash Flow</th><th className="px-4 py-3 text-right">Cumulative Cash Flow</th></tr></thead><tbody className="divide-y divide-[var(--falcon-soft-border)]">{journey.map((year) => <tr key={year.year}><td className="px-4 py-3 font-semibold text-zinc-950">Year {year.year}</td><td className="px-4 py-3 text-right tabular-nums">{formatMoney(year.propertyValue)}</td><td className="px-4 py-3 text-right tabular-nums">{formatMoney(year.outstandingLoan)}</td><td className="px-4 py-3 text-right tabular-nums">{formatMoney(year.equity)}</td><td className="px-4 py-3 text-right tabular-nums">{formatMoney(year.monthlyRental)}</td><td className={`px-4 py-3 text-right tabular-nums ${year.averageMonthlyCashFlow >= 0 ? "text-emerald-700" : "text-red-700"}`}>{formatSignedMoney(year.averageMonthlyCashFlow)}</td><td className={`px-4 py-3 text-right font-semibold tabular-nums ${year.cumulativeOperatingCashFlow >= 0 ? "text-emerald-700" : "text-red-700"}`}>{formatSignedMoney(year.cumulativeOperatingCashFlow)}</td></tr>)}</tbody></table></div></section>
        </>}

        <p className="rounded-2xl border border-[var(--falcon-soft-border)] bg-white px-5 py-4 text-xs leading-5 text-zinc-500">Figures are estimates for illustration purposes only and are based on the assumptions entered. Actual property value, rental, financing costs, expenses, selling costs, taxes and investment performance may differ.</p>
      </div>
    </main>
  );
}
