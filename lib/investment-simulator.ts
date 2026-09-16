import {
  generateAmortizationSchedule,
  getOutstandingBalanceAtMonth,
  type LoanAmortizationResult,
} from "./loan-amortization";

export type InvestmentScenario = "conservative" | "base" | "optimistic";

export const investmentScenarioAssumptions: Record<
  InvestmentScenario,
  { capitalAppreciationPercent: number; rentalAppreciationPercent: number }
> = {
  conservative: { capitalAppreciationPercent: 2, rentalAppreciationPercent: 1 },
  base: { capitalAppreciationPercent: 3, rentalAppreciationPercent: 2 },
  optimistic: { capitalAppreciationPercent: 4, rentalAppreciationPercent: 3 },
};

export type InvestmentSimulatorInput = {
  spaPrice: number;
  nettPrice: number;
  initialCashRequired: number;
  loanMarginPercent: number;
  annualInterestRatePercent: number;
  loanTenureYears: number;
  startingMonthlyRental: number;
  rentalAppreciationPercent: number;
  monthlyMaintenance: number;
  otherMonthlyExpenses: number;
  capitalAppreciationPercent: number;
  estimatedSellingCostPercent: number;
  holdingPeriodYears: number;
};

export type InvestmentYearResult = {
  year: number;
  propertyValue: number;
  outstandingLoan: number;
  equity: number;
  monthlyRental: number;
  averageMonthlyCashFlow: number;
  annualOperatingCashFlow: number;
  cumulativeOperatingCashFlow: number;
  cumulativePositiveOperatingCashFlow: number;
  cumulativeNegativeOperatingCashFlow: number;
  totalCashInvested: number;
  estimatedSellingCost: number;
  netSaleProceedsBeforeTax: number;
  estimatedInvestmentProfit: number;
  estimatedRoiPercent: number | null;
};

export type InvestmentSimulatorResult = {
  input: InvestmentSimulatorInput;
  loanAmount: number;
  monthlyInstalment: number;
  loan: LoanAmortizationResult | null;
  years: InvestmentYearResult[];
  selectedYear: InvestmentYearResult;
};

export type InvestmentFinancingInput = Pick<
  InvestmentSimulatorInput,
  | "spaPrice"
  | "loanMarginPercent"
  | "annualInterestRatePercent"
  | "loanTenureYears"
>;

export type InvestmentFinancingResult = {
  loanAmount: number;
  monthlyInstalment: number;
  loan: LoanAmortizationResult | null;
};

export type InvestmentPricePosition = {
  suggestedDownpayment: number;
  cashback: number;
};

export type InvestmentEntryCapitalResult = {
  grossEntryCosts: number;
  netInitialCapital: number;
  excessCashback: number;
};

function isFiniteWithin(value: number, minimum: number, maximum: number) {
  return Number.isFinite(value) && value >= minimum && value <= maximum;
}

function isValidInvestmentInput(input: InvestmentSimulatorInput) {
  return (
    isFiniteWithin(input.spaPrice, 1, 100_000_000) &&
    isFiniteWithin(input.nettPrice, 1, 100_000_000) &&
    isFiniteWithin(input.initialCashRequired, 0, 100_000_000) &&
    isFiniteWithin(input.loanMarginPercent, 0, 100) &&
    isFiniteWithin(input.annualInterestRatePercent, 0, 20) &&
    isFiniteWithin(input.loanTenureYears, 1 / 12, 40) &&
    Number.isInteger(input.loanTenureYears * 12) &&
    isFiniteWithin(input.startingMonthlyRental, 0, 1_000_000) &&
    isFiniteWithin(input.rentalAppreciationPercent, -100, 100) &&
    isFiniteWithin(input.monthlyMaintenance, 0, 1_000_000) &&
    isFiniteWithin(input.otherMonthlyExpenses, 0, 1_000_000) &&
    isFiniteWithin(input.capitalAppreciationPercent, -100, 100) &&
    isFiniteWithin(input.estimatedSellingCostPercent, 0, 100) &&
    Number.isInteger(input.holdingPeriodYears) &&
    isFiniteWithin(input.holdingPeriodYears, 1, 35)
  );
}

export function applyInvestmentScenario(
  input: InvestmentSimulatorInput,
  scenario: InvestmentScenario,
): InvestmentSimulatorInput {
  return { ...input, ...investmentScenarioAssumptions[scenario] };
}

export function calculateInvestmentFinancing(
  input: InvestmentFinancingInput,
): InvestmentFinancingResult | null {
  if (
    !isFiniteWithin(input.spaPrice, 1, 100_000_000) ||
    !isFiniteWithin(input.loanMarginPercent, 0, 100) ||
    !isFiniteWithin(input.annualInterestRatePercent, 0, 20) ||
    !isFiniteWithin(input.loanTenureYears, 1 / 12, 40) ||
    !Number.isInteger(input.loanTenureYears * 12)
  ) {
    return null;
  }

  const loanAmount = input.spaPrice * (input.loanMarginPercent / 100);
  const loan =
    loanAmount > 0
      ? generateAmortizationSchedule({
          loanAmount,
          annualInterestRatePercent: input.annualInterestRatePercent,
          tenureYears: input.loanTenureYears,
        })
      : null;

  if (loanAmount > 0 && !loan) return null;

  return {
    loanAmount,
    monthlyInstalment: loan?.monthlyInstalment ?? 0,
    loan,
  };
}

export function calculateInvestmentPricePosition(
  nettPrice: number,
  loanAmount: number,
): InvestmentPricePosition | null {
  if (
    !Number.isFinite(nettPrice) ||
    nettPrice < 0 ||
    !Number.isFinite(loanAmount) ||
    loanAmount < 0
  ) {
    return null;
  }

  return {
    suggestedDownpayment: Math.max(nettPrice - loanAmount, 0),
    cashback: Math.max(loanAmount - nettPrice, 0),
  };
}

export function calculateInvestmentEntryCapital(input: {
  downpayment: number;
  renovation: number;
  otherCosts: number;
  cashback: number;
}): InvestmentEntryCapitalResult {
  const grossEntryCosts =
    Math.max(input.downpayment, 0) +
    Math.max(input.renovation, 0) +
    Math.max(input.otherCosts, 0);
  const cashback = Math.max(input.cashback, 0);

  return {
    grossEntryCosts,
    netInitialCapital: Math.max(grossEntryCosts - cashback, 0),
    excessCashback: Math.max(cashback - grossEntryCosts, 0),
  };
}

export function calculateInvestmentSimulation(
  input: InvestmentSimulatorInput,
): InvestmentSimulatorResult | null {
  if (!isValidInvestmentInput(input)) return null;

  const financing = calculateInvestmentFinancing(input);
  if (!financing) return null;
  const { loanAmount, loan, monthlyInstalment } = financing;

  const years: InvestmentYearResult[] = [];
  let cumulativeOperatingCashFlow = 0;
  let cumulativePositiveOperatingCashFlow = 0;
  let cumulativeNegativeOperatingCashFlow = 0;

  const projectionYears = Math.max(input.holdingPeriodYears, 20);

  for (let year = 1; year <= projectionYears; year += 1) {
    const monthlyRental =
      input.startingMonthlyRental *
      (1 + input.rentalAppreciationPercent / 100) ** (year - 1);
    let annualOperatingCashFlow = 0;

    for (let monthInYear = 1; monthInYear <= 12; monthInYear += 1) {
      const loanMonth = (year - 1) * 12 + monthInYear;
      const loanPayment = loan?.schedule[loanMonth - 1]?.payment ?? 0;
      const monthlyOperatingCashFlow =
        monthlyRental - loanPayment - input.monthlyMaintenance - input.otherMonthlyExpenses;

      annualOperatingCashFlow += monthlyOperatingCashFlow;
      cumulativeOperatingCashFlow += monthlyOperatingCashFlow;
      if (monthlyOperatingCashFlow >= 0) {
        cumulativePositiveOperatingCashFlow += monthlyOperatingCashFlow;
      } else {
        cumulativeNegativeOperatingCashFlow += Math.abs(monthlyOperatingCashFlow);
      }
    }

    const propertyValue =
      input.nettPrice * (1 + input.capitalAppreciationPercent / 100) ** year;
    const outstandingLoan = loan
      ? getOutstandingBalanceAtMonth(loan, year * 12)
      : 0;
    const equity = propertyValue - outstandingLoan;
    const estimatedSellingCost =
      propertyValue * (input.estimatedSellingCostPercent / 100);
    const netSaleProceedsBeforeTax =
      propertyValue - estimatedSellingCost - outstandingLoan;
    const totalCashInvested =
      input.initialCashRequired + cumulativeNegativeOperatingCashFlow;
    const estimatedInvestmentProfit =
      netSaleProceedsBeforeTax +
      cumulativePositiveOperatingCashFlow -
      totalCashInvested;
    const estimatedRoiPercent =
      totalCashInvested > 0
        ? (estimatedInvestmentProfit / totalCashInvested) * 100
        : null;

    years.push({
      year,
      propertyValue,
      outstandingLoan,
      equity,
      monthlyRental,
      averageMonthlyCashFlow: annualOperatingCashFlow / 12,
      annualOperatingCashFlow,
      cumulativeOperatingCashFlow,
      cumulativePositiveOperatingCashFlow,
      cumulativeNegativeOperatingCashFlow,
      totalCashInvested,
      estimatedSellingCost,
      netSaleProceedsBeforeTax,
      estimatedInvestmentProfit,
      estimatedRoiPercent,
    });
  }

  const selectedYear = years[input.holdingPeriodYears - 1];
  if (!selectedYear) return null;

  return {
    input,
    loanAmount,
    monthlyInstalment,
    loan,
    years,
    selectedYear,
  };
}

export function getInvestmentYear(
  result: InvestmentSimulatorResult,
  year: number,
) {
  if (!Number.isInteger(year) || year < 1) return null;
  return result.years[year - 1] ?? null;
}
