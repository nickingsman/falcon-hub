"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { SearchCombobox } from "../../components/SearchCombobox";
import { Button, PageHeader, StatusBadge } from "../../components/ui";
import {
  calculateInvestmentEntryCapital,
  calculateInvestmentFinancing,
  calculateInvestmentPricePosition,
  calculateInvestmentSimulation,
  investmentScenarioAssumptions,
  type InvestmentScenario,
  type InvestmentSimulatorInput,
  type InvestmentYearResult,
} from "@/lib/investment-simulator";

type ScenarioSelection = InvestmentScenario | "custom";

type SimulatorForm = {
  spaPrice: string;
  nettPrice: string;
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

type EntryCapitalCost = {
  id: string;
  description: string;
  amount: string;
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
  spaPrice: "",
  nettPrice: "",
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

function parseEntryCapitalAmount(value: string) {
  return Math.max(0, parseInput(value) ?? 0);
}

function normalizeEntryCapitalInput(value: string) {
  const parsed = parseInput(value);
  return parsed !== null && parsed < 0 ? "0" : value;
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
  className = "",
  valueClassName,
}: {
  label: string;
  value: string;
  featured?: boolean;
  tone?: "neutral" | "positive" | "negative";
  className?: string;
  valueClassName?: string;
}) {
  const toneClass = tone === "positive" ? "text-emerald-800" : tone === "negative" ? "text-red-700" : "text-[var(--falcon-charcoal)]";
  return (
    <div className={`min-w-0 rounded-2xl border p-4 ${featured ? "border-[#d8c48e] bg-[#fbf8ef]" : "border-[var(--falcon-soft-border)] bg-white"} ${className}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">{label}</p>
      <p className={`mt-1 font-semibold ${valueClassName ?? (featured ? "text-3xl" : "text-xl")} ${toneClass}`}>{value}</p>
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
  const [customDownpayment, setCustomDownpayment] = useState("");
  const [downpaymentOverridden, setDownpaymentOverridden] = useState(false);
  const [renovation, setRenovation] = useState("0");
  const [otherEntryCosts, setOtherEntryCosts] = useState<EntryCapitalCost[]>([]);
  const nextEntryCostId = useRef(1);
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

  const nettPriceInput = parseInput(form.nettPrice);
  const financing = useMemo(() => {
    const spaPrice = parseInput(form.spaPrice);
    const loanMarginPercent = parseInput(form.loanMarginPercent);
    const annualInterestRatePercent = parseInput(form.annualInterestRatePercent);
    const loanTenureYears = parseInput(form.loanTenureYears);

    if (
      spaPrice === null ||
      loanMarginPercent === null ||
      annualInterestRatePercent === null ||
      loanTenureYears === null
    ) {
      return null;
    }

    return calculateInvestmentFinancing({
      spaPrice,
      loanMarginPercent,
      annualInterestRatePercent,
      loanTenureYears,
    });
  }, [
    form.annualInterestRatePercent,
    form.loanMarginPercent,
    form.loanTenureYears,
    form.spaPrice,
  ]);
  const pricePosition =
    nettPriceInput !== null && financing
      ? calculateInvestmentPricePosition(nettPriceInput, financing.loanAmount)
      : null;
  const calculatedDownpayment = pricePosition?.suggestedDownpayment ?? null;
  const cashback = pricePosition?.cashback ?? 0;
  const downpaymentInputValue = downpaymentOverridden
    ? customDownpayment
    : calculatedDownpayment === null
      ? ""
      : String(calculatedDownpayment);
  const otherEntryCostsTotal = otherEntryCosts.reduce(
    (sum, cost) => sum + parseEntryCapitalAmount(cost.amount),
    0,
  );
  const entryCapital = calculateInvestmentEntryCapital({
    downpayment: parseEntryCapitalAmount(downpaymentInputValue),
    renovation: parseEntryCapitalAmount(renovation),
    otherCosts: otherEntryCostsTotal,
    cashback,
  });
  const netInitialCapital = entryCapital.netInitialCapital;

  const parsedInput = useMemo<InvestmentSimulatorInput | null>(() => {
    const values = {
      spaPrice: parseInput(form.spaPrice),
      nettPrice: parseInput(form.nettPrice),
      initialCashRequired: netInitialCapital,
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
  }, [netInitialCapital, form]);
  const result = useMemo(() => parsedInput ? calculateInvestmentSimulation(parsedInput) : null, [parsedInput]);
  const selected = result?.selectedYear ?? null;
  const yearOne = result?.years[0] ?? null;
  const journey = result?.years.slice(0, parsedInput?.holdingPeriodYears ?? 0) ?? [];
  const exitScenarios = result?.years.filter((year) => exitYears.includes(year.year)) ?? [];
  const hasInitialCapitalForRoi = netInitialCapital > 0;
  const hasLowInitialCapital =
    nettPriceInput !== null &&
    nettPriceInput > 0 &&
    netInitialCapital < nettPriceInput * 0.01;
  const yearOneAverageLoanPayment = result?.loan
    ? result.loan.schedule
        .slice(0, 12)
        .reduce((sum, payment) => sum + payment.payment, 0) / 12
    : 0;

  function displayRoi(year: InvestmentYearResult) {
    return hasInitialCapitalForRoi ? formatPercent(year.estimatedRoiPercent) : "—";
  }

  function updateField(field: keyof SimulatorForm, value: string, growthField = false) {
    setForm((current) => ({ ...current, [field]: value }));
    if (growthField) setScenario("custom");
  }

  function addEntryCost() {
    const id = `entry-cost-${nextEntryCostId.current}`;
    nextEntryCostId.current += 1;
    setOtherEntryCosts((current) => [...current, { id, description: "", amount: "" }]);
  }

  function updateEntryCost(id: string, changes: Partial<Omit<EntryCapitalCost, "id">>) {
    setOtherEntryCosts((current) =>
      current.map((cost) => (cost.id === id ? { ...cost, ...changes } : cost)),
    );
  }

  function resetSimulator() {
    setForm(defaultForm);
    setCustomDownpayment("");
    setDownpaymentOverridden(false);
    setRenovation("0");
    setOtherEntryCosts([]);
    setScenario("base");
    setSelectedProjectId("");
    setSelectedUnitTypeId("");
    setUnitTypes([]);
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
    const spaPrice = unitType.spa_price_from ?? unitType.price_from;
    const nettPrice = unitType.price_from ?? spaPrice;
    const maintenance = unitType.size_sqft !== null && project?.maintenance_fee_per_sqft !== null && project?.maintenance_fee_per_sqft !== undefined ? unitType.size_sqft * project.maintenance_fee_per_sqft : null;
    setForm((current) => ({
      ...current,
      spaPrice: spaPrice === null ? current.spaPrice : String(spaPrice),
      nettPrice: nettPrice === null ? current.nettPrice : String(nettPrice),
      startingMonthlyRental: unitType.estimated_rental_from === null ? current.startingMonthlyRental : String(unitType.estimated_rental_from),
      monthlyMaintenance: maintenance === null ? current.monthlyMaintenance : String(maintenance),
    }));
  }

  return (
    <main className="min-h-screen bg-[var(--falcon-warm-background)] px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <PageHeader eyebrow="Customer Tools" title="Investment Simulator" description="Explore projected value, rental, financing, cash flow and exit outcomes using transparent assumptions." actions={<Button type="button" variant="secondary" onClick={resetSimulator}>Reset</Button>} meta={<StatusBadge variant="accent">Illustrative assumptions</StatusBadge>} />

        <div className="grid gap-6 xl:grid-cols-2">
          <section className="rounded-[28px] border border-[var(--falcon-soft-border)] bg-white p-5 shadow-sm sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--falcon-gold-dark)]">Property</p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--falcon-charcoal)]">Property & Entry Capital</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-semibold text-zinc-700">Project <span className="font-normal text-zinc-400">(Optional)</span><SearchCombobox value={selectedProjectId} options={projects.map((project) => ({ id: project.id, label: project.project_name, description: [project.developer, project.location].filter(Boolean).join(" · "), searchText: [project.project_name, project.developer, project.location].filter(Boolean).join(" ") }))} placeholder="Search project..." emptyLabel="No projects found" onChange={(id) => void selectProject(id)} /></label>
                {selectedProjectId ? <button type="button" onClick={() => void selectProject("")} className="mt-2 text-xs font-semibold text-zinc-500 hover:text-zinc-900">Clear project selection</button> : null}
              </div>
              <label className="text-sm font-semibold text-zinc-700">Unit Type <span className="font-normal text-zinc-400">(Optional)</span><select value={selectedUnitTypeId} onChange={(event) => selectUnitType(event.target.value)} disabled={!selectedProjectId || loadingUnitTypes} className="mt-2 min-h-12 w-full rounded-2xl border border-[var(--falcon-soft-border)] bg-white px-4 text-sm outline-none disabled:bg-zinc-50 disabled:text-zinc-400"><option value="">{loadingUnitTypes ? "Loading Unit Types..." : "Select Unit Type"}</option>{unitTypes.map((unitType) => <option key={unitType.id} value={unitType.id}>{unitType.type_code}{unitType.type_name ? ` · ${unitType.type_name}` : ""}</option>)}</select></label>
            </div>
            <p className="mt-3 text-xs text-zinc-500">Project data can prefill available unit price, rental and maintenance assumptions. Every value remains editable.</p>
            {projectMessage ? <p className="mt-2 text-xs font-medium text-amber-700">{projectMessage}</p> : null}
            <div className="mt-4 grid max-w-3xl gap-4 sm:grid-cols-2">
              <InputField label="SPA Price" prefix="RM" value={form.spaPrice} onChange={(value) => updateField("spaPrice", value)} helper="Contractual price used as the bank financing reference." />
              <InputField label="Nett Price" prefix="RM" value={form.nettPrice} onChange={(value) => updateField("nettPrice", value)} helper="Effective acquisition price after applicable discounts or rebates." />
            </div>

            <div className="mt-5 border-t border-[var(--falcon-soft-border)] pt-5">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Entry Capital Breakdown</p>
              <div className="mt-3 divide-y divide-[var(--falcon-soft-border)] rounded-2xl border border-[var(--falcon-soft-border)] px-4">
                <div className="grid gap-3 py-3 sm:grid-cols-[minmax(0,1fr)_200px] sm:items-center">
                  <div><p className="text-sm font-semibold text-zinc-800">Downpayment</p><p className="mt-1 text-xs text-zinc-500">Suggested from Nett Price less Loan Amount.</p>{downpaymentOverridden && calculatedDownpayment !== null ? <button type="button" onClick={() => { setDownpaymentOverridden(false); setCustomDownpayment(""); }} className="mt-1 text-xs font-semibold text-[var(--falcon-gold-dark)] hover:text-zinc-900">Use Calculated Downpayment ({formatMoney(calculatedDownpayment)})</button> : null}</div>
                  <div className="flex overflow-hidden rounded-xl border border-[var(--falcon-soft-border)] bg-white"><span className="flex items-center border-r border-[var(--falcon-soft-border)] bg-[var(--falcon-warm-background)] px-3 text-xs font-semibold text-zinc-500">RM</span><input aria-label="Downpayment" inputMode="decimal" value={downpaymentInputValue} onChange={(event) => { setCustomDownpayment(normalizeEntryCapitalInput(event.target.value)); setDownpaymentOverridden(true); }} className="min-h-11 min-w-0 flex-1 px-3 text-sm font-medium outline-none" /></div>
                </div>
                <div className="grid gap-3 py-3 sm:grid-cols-[minmax(0,1fr)_200px] sm:items-center">
                  <div><p className="text-sm font-semibold text-zinc-800">Renovation</p><p className="mt-1 text-xs text-zinc-500">Optional renovation budget.</p></div>
                  <div className="flex overflow-hidden rounded-xl border border-[var(--falcon-soft-border)] bg-white"><span className="flex items-center border-r border-[var(--falcon-soft-border)] bg-[var(--falcon-warm-background)] px-3 text-xs font-semibold text-zinc-500">RM</span><input aria-label="Renovation" inputMode="decimal" value={renovation} onChange={(event) => setRenovation(normalizeEntryCapitalInput(event.target.value))} className="min-h-11 min-w-0 flex-1 px-3 text-sm font-medium outline-none" /></div>
                </div>
                {otherEntryCosts.map((cost) => (
                  <div key={cost.id} className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_200px_auto] sm:items-center">
                    <input aria-label="Other cost description" value={cost.description} onChange={(event) => updateEntryCost(cost.id, { description: event.target.value })} placeholder="Other Cost description" className="min-h-11 rounded-xl border border-[var(--falcon-soft-border)] px-3 text-sm outline-none focus:border-[var(--falcon-gold-dark)]" />
                    <div className="flex overflow-hidden rounded-xl border border-[var(--falcon-soft-border)] bg-white"><span className="flex items-center border-r border-[var(--falcon-soft-border)] bg-[var(--falcon-warm-background)] px-3 text-xs font-semibold text-zinc-500">RM</span><input aria-label={cost.description.trim() || "Other Cost amount"} inputMode="decimal" value={cost.amount} onChange={(event) => updateEntryCost(cost.id, { amount: normalizeEntryCapitalInput(event.target.value) })} className="min-h-11 min-w-0 flex-1 px-3 text-sm font-medium outline-none" /></div>
                    <button type="button" aria-label={`Remove ${cost.description.trim() || "Other Cost"}`} onClick={() => setOtherEntryCosts((current) => current.filter((item) => item.id !== cost.id))} className="min-h-10 rounded-full px-3 text-xs font-semibold text-red-700 hover:bg-red-50">Remove</button>
                  </div>
                ))}
              </div>
              <button type="button" onClick={addEntryCost} className="mt-3 min-h-10 rounded-full border border-[var(--falcon-soft-border)] bg-white px-4 text-sm font-semibold text-zinc-700 hover:bg-zinc-50">+ Add Cost</button>
              <div className="mt-4 space-y-2 rounded-2xl border border-[var(--falcon-soft-border)] bg-white px-4 py-3 text-sm">
                <div className="flex items-center justify-between gap-4"><span className="text-zinc-600">Gross Entry Costs</span><strong className="tabular-nums text-zinc-950">{formatMoney(entryCapital.grossEntryCosts)}</strong></div>
                <div className="flex items-center justify-between gap-4 text-emerald-700"><span className="font-medium">Cashback</span><strong className="tabular-nums">− {formatMoney(cashback)}</strong></div>
              </div>
              <div className="mt-3 rounded-2xl border border-[#d8c48e] bg-[#fbf8ef] px-4 py-4"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--falcon-gold-dark)]">Net Initial Capital Required</p><p className="mt-1 text-2xl font-semibold text-[var(--falcon-charcoal)]">{formatMoney(netInitialCapital)}</p><p className="mt-1 text-xs text-zinc-500">Gross entry costs less derived cashback, floored at RM0.</p></div>
              {entryCapital.excessCashback > 0 ? <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">Excess Cashback</p><p className="mt-1 text-lg font-semibold text-emerald-800">{formatMoney(entryCapital.excessCashback)}</p></div> : null}
              {hasLowInitialCapital ? <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">Low net initial capital can produce a very high simple ROI. Check that all upfront costs and cashback assumptions are complete.</p> : null}
            </div>
          </section>
          <section className="rounded-[28px] border border-[var(--falcon-soft-border)] bg-white p-5 shadow-sm sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--falcon-gold-dark)]">Financing</p><h2 className="mt-1 text-lg font-semibold text-[var(--falcon-charcoal)]">Housing Loan</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-3"><InputField label="Loan Margin" suffix="%" value={form.loanMarginPercent} onChange={(value) => updateField("loanMarginPercent", value)} /><InputField label="Interest Rate" suffix="% p.a." value={form.annualInterestRatePercent} onChange={(value) => updateField("annualInterestRatePercent", value)} /><InputField label="Loan Tenure" suffix="Years" value={form.loanTenureYears} onChange={(value) => updateField("loanTenureYears", value)} /></div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2"><Metric label="Loan Amount" value={financing ? formatMoney(financing.loanAmount) : "—"} /><Metric label="Monthly Instalment" value={financing ? formatMoney(financing.monthlyInstalment) : "—"} /></div>
          </section>
          <section className="rounded-[28px] border border-[var(--falcon-soft-border)] bg-white p-5 shadow-sm sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--falcon-gold-dark)]">Rental</p><h2 className="mt-1 text-lg font-semibold text-[var(--falcon-charcoal)]">Operating Assumptions</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2"><InputField label="Starting Monthly Rental" prefix="RM" value={form.startingMonthlyRental} onChange={(value) => updateField("startingMonthlyRental", value)} helper="Starting rental applies throughout Year 1." /><InputField label="Rental Appreciation" suffix="% p.a." value={form.rentalAppreciationPercent} onChange={(value) => updateField("rentalAppreciationPercent", value, true)} /><InputField label="Monthly Maintenance" prefix="RM" value={form.monthlyMaintenance} onChange={(value) => updateField("monthlyMaintenance", value)} /><InputField label="Other Monthly Expenses" prefix="RM" value={form.otherMonthlyExpenses} onChange={(value) => updateField("otherMonthlyExpenses", value)} /></div>
          </section>
          <section className="rounded-[28px] border border-[var(--falcon-soft-border)] bg-white p-5 shadow-sm sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--falcon-gold-dark)]">Growth & Exit</p><h2 className="mt-1 text-lg font-semibold text-[var(--falcon-charcoal)]">Holding Assumptions</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-3"><InputField label="Capital Appreciation" suffix="% p.a." value={form.capitalAppreciationPercent} onChange={(value) => updateField("capitalAppreciationPercent", value, true)} /><InputField label="Estimated Selling Cost" suffix="%" value={form.estimatedSellingCostPercent} onChange={(value) => updateField("estimatedSellingCostPercent", value)} helper="Illustrative disposal cost; not RPGT." /><InputField label="Holding Period" suffix="Years" value={form.holdingPeriodYears} onChange={(value) => updateField("holdingPeriodYears", value)} /></div>
            <div className="mt-4 flex flex-wrap gap-2">{quickHoldingPeriods.map((year) => <button key={year} type="button" onClick={() => updateField("holdingPeriodYears", String(year))} className={`min-h-9 rounded-full border px-3 text-xs font-semibold ${form.holdingPeriodYears === String(year) ? "border-[var(--falcon-charcoal)] bg-[var(--falcon-charcoal)] text-white" : "border-[var(--falcon-soft-border)] bg-white text-zinc-600"}`}>{year} Years</button>)}</div>
            <div className="mt-5 border-t border-[var(--falcon-soft-border)] pt-4"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Scenario Assumptions</p><div className="mt-3 flex flex-wrap gap-2">{(["conservative", "base", "optimistic"] as const).map((item) => { const assumptions = investmentScenarioAssumptions[item]; return <button key={item} type="button" onClick={() => applyScenario(item)} className={`rounded-2xl border px-4 py-3 text-left text-sm ${scenario === item ? "border-[var(--falcon-charcoal)] bg-[var(--falcon-charcoal)] text-white" : "border-[var(--falcon-soft-border)] bg-white text-zinc-700"}`}><span className="block font-semibold capitalize">{item}</span><span className={`mt-1 block text-xs ${scenario === item ? "text-zinc-300" : "text-zinc-500"}`}>{assumptions.capitalAppreciationPercent}% Value · {assumptions.rentalAppreciationPercent}% Rental</span></button>; })}<div className={`rounded-2xl border px-4 py-3 text-sm ${scenario === "custom" ? "border-[var(--falcon-charcoal)] bg-[var(--falcon-charcoal)] text-white" : "border-[var(--falcon-soft-border)] text-zinc-500"}`}><span className="block font-semibold">Custom</span><span className="mt-1 block text-xs">Manual assumptions</span></div></div><p className="mt-3 text-xs text-zinc-500">Presets change only capital and rental appreciation assumptions. They are not market forecasts.</p></div>
          </section>
        </div>

        {!selected || !yearOne ? <section className="rounded-[28px] border border-dashed border-[var(--falcon-soft-border)] bg-white px-5 py-12 text-center"><p className="font-semibold text-zinc-950">Enter valid purchase, capital and rental assumptions to run the simulation.</p><p className="mt-2 text-sm text-zinc-500">SPA Price, Nett Price and Starting Monthly Rental are required. Net Initial Capital is derived from the entry-capital breakdown and cashback.</p></section> : <>
          <section className="rounded-[28px] border border-[var(--falcon-soft-border)] bg-white p-5 shadow-sm sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--falcon-gold-dark)]">Today</p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--falcon-charcoal)]">Your Investment Starting Point</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3"><Metric label="SPA Price" value={formatMoney(result?.input.spaPrice ?? 0)} featured /><Metric label="Nett Price" value={formatMoney(result?.input.nettPrice ?? 0)} featured /><Metric label="Loan Amount" value={formatMoney(result?.loanAmount ?? 0)} /><Metric label="Net Initial Capital" value={formatMoney(result?.input.initialCashRequired ?? 0)} /><Metric label="Monthly Instalment" value={formatMoney(result?.monthlyInstalment ?? 0)} />{cashback > 0 ? <Metric label="Cashback" value={formatMoney(cashback)} tone="positive" /> : null}</div>
          </section>

          <section className="rounded-[28px] border border-[var(--falcon-soft-border)] bg-white p-5 shadow-sm sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--falcon-gold-dark)]">Monthly</p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--falcon-charcoal)]">How the Property Supports Itself</h2>
            <div className="mt-4 max-w-2xl rounded-2xl border border-[var(--falcon-soft-border)] bg-[var(--falcon-warm-background)] px-4 sm:px-5">
              <div className="flex items-center justify-between gap-4 border-b border-[var(--falcon-soft-border)] py-3"><span className="text-sm text-zinc-600">Monthly Rental</span><strong className="tabular-nums text-zinc-950">{formatMoney(yearOne.monthlyRental)}</strong></div>
              <div className="flex items-center justify-between gap-4 border-b border-[var(--falcon-soft-border)] py-3"><span className="text-sm text-zinc-600">− Loan Instalment</span><strong className="tabular-nums text-zinc-950">{formatMoney(yearOneAverageLoanPayment)}</strong></div>
              <div className="flex items-center justify-between gap-4 border-b border-[var(--falcon-soft-border)] py-3"><span className="text-sm text-zinc-600">− Maintenance</span><strong className="tabular-nums text-zinc-950">{formatMoney(result?.input.monthlyMaintenance ?? 0)}</strong></div>
              <div className="flex items-center justify-between gap-4 border-b border-[var(--falcon-soft-border)] py-3"><span className="text-sm text-zinc-600">− Other Expenses</span><strong className="tabular-nums text-zinc-950">{formatMoney(result?.input.otherMonthlyExpenses ?? 0)}</strong></div>
              <div className="flex items-end justify-between gap-4 py-4"><span className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">Estimated Monthly Cash Flow</span><strong className={`text-xl tabular-nums ${yearOne.averageMonthlyCashFlow >= 0 ? "text-emerald-700" : "text-red-700"}`}>{formatSignedMoney(yearOne.averageMonthlyCashFlow)}</strong></div>
            </div>
            <p className="mt-3 text-xs text-zinc-500">Based on Year 1 rental and the assumptions entered.</p>
          </section>

          <section className="rounded-[28px] border border-[var(--falcon-soft-border)] bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--falcon-gold-dark)]">Future</p><h2 className="mt-1 text-lg font-semibold text-[var(--falcon-charcoal)]">After {selected.year} Years</h2></div><StatusBadge variant="neutral">{scenario === "custom" ? "Custom assumptions" : `${scenario[0].toUpperCase()}${scenario.slice(1)} assumptions`}</StatusBadge></div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3"><Metric label="Projected Property Value" value={formatMoney(selected.propertyValue)} featured /><Metric label="Outstanding Loan" value={formatMoney(selected.outstandingLoan)} /><Metric label="Estimated Equity" value={formatMoney(selected.equity)} featured /><Metric label="Projected Monthly Rental" value={formatMoney(selected.monthlyRental)} /><Metric label={`Year ${selected.year} Monthly Cash Flow`} value={formatSignedMoney(selected.averageMonthlyCashFlow)} tone={selected.averageMonthlyCashFlow >= 0 ? "positive" : "negative"} /></div>
            <div className="mt-4 rounded-2xl border border-[var(--falcon-soft-border)] bg-[var(--falcon-warm-background)] px-4 py-3 text-sm leading-6 text-zinc-600"><p>Estimated Equity = Projected Property Value − Outstanding Loan</p><p className="font-medium text-zinc-800">Equity is not the same as investment profit.</p></div>
          </section>

          <section className="rounded-[28px] border border-[var(--falcon-soft-border)] bg-white p-5 shadow-sm sm:p-6"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--falcon-gold-dark)]">Equity Creation</p><h2 className="mt-1 text-lg font-semibold text-[var(--falcon-charcoal)]">Property Value vs Outstanding Loan</h2><p className="mt-2 text-sm text-zinc-500">The gap between projected property value and outstanding loan represents estimated equity — not investment profit.</p><div className="mt-5"><EquityChart years={journey} /></div></section>

          <section className="rounded-[28px] border border-[var(--falcon-soft-border)] bg-white p-5 shadow-sm sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--falcon-gold-dark)]">Exit</p><h2 className="mt-1 text-lg font-semibold text-[var(--falcon-charcoal)]">If You Sell in Year {selected.year}</h2>
            <div className="mt-4 max-w-2xl rounded-2xl border border-[var(--falcon-soft-border)] bg-[var(--falcon-warm-background)] px-4 sm:px-5"><div className="flex items-center justify-between gap-4 border-b border-[var(--falcon-soft-border)] py-3"><span className="text-sm text-zinc-600">Projected Selling Price</span><strong className="tabular-nums">{formatMoney(selected.propertyValue)}</strong></div><div className="flex items-center justify-between gap-4 border-b border-[var(--falcon-soft-border)] py-3"><span className="text-sm text-zinc-600">− Estimated Selling Cost</span><strong className="tabular-nums">{formatMoney(selected.estimatedSellingCost)}</strong></div><div className="flex items-center justify-between gap-4 border-b border-[var(--falcon-soft-border)] py-3"><span className="text-sm text-zinc-600">− Outstanding Loan</span><strong className="tabular-nums">{formatMoney(selected.outstandingLoan)}</strong></div><div className="flex items-end justify-between gap-4 py-4"><span className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">Net Sale Proceeds Before Tax</span><strong className="text-xl tabular-nums text-zinc-950">{formatMoney(selected.netSaleProceedsBeforeTax)}</strong></div></div>
            <p className="mt-3 text-xs text-zinc-500">Estimated Selling Cost is an illustrative assumption and does not include RPGT unless separately considered.</p>
          </section>

          <section className="rounded-[28px] border border-[var(--falcon-soft-border)] bg-white p-5 shadow-sm sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--falcon-gold-dark)]">Result</p><h2 className="mt-1 text-lg font-semibold text-[var(--falcon-charcoal)]">Estimated Investment Outcome</h2>
            <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-12">
              <Metric className="xl:col-span-2" valueClassName="whitespace-nowrap text-[clamp(0.875rem,1.25vw,1rem)] leading-tight tracking-[-0.025em]" label="Total Cash Invested" value={formatMoney(selected.totalCashInvested)} />
              <Metric className="xl:col-span-2" valueClassName="whitespace-nowrap text-[clamp(0.875rem,1.25vw,1rem)] leading-tight tracking-[-0.025em]" label="Net Operating Cash Flow" value={formatSignedMoney(selected.cumulativeOperatingCashFlow)} tone={selected.cumulativeOperatingCashFlow >= 0 ? "positive" : "negative"} />
              <Metric className="xl:col-span-2" valueClassName="whitespace-nowrap text-[clamp(0.875rem,1.25vw,1rem)] leading-tight tracking-[-0.025em]" label="Net Sale Proceeds" value={formatMoney(selected.netSaleProceedsBeforeTax)} />
              <Metric className="sm:col-span-2 xl:col-span-4" valueClassName="whitespace-nowrap text-[clamp(1.125rem,1.8vw,1.5rem)] leading-tight tracking-[-0.03em]" label="Estimated Investment Profit" value={formatSignedMoney(selected.estimatedInvestmentProfit)} featured tone={selected.estimatedInvestmentProfit >= 0 ? "positive" : "negative"} />
              <Metric className="xl:col-span-2" valueClassName="whitespace-nowrap text-[clamp(0.875rem,1.25vw,1rem)] leading-tight tracking-[-0.025em]" label="Estimated ROI" value={displayRoi(selected)} tone={(selected.estimatedRoiPercent ?? 0) >= 0 ? "positive" : "negative"} />
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-[var(--falcon-soft-border)] bg-[var(--falcon-warm-background)] px-4 sm:px-5">
                <p className="pt-4 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Cash Invested</p>
                <div className="mt-1 flex items-center justify-between gap-4 border-b border-[var(--falcon-soft-border)] py-3"><span className="text-sm text-zinc-600">Net Initial Capital</span><strong className="text-right tabular-nums text-zinc-950">{formatMoney(result?.input.initialCashRequired ?? 0)}</strong></div>
                <div className="flex items-center justify-between gap-4 border-b border-[var(--falcon-soft-border)] py-3"><span className="text-sm text-zinc-600">+ Additional Capital for Operating Deficits</span><strong className="text-right tabular-nums text-zinc-950">{formatMoney(selected.cumulativeNegativeOperatingCashFlow)}</strong></div>
                <div className="flex items-center justify-between gap-4 py-4"><span className="text-sm font-semibold text-zinc-800">= Total Cash Invested</span><strong className="text-right text-lg tabular-nums text-zinc-950">{formatMoney(selected.totalCashInvested)}</strong></div>
              </div>

              <div className="rounded-2xl border border-[var(--falcon-soft-border)] bg-[var(--falcon-warm-background)] px-4 py-4 sm:px-5">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Net Operating Cash Flow</p>
                <p className={`mt-2 text-2xl font-semibold tabular-nums ${selected.cumulativeOperatingCashFlow >= 0 ? "text-emerald-700" : "text-red-700"}`}>{formatSignedMoney(selected.cumulativeOperatingCashFlow)}</p>
                <p className="mt-2 text-sm leading-6 text-zinc-600">Total rental income less loan repayments, maintenance and other operating expenses over the holding period.</p>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-[#d8c48e] bg-[#fbf8ef] px-4 sm:px-5">
              <p className="pt-4 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--falcon-gold-dark)]">How Your Investment Profit Is Calculated</p>
              <div className="mt-1 flex items-center justify-between gap-4 border-b border-[#e6dcc1] py-3"><span className="text-sm text-zinc-600">Net Sale Proceeds</span><strong className="text-right tabular-nums text-zinc-950">{formatMoney(selected.netSaleProceedsBeforeTax)}</strong></div>
              <div className="flex items-center justify-between gap-4 border-b border-[#e6dcc1] py-3"><span className="text-sm text-zinc-600">+ Positive Operating Surplus</span><strong className="text-right tabular-nums text-emerald-700">{formatMoney(selected.cumulativePositiveOperatingCashFlow)}</strong></div>
              <div className="flex items-center justify-between gap-4 border-b border-[#e6dcc1] py-3"><span className="text-sm text-zinc-600">− Total Cash Invested</span><strong className="text-right tabular-nums text-zinc-950">{formatMoney(selected.totalCashInvested)}</strong></div>
              <div className="flex items-center justify-between gap-4 py-4"><span className="text-sm font-semibold text-zinc-900">= Estimated Investment Profit</span><strong className={`text-right text-xl font-semibold tabular-nums ${selected.estimatedInvestmentProfit >= 0 ? "text-emerald-700" : "text-red-700"}`}>{formatSignedMoney(selected.estimatedInvestmentProfit)}</strong></div>
            </div>

            <p className="mt-4 text-xs leading-5 text-zinc-500">Simple ROI = Investment Profit ÷ Total Cash Invested. Not an annualized return.</p>
            {!hasInitialCapitalForRoi ? <p className="mt-2 text-xs font-medium text-amber-700">Estimated ROI is unavailable because there is no positive net initial capital denominator.</p> : null}
            {hasLowInitialCapital ? <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">Low net initial capital can produce a very high simple ROI. Check that all upfront costs and cashback assumptions are complete.</p> : null}
          </section>

          <section className="min-w-0 overflow-hidden rounded-[28px] border border-[var(--falcon-soft-border)] bg-white shadow-sm"><div className="p-5 sm:p-6"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--falcon-gold-dark)]">Compare</p><h2 className="mt-1 text-lg font-semibold text-[var(--falcon-charcoal)]">Exit Scenarios</h2></div><div className="max-w-full overflow-x-auto border-t border-[var(--falcon-soft-border)]"><table className="w-full min-w-[960px] text-sm"><thead className="bg-[var(--falcon-warm-background)] text-xs uppercase tracking-[0.08em] text-zinc-500"><tr><th className="sticky left-0 z-10 bg-[var(--falcon-warm-background)] px-4 py-3 text-left">Exit Year</th><th className="px-4 py-3 text-right">Net Sale Proceeds</th><th className="px-4 py-3 text-right">Net Operating<br />Cash Flow</th><th title="Net initial capital + additional capital required for operating deficits" className="px-4 py-3 text-right">Total Cash<br />Invested</th><th title="Net sale proceeds + positive operating surplus − total cash invested" className="px-4 py-3 text-right">Investment Profit</th><th className="px-4 py-3 text-right">Estimated ROI</th></tr></thead><tbody className="divide-y divide-[var(--falcon-soft-border)]">{exitScenarios.map((year) => <tr key={year.year} className={year.year === selected.year ? "bg-[#fbf8ef]" : ""}><td className={`sticky left-0 z-10 px-4 py-3 font-semibold text-zinc-950 ${year.year === selected.year ? "bg-[#fbf8ef]" : "bg-white"}`}>Year {year.year}</td><td className="px-4 py-3 text-right tabular-nums">{formatMoney(year.netSaleProceedsBeforeTax)}</td><td className={`px-4 py-3 text-right tabular-nums ${year.cumulativeOperatingCashFlow >= 0 ? "text-emerald-700" : "text-red-700"}`}>{formatSignedMoney(year.cumulativeOperatingCashFlow)}</td><td className="px-4 py-3 text-right tabular-nums text-zinc-950">{formatMoney(year.totalCashInvested)}</td><td className={`px-4 py-3 text-right font-semibold tabular-nums ${year.estimatedInvestmentProfit >= 0 ? "text-emerald-700" : "text-red-700"}`}>{formatSignedMoney(year.estimatedInvestmentProfit)}</td><td className="px-4 py-3 text-right font-semibold tabular-nums">{displayRoi(year)}</td></tr>)}</tbody></table></div></section>

          <section className="min-w-0 overflow-hidden rounded-[28px] border border-[var(--falcon-soft-border)] bg-white shadow-sm"><div className="p-5 sm:p-6"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--falcon-gold-dark)]">Detail</p><h2 className="mt-1 text-lg font-semibold text-[var(--falcon-charcoal)]">Year-by-Year Investment Journey</h2></div><div className="max-w-full overflow-x-auto border-t border-[var(--falcon-soft-border)]"><table className="w-full min-w-[1080px] text-sm"><thead className="bg-[var(--falcon-warm-background)] text-xs uppercase tracking-[0.08em] text-zinc-500"><tr><th className="sticky left-0 z-10 bg-[var(--falcon-warm-background)] px-4 py-3 text-left">Year</th><th className="px-4 py-3 text-right">Property Value</th><th className="px-4 py-3 text-right">Outstanding Loan</th><th className="px-4 py-3 text-right">Equity</th><th className="px-4 py-3 text-right">Monthly Rental</th><th className="px-4 py-3 text-right">Monthly Cash Flow</th><th className="px-4 py-3 text-right">Cumulative Cash Flow</th></tr></thead><tbody className="divide-y divide-[var(--falcon-soft-border)]">{journey.map((year) => <tr key={year.year}><td className="sticky left-0 z-10 bg-white px-4 py-3 font-semibold text-zinc-950">Year {year.year}</td><td className="px-4 py-3 text-right tabular-nums">{formatMoney(year.propertyValue)}</td><td className="px-4 py-3 text-right tabular-nums">{formatMoney(year.outstandingLoan)}</td><td className="px-4 py-3 text-right tabular-nums">{formatMoney(year.equity)}</td><td className="px-4 py-3 text-right tabular-nums">{formatMoney(year.monthlyRental)}</td><td className={`px-4 py-3 text-right tabular-nums ${year.averageMonthlyCashFlow >= 0 ? "text-emerald-700" : "text-red-700"}`}>{formatSignedMoney(year.averageMonthlyCashFlow)}</td><td className={`px-4 py-3 text-right font-semibold tabular-nums ${year.cumulativeOperatingCashFlow >= 0 ? "text-emerald-700" : "text-red-700"}`}>{formatSignedMoney(year.cumulativeOperatingCashFlow)}</td></tr>)}</tbody></table></div></section>
        </>}

        <p className="rounded-2xl border border-[var(--falcon-soft-border)] bg-white px-5 py-4 text-xs leading-5 text-zinc-500">Figures are estimates for illustration purposes only and are based on the assumptions entered. Actual property value, rental, financing costs, expenses, selling costs, taxes and investment performance may differ.</p>
      </div>
    </main>
  );
}
