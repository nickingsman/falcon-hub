import { calculateMonthlyInstalment } from "./property-finance";

export type LoanAmortizationInput = {
  loanAmount: number;
  annualInterestRatePercent: number;
  tenureYears: number;
  extraMonthlyPayment?: number;
};

export type AmortizationPayment = {
  month: number;
  openingBalance: number;
  scheduledInstalment: number;
  extraPayment: number;
  payment: number;
  principal: number;
  interest: number;
  closingBalance: number;
};

export type YearlyAmortizationSummary = {
  year: number;
  openingBalance: number;
  principalPaid: number;
  interestPaid: number;
  totalPayment: number;
  closingBalance: number;
};

export type LoanAmortizationResult = {
  loanAmount: number;
  monthlyInstalment: number;
  actualMonthlyPayment: number;
  contractualMonths: number;
  payoffMonth: number;
  totalPrincipal: number;
  totalInterest: number;
  totalRepayment: number;
  schedule: AmortizationPayment[];
};

const BALANCE_EPSILON = 0.000001;

function isValidInput(input: LoanAmortizationInput) {
  return (
    Number.isFinite(input.loanAmount) &&
    input.loanAmount > 0 &&
    Number.isFinite(input.annualInterestRatePercent) &&
    input.annualInterestRatePercent >= 0 &&
    Number.isFinite(input.tenureYears) &&
    input.tenureYears > 0 &&
    Number.isInteger(input.tenureYears * 12) &&
    Number.isFinite(input.extraMonthlyPayment ?? 0) &&
    (input.extraMonthlyPayment ?? 0) >= 0
  );
}

export function generateAmortizationSchedule(
  input: LoanAmortizationInput,
): LoanAmortizationResult | null {
  if (!isValidInput(input)) return null;

  const monthlyInstalment = calculateMonthlyInstalment(
    input.loanAmount,
    input.annualInterestRatePercent,
    input.tenureYears,
  );

  if (monthlyInstalment === null || !Number.isFinite(monthlyInstalment)) return null;

  const contractualMonths = Math.round(input.tenureYears * 12);
  const monthlyRate = input.annualInterestRatePercent / 100 / 12;
  const extraMonthlyPayment = input.extraMonthlyPayment ?? 0;
  const plannedMonthlyPayment = monthlyInstalment + extraMonthlyPayment;
  const schedule: AmortizationPayment[] = [];
  let balance = input.loanAmount;

  for (let month = 1; month <= contractualMonths && balance > 0; month += 1) {
    const openingBalance = balance;
    const interest = monthlyRate === 0 ? 0 : openingBalance * monthlyRate;
    const amountDue = openingBalance + interest;
    const payment = Math.min(plannedMonthlyPayment, amountDue);
    const principal = Math.min(openingBalance, Math.max(0, payment - interest));
    const closingBalance = Math.max(0, openingBalance - principal);

    balance = closingBalance <= BALANCE_EPSILON ? 0 : closingBalance;
    schedule.push({
      month,
      openingBalance,
      scheduledInstalment: Math.min(monthlyInstalment, payment),
      extraPayment: Math.max(0, payment - Math.min(monthlyInstalment, payment)),
      payment,
      principal: openingBalance - balance,
      interest,
      closingBalance: balance,
    });
  }

  if (schedule.length === 0 || schedule.at(-1)?.closingBalance !== 0) return null;

  const totalPrincipal = schedule.reduce((sum, row) => sum + row.principal, 0);
  const totalInterest = schedule.reduce((sum, row) => sum + row.interest, 0);

  return {
    loanAmount: input.loanAmount,
    monthlyInstalment,
    actualMonthlyPayment: plannedMonthlyPayment,
    contractualMonths,
    payoffMonth: schedule.length,
    totalPrincipal,
    totalInterest,
    totalRepayment: totalPrincipal + totalInterest,
    schedule,
  };
}

export function summarizeAmortizationByYear(
  schedule: AmortizationPayment[],
): YearlyAmortizationSummary[] {
  const years: YearlyAmortizationSummary[] = [];

  for (let index = 0; index < schedule.length; index += 12) {
    const payments = schedule.slice(index, index + 12);
    const first = payments[0];
    const last = payments.at(-1);

    if (!first || !last) continue;

    years.push({
      year: Math.floor(index / 12) + 1,
      openingBalance: first.openingBalance,
      principalPaid: payments.reduce((sum, row) => sum + row.principal, 0),
      interestPaid: payments.reduce((sum, row) => sum + row.interest, 0),
      totalPayment: payments.reduce((sum, row) => sum + row.payment, 0),
      closingBalance: last.closingBalance,
    });
  }

  return years;
}

export function getOutstandingBalanceAtMonth(
  result: LoanAmortizationResult,
  month: number,
) {
  if (!Number.isFinite(month) || month <= 0) return result.loanAmount;

  const completedMonth = Math.min(Math.floor(month), result.schedule.length);
  return result.schedule[completedMonth - 1]?.closingBalance ?? result.loanAmount;
}

export function getLoanSavings(
  normalLoan: LoanAmortizationResult,
  acceleratedLoan: LoanAmortizationResult,
) {
  return {
    monthsSaved: Math.max(0, normalLoan.payoffMonth - acceleratedLoan.payoffMonth),
    interestSaved: Math.max(0, normalLoan.totalInterest - acceleratedLoan.totalInterest),
  };
}
