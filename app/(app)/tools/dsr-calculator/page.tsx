"use client";

import { useMemo, useState } from "react";

import { Button, PageHeader, StatusBadge } from "../../components/ui";

type DsrForm = {
  basicSalary: string;
  fixedAllowance: string;
  variableIncome: string;
  variableRecognitionPercent: string;
  otherIncome: string;
  housingLoan: string;
  carLoan: string;
  personalLoan: string;
  ptptnLoan: string;
  otherCommitments: string;
  creditCardOutstanding: string;
  creditCardCommitmentRate: string;
  newPropertyMonthlyInstalment: string;
  targetDsrPercent: string;
};

type InputFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  suffix?: string;
  min?: string;
  max?: string;
  step?: string;
  helper?: string;
  isInvalid?: boolean;
};

const defaultForm: DsrForm = {
  basicSalary: "0",
  fixedAllowance: "0",
  variableIncome: "0",
  variableRecognitionPercent: "100",
  otherIncome: "0",
  housingLoan: "0",
  carLoan: "0",
  personalLoan: "0",
  ptptnLoan: "0",
  otherCommitments: "0",
  creditCardOutstanding: "0",
  creditCardCommitmentRate: "5",
  newPropertyMonthlyInstalment: "0",
  targetDsrPercent: "70",
};

const moneyFormatter = new Intl.NumberFormat("en-MY", {
  style: "currency",
  currency: "MYR",
  maximumFractionDigits: 0,
});

const decimalFormatter = new Intl.NumberFormat("en-MY", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function parseNumberInput(value: string) {
  const parsed = Number(value.replace(/,/g, "").trim());

  return Number.isFinite(parsed) ? parsed : 0;
}

function clampNonNegative(value: number) {
  if (!Number.isFinite(value)) return 0;

  return Math.max(value, 0);
}

function formatMoney(value: number) {
  return moneyFormatter.format(clampNonNegative(value));
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return "0.0%";

  return `${decimalFormatter.format(value)}%`;
}

function getDsrStatus(currentDsrPercent: number, targetDsrPercent: number) {
  if (targetDsrPercent <= 0) {
    return {
      label: "Set a DSR benchmark",
      variant: "warning" as const,
    };
  }

  if (currentDsrPercent <= targetDsrPercent) {
    return {
      label: "Within selected DSR benchmark",
      variant: "success" as const,
    };
  }

  return {
    label: "Above selected DSR benchmark",
    variant: "warning" as const,
  };
}

function InputField({
  label,
  value,
  onChange,
  suffix = "RM",
  min = "0",
  max,
  step = "0.01",
  helper,
  isInvalid = false,
}: InputFieldProps) {
  return (
    <label className="block text-sm">
      <span className="font-semibold text-zinc-700">{label}</span>
      <div className="mt-2 flex overflow-hidden rounded-2xl border border-[var(--falcon-soft-border)] bg-white transition focus-within:border-[var(--falcon-gold-dark)]">
        <span className="flex min-w-14 items-center justify-center border-r border-[var(--falcon-soft-border)] bg-[var(--falcon-warm-background)] px-3 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--falcon-muted-text)]">
          {suffix}
        </span>
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`min-h-12 w-full bg-white px-4 py-3 text-sm font-medium text-zinc-950 outline-none focus:ring-2 focus:ring-[#b8924a]/15 ${
            isInvalid ? "bg-red-50" : ""
          }`}
        />
      </div>
      {helper ? (
        <span className="mt-1 block text-xs leading-5 text-[var(--falcon-muted-text)]">
          {helper}
        </span>
      ) : null}
      {isInvalid ? (
        <span className="mt-1 block text-xs font-medium text-amber-700">
          Check this assumption before relying on the estimate.
        </span>
      ) : null}
    </label>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[var(--falcon-soft-border)] py-3 last:border-b-0">
      <span className="text-sm text-[var(--falcon-muted-text)]">{label}</span>
      <span className="text-right text-sm font-semibold text-zinc-950">{value}</span>
    </div>
  );
}

export default function DsrCalculatorPage() {
  const [form, setForm] = useState<DsrForm>(defaultForm);

  function updateField(field: keyof DsrForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  const values = useMemo(() => {
    const basicSalary = clampNonNegative(parseNumberInput(form.basicSalary));
    const fixedAllowance = clampNonNegative(parseNumberInput(form.fixedAllowance));
    const variableIncome = clampNonNegative(parseNumberInput(form.variableIncome));
    const variableRecognitionPercent = clampNonNegative(
      parseNumberInput(form.variableRecognitionPercent),
    );
    const otherIncome = clampNonNegative(parseNumberInput(form.otherIncome));
    const housingLoan = clampNonNegative(parseNumberInput(form.housingLoan));
    const carLoan = clampNonNegative(parseNumberInput(form.carLoan));
    const personalLoan = clampNonNegative(parseNumberInput(form.personalLoan));
    const ptptnLoan = clampNonNegative(parseNumberInput(form.ptptnLoan));
    const otherCommitments = clampNonNegative(parseNumberInput(form.otherCommitments));
    const creditCardOutstanding = clampNonNegative(
      parseNumberInput(form.creditCardOutstanding),
    );
    const creditCardCommitmentRate = clampNonNegative(
      parseNumberInput(form.creditCardCommitmentRate),
    );
    const newPropertyMonthlyInstalment = clampNonNegative(
      parseNumberInput(form.newPropertyMonthlyInstalment),
    );
    const targetDsrPercent = parseNumberInput(form.targetDsrPercent);
    const recognisedVariableIncome = variableIncome * (variableRecognitionPercent / 100);
    const totalRecognisedIncome =
      basicSalary + fixedAllowance + recognisedVariableIncome + otherIncome;
    const creditCardCommitment =
      creditCardOutstanding * (creditCardCommitmentRate / 100);
    const totalExistingCommitments =
      housingLoan +
      carLoan +
      personalLoan +
      ptptnLoan +
      otherCommitments +
      creditCardCommitment;
    const currentDsrPercent =
      totalRecognisedIncome > 0
        ? (totalExistingCommitments / totalRecognisedIncome) * 100
        : 0;
    const projectedTotalCommitments =
      totalExistingCommitments + newPropertyMonthlyInstalment;
    const projectedDsrPercent =
      totalRecognisedIncome > 0
        ? (projectedTotalCommitments / totalRecognisedIncome) * 100
        : 0;
    const validTargetDsr =
      Number.isFinite(targetDsrPercent) && targetDsrPercent >= 0 && targetDsrPercent <= 100;
    const targetCommitment =
      totalRecognisedIncome > 0 && validTargetDsr
        ? totalRecognisedIncome * (targetDsrPercent / 100)
        : 0;
    const remainingCommitmentBuffer = Math.max(
      targetCommitment - projectedTotalCommitments,
      0,
    );

    return {
      basicSalary,
      fixedAllowance,
      variableIncome,
      variableRecognitionPercent,
      recognisedVariableIncome,
      otherIncome,
      housingLoan,
      carLoan,
      personalLoan,
      ptptnLoan,
      otherCommitments,
      creditCardOutstanding,
      creditCardCommitmentRate,
      creditCardCommitment,
      newPropertyMonthlyInstalment,
      totalRecognisedIncome,
      totalExistingCommitments,
      currentDsrPercent,
      projectedTotalCommitments,
      projectedDsrPercent,
      targetDsrPercent,
      targetCommitment,
      remainingCommitmentBuffer,
      validTargetDsr,
    };
  }, [form]);

  const dsrStatus = getDsrStatus(values.projectedDsrPercent, values.targetDsrPercent);
  const scenarioLine =
    values.projectedDsrPercent <= values.targetDsrPercent
      ? `After adding the new property instalment of ${formatMoney(values.newPropertyMonthlyInstalment)}, the customer's estimated DSR increases from ${formatPercent(values.currentDsrPercent)} to ${formatPercent(values.projectedDsrPercent)}.`
      : `After adding the new property instalment of ${formatMoney(values.newPropertyMonthlyInstalment)}, the estimated DSR becomes ${formatPercent(values.projectedDsrPercent)}, above the selected ${formatPercent(values.targetDsrPercent)} benchmark.`;

  return (
    <main className="min-h-screen bg-[var(--falcon-warm-background)] px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <PageHeader
          eyebrow="Customer Tools"
          title="DSR Calculator"
          description="Estimate customer borrowing capacity before recommending a property."
          actions={
            <Button type="button" variant="secondary" onClick={() => setForm(defaultForm)}>
              Reset
            </Button>
          }
          meta={
            <StatusBadge variant="accent">
              Estimate only
            </StatusBadge>
          }
        />

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-6">
            <section className="rounded-[28px] border border-[var(--falcon-soft-border)] bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--falcon-gold-dark)]">
                  Income
                </p>
                <h2 className="mt-1 text-lg font-semibold text-[var(--falcon-charcoal)]">
                  Monthly Income
                </h2>
                <p className="mt-1 text-sm leading-6 text-[var(--falcon-muted-text)]">
                  Enter the customer&apos;s monthly income and adjust how much variable income is recognised.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <InputField
                  label="Basic Salary"
                  value={form.basicSalary}
                  onChange={(value) => updateField("basicSalary", value)}
                />
                <InputField
                  label="Fixed Allowance"
                  value={form.fixedAllowance}
                  onChange={(value) => updateField("fixedAllowance", value)}
                />
                <InputField
                  label="Commission / Variable Income"
                  value={form.variableIncome}
                  onChange={(value) => updateField("variableIncome", value)}
                  helper="Use a monthly average. Recognition may differ by bank."
                />
                <InputField
                  label="Variable Income Recognition"
                  value={form.variableRecognitionPercent}
                  onChange={(value) => updateField("variableRecognitionPercent", value)}
                  suffix="%"
                  max="100"
                  helper={`Recognised variable income: ${formatMoney(values.recognisedVariableIncome)}`}
                />
                <InputField
                  label="Other Recognised Income"
                  value={form.otherIncome}
                  onChange={(value) => updateField("otherIncome", value)}
                />
              </div>

              <div className="mt-5 rounded-2xl border border-[#d8c48e] bg-[#fbf8ef] px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--falcon-gold-dark)]">
                  Total Recognised Income
                </p>
                <p className="mt-1 text-2xl font-semibold text-[var(--falcon-charcoal)]">
                  {formatMoney(values.totalRecognisedIncome)}
                </p>
              </div>
            </section>

            <section className="rounded-[28px] border border-[var(--falcon-soft-border)] bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--falcon-gold-dark)]">
                  Commitments
                </p>
                <h2 className="mt-1 text-lg font-semibold text-[var(--falcon-charcoal)]">
                  Existing Monthly Commitments
                </h2>
                <p className="mt-1 text-sm leading-6 text-[var(--falcon-muted-text)]">
                  Add current recurring loan and credit commitments. Credit card treatment is adjustable.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <InputField
                  label="Existing Housing Loan"
                  value={form.housingLoan}
                  onChange={(value) => updateField("housingLoan", value)}
                />
                <InputField
                  label="Car Loan"
                  value={form.carLoan}
                  onChange={(value) => updateField("carLoan", value)}
                />
                <InputField
                  label="Personal Loan"
                  value={form.personalLoan}
                  onChange={(value) => updateField("personalLoan", value)}
                />
                <InputField
                  label="PTPTN / Education Loan"
                  value={form.ptptnLoan}
                  onChange={(value) => updateField("ptptnLoan", value)}
                />
                <InputField
                  label="Other Monthly Commitments"
                  value={form.otherCommitments}
                  onChange={(value) => updateField("otherCommitments", value)}
                />
                <InputField
                  label="Credit Card Outstanding Balance"
                  value={form.creditCardOutstanding}
                  onChange={(value) => updateField("creditCardOutstanding", value)}
                />
                <InputField
                  label="Credit Card Commitment Rate"
                  value={form.creditCardCommitmentRate}
                  onChange={(value) => updateField("creditCardCommitmentRate", value)}
                  suffix="%"
                  helper={`Derived credit card commitment: ${formatMoney(values.creditCardCommitment)}`}
                />
              </div>

              <div className="mt-5 rounded-2xl border border-[var(--falcon-soft-border)] bg-[var(--falcon-warm-background)] px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--falcon-muted-text)]">
                  Total Existing Commitments
                </p>
                <p className="mt-1 text-2xl font-semibold text-[var(--falcon-charcoal)]">
                  {formatMoney(values.totalExistingCommitments)}
                </p>
              </div>
            </section>

            <section className="rounded-[28px] border border-[var(--falcon-soft-border)] bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--falcon-gold-dark)]">
                  New Property
                </p>
                <h2 className="mt-1 text-lg font-semibold text-[var(--falcon-charcoal)]">
                  New Property Monthly Instalment
                </h2>
                <p className="mt-1 text-sm leading-6 text-[var(--falcon-muted-text)]">
                  Enter the estimated monthly instalment for the property the customer plans to purchase.
                </p>
              </div>

              <div className="rounded-2xl border border-[#d8c48e] bg-[#fbf8ef] p-4">
                <InputField
                  label="New Property Monthly Instalment"
                  value={form.newPropertyMonthlyInstalment}
                  onChange={(value) => updateField("newPropertyMonthlyInstalment", value)}
                  helper="This is a proposed new commitment, not an existing commitment."
                />
              </div>
            </section>

            <section className="rounded-[28px] border border-[var(--falcon-soft-border)] bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--falcon-gold-dark)]">
                  Benchmark
                </p>
                <h2 className="mt-1 text-lg font-semibold text-[var(--falcon-charcoal)]">
                  DSR Benchmark
                </h2>
                <p className="mt-1 text-sm leading-6 text-[var(--falcon-muted-text)]">
                  Adjust this benchmark to match the bank or borrower scenario being assessed.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <InputField
                  label="Target DSR"
                  value={form.targetDsrPercent}
                  onChange={(value) => updateField("targetDsrPercent", value)}
                  suffix="%"
                  max="100"
                  helper="This is adjustable and not a universal bank rule."
                  isInvalid={!values.validTargetDsr}
                />
              </div>
            </section>
          </div>

          <aside className="space-y-4 xl:sticky xl:top-8 xl:self-start">
            <section className="rounded-[30px] border border-[var(--falcon-soft-border)] bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--falcon-gold-dark)]">
                    Results
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-[var(--falcon-charcoal)]">
                    DSR After New Property
                  </h2>
                </div>
                <StatusBadge variant={dsrStatus.variant}>{dsrStatus.label}</StatusBadge>
              </div>

              <div className="mt-5 space-y-3">
                <div className="rounded-2xl border border-[#d8c48e] bg-[#fbf8ef] px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--falcon-muted-text)]">
                    Projected DSR
                  </p>
                  <p className="mt-1 text-4xl font-semibold text-[var(--falcon-charcoal)]">
                    {formatPercent(values.projectedDsrPercent)}
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <div className="rounded-2xl border border-[var(--falcon-soft-border)] px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--falcon-muted-text)]">
                      Current DSR
                    </p>
                    <p className="mt-1 text-2xl font-semibold text-zinc-950">
                      {formatPercent(values.currentDsrPercent)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[var(--falcon-soft-border)] px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--falcon-muted-text)]">
                      New Property Instalment
                    </p>
                    <p className="mt-1 text-2xl font-semibold text-zinc-950">
                      {formatMoney(values.newPropertyMonthlyInstalment)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[var(--falcon-soft-border)] px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--falcon-muted-text)]">
                      Projected Total Commitments
                    </p>
                    <p className="mt-1 text-2xl font-semibold text-zinc-950">
                      {formatMoney(values.projectedTotalCommitments)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[var(--falcon-soft-border)] px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--falcon-muted-text)]">
                      Selected DSR Benchmark
                    </p>
                    <p className="mt-1 text-2xl font-semibold text-zinc-950">
                      {formatPercent(values.targetDsrPercent)}
                    </p>
                  </div>
                </div>
              </div>

              <p className="mt-5 rounded-2xl border border-[var(--falcon-soft-border)] bg-white px-4 py-3 text-sm leading-6 text-[var(--falcon-muted-text)]">
                {scenarioLine}
              </p>
            </section>

            <section className="rounded-[28px] border border-[var(--falcon-soft-border)] bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold text-[var(--falcon-charcoal)]">
                Result Breakdown
              </p>
              <div className="mt-3">
                <SummaryRow label="Recognised Income" value={formatMoney(values.totalRecognisedIncome)} />
                <SummaryRow label="Existing Commitments" value={formatMoney(values.totalExistingCommitments)} />
                <SummaryRow label="New Property Instalment" value={formatMoney(values.newPropertyMonthlyInstalment)} />
                <SummaryRow label="Projected Total Commitments" value={formatMoney(values.projectedTotalCommitments)} />
                <SummaryRow label="Current DSR" value={formatPercent(values.currentDsrPercent)} />
                <SummaryRow label="Projected DSR" value={formatPercent(values.projectedDsrPercent)} />
                <SummaryRow label="Selected DSR Benchmark" value={formatPercent(values.targetDsrPercent)} />
                <SummaryRow label="Remaining Monthly Buffer to Selected DSR" value={formatMoney(values.remainingCommitmentBuffer)} />
              </div>
            </section>

            <section className="rounded-[28px] border border-amber-200 bg-amber-50/80 p-5 text-sm leading-6 text-amber-900 shadow-sm">
              <p className="font-semibold">Estimate only.</p>
              <p className="mt-1">
                Actual bank assessment may differ due to income recognition, DSR methodology,
                variable income history, CCRIS/CTOS, credit conduct, borrower profile and
                bank-specific underwriting.
              </p>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
