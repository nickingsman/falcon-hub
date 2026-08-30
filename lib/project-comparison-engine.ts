import { calculateMonthlyInstalment } from "@/lib/property-finance";

export type ComparisonAssumptions = {
  loanMarginPercent: number;
  annualInterestRatePercent: number;
  loanTenureYears: number;
};

export type ComparisonUnitInput = {
  price_from: number | null;
  price_to: number | null;
  size_sqft: number | null;
  maintenance_fee_per_sqft: number | null;
  estimated_rental_from: number | null;
  estimated_rental_to: number | null;
};

export type UnavailableRange = {
  kind: "unavailable";
};

export type SingleRange = {
  kind: "single";
  value: number;
};

export type ValueRange = {
  kind: "range";
  from: number;
  to: number;
};

export type ComparisonRange = UnavailableRange | SingleRange | ValueRange;

export type ProjectComparisonMetrics = {
  finalNetPrice: ComparisonRange;
  psf: ComparisonRange;
  monthlyMaintenance: ComparisonRange;
  estimatedMonthlyInstalment: ComparisonRange;
  loanAmount: ComparisonRange;
  estimatedRental: ComparisonRange;
  estimatedGrossRentalYieldPercent: ComparisonRange;
};

const unavailable: UnavailableRange = { kind: "unavailable" };

function normalizeNonNegativeNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value) || value < 0) return null;

  return value;
}

function normalizePositiveNumber(value: number | null | undefined) {
  const normalized = normalizeNonNegativeNumber(value);

  return normalized !== null && normalized > 0 ? normalized : null;
}

function createRange(from: number | null | undefined, to: number | null | undefined): ComparisonRange {
  const normalizedFrom = normalizeNonNegativeNumber(from);
  const normalizedTo = normalizeNonNegativeNumber(to);

  if (normalizedFrom === null) return unavailable;
  if (normalizedTo === null || normalizedTo === normalizedFrom) {
    return { kind: "single", value: normalizedFrom };
  }
  if (normalizedTo < normalizedFrom) return unavailable;

  return {
    kind: "range",
    from: normalizedFrom,
    to: normalizedTo,
  };
}

function mapRange(range: ComparisonRange, mapper: (value: number) => number | null): ComparisonRange {
  if (range.kind === "unavailable") return unavailable;

  if (range.kind === "single") {
    const mapped = mapper(range.value);

    return mapped === null || !Number.isFinite(mapped) ? unavailable : { kind: "single", value: mapped };
  }

  const mappedFrom = mapper(range.from);
  const mappedTo = mapper(range.to);

  if (
    mappedFrom === null ||
    mappedTo === null ||
    !Number.isFinite(mappedFrom) ||
    !Number.isFinite(mappedTo)
  ) {
    return unavailable;
  }

  return mappedFrom === mappedTo
    ? { kind: "single", value: mappedFrom }
    : { kind: "range", from: mappedFrom, to: mappedTo };
}

function areLoanAssumptionsValid(assumptions: ComparisonAssumptions) {
  return (
    Number.isFinite(assumptions.loanMarginPercent) &&
    assumptions.loanMarginPercent >= 0 &&
    assumptions.loanMarginPercent <= 100 &&
    Number.isFinite(assumptions.annualInterestRatePercent) &&
    assumptions.annualInterestRatePercent >= 0 &&
    Number.isFinite(assumptions.loanTenureYears) &&
    assumptions.loanTenureYears > 0
  );
}

function calculatePsf(priceRange: ComparisonRange, sizeSqft: number | null | undefined) {
  const size = normalizePositiveNumber(sizeSqft);

  if (size === null) return unavailable;

  return mapRange(priceRange, (price) => price / size);
}

function calculateMonthlyMaintenance(
  sizeSqft: number | null | undefined,
  maintenanceFeePerSqft: number | null | undefined,
) {
  const size = normalizePositiveNumber(sizeSqft);
  const fee = normalizeNonNegativeNumber(maintenanceFeePerSqft);

  if (size === null || fee === null) return unavailable;

  return {
    kind: "single",
    value: size * fee,
  } satisfies SingleRange;
}

function calculateLoanAmount(priceRange: ComparisonRange, assumptions: ComparisonAssumptions) {
  if (!areLoanAssumptionsValid(assumptions)) return unavailable;

  return mapRange(priceRange, (price) => price * (assumptions.loanMarginPercent / 100));
}

function calculateInstalment(loanAmountRange: ComparisonRange, assumptions: ComparisonAssumptions) {
  if (!areLoanAssumptionsValid(assumptions)) return unavailable;

  return mapRange(loanAmountRange, (loanAmount) =>
    calculateMonthlyInstalment(
      loanAmount,
      assumptions.annualInterestRatePercent,
      assumptions.loanTenureYears,
    ),
  );
}

function calculateGrossYield(priceRange: ComparisonRange, rentalRange: ComparisonRange) {
  if (priceRange.kind === "single" && rentalRange.kind === "single") {
    if (priceRange.value <= 0) return unavailable;

    return {
      kind: "single",
      value: ((rentalRange.value * 12) / priceRange.value) * 100,
    } satisfies SingleRange;
  }

  if (priceRange.kind === "range" && rentalRange.kind === "range") {
    if (priceRange.from <= 0 || priceRange.to <= 0) return unavailable;

    const conservative = ((rentalRange.from * 12) / priceRange.to) * 100;
    const upper = ((rentalRange.to * 12) / priceRange.from) * 100;

    if (!Number.isFinite(conservative) || !Number.isFinite(upper)) return unavailable;

    if (conservative === upper) {
      return { kind: "single", value: conservative } satisfies SingleRange;
    }

    return { kind: "range", from: conservative, to: upper } satisfies ValueRange;
  }

  return unavailable;
}

export function calculateProjectComparisonMetrics(
  input: ComparisonUnitInput,
  assumptions: ComparisonAssumptions,
): ProjectComparisonMetrics {
  const finalNetPrice = createRange(input.price_from, input.price_to);
  const loanAmount = calculateLoanAmount(finalNetPrice, assumptions);
  const estimatedRental = createRange(input.estimated_rental_from, input.estimated_rental_to);

  return {
    finalNetPrice,
    psf: calculatePsf(finalNetPrice, input.size_sqft),
    monthlyMaintenance: calculateMonthlyMaintenance(
      input.size_sqft,
      input.maintenance_fee_per_sqft,
    ),
    estimatedMonthlyInstalment: calculateInstalment(loanAmount, assumptions),
    loanAmount,
    estimatedRental,
    estimatedGrossRentalYieldPercent: calculateGrossYield(finalNetPrice, estimatedRental),
  };
}
