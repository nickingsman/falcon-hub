export type ScheduleHStageCategory =
  | "signing"
  | "construction"
  | "vp"
  | "strata"
  | "stakeholder";

export type ScheduleHStageId =
  | "spa"
  | "2a"
  | "2b"
  | "2c"
  | "2d"
  | "2e"
  | "2f"
  | "2g"
  | "2h"
  | "vp"
  | "strata"
  | "stakeholder";

export type ProgressiveInterestCalculationStatus =
  | "buyer_equity_stage"
  | "system_estimate"
  | "manual_override"
  | "manual_release_required"
  | "not_progressive_interest_stage"
  | "invalid_input";

export type ScheduleHStageDefinition = {
  id: ScheduleHStageId;
  code: string;
  percentage: number;
  englishTitle: string;
  chineseTitle: string;
  englishShortDescription: string;
  chineseShortDescription: string;
  category: ScheduleHStageCategory;
};

export type ProgressiveInterestInput = {
  spaPrice: number;
  loanMarginPercent: number;
  annualInterestRatePercent: number;
  bankReleaseOverridesByStageId?: Partial<Record<ScheduleHStageId, number>>;
};

export type ProgressiveInterestStageResult = {
  stage: ScheduleHStageDefinition;
  stagePercentage: number;
  stageAmount: number;
  cumulativeSchedulePercentage: number;
  estimatedBankReleaseForStage: number | null;
  cumulativeEstimatedBankDisbursement: number | null;
  estimatedMonthlyProgressiveInterest: number | null;
  calculationStatus: ProgressiveInterestCalculationStatus;
  assumption: string;
};

export type ProgressiveInterestResult = {
  spaPrice: number;
  loanMarginPercent: number;
  annualInterestRatePercent: number;
  loanAmount: number;
  buyerEquity: number;
  isValid: boolean;
  validationErrors: string[];
  stages: ProgressiveInterestStageResult[];
};

export const scheduleHStages = [
  {
    id: "spa",
    code: "SPA",
    percentage: 10,
    englishTitle: "Signing of Sale & Purchase Agreement",
    chineseTitle: "签署买卖合约",
    englishShortDescription: "Initial signing stage of the sale and purchase agreement.",
    chineseShortDescription: "买卖合约的初始签署阶段。",
    category: "signing",
  },
  {
    id: "2a",
    code: "2(a)",
    percentage: 10,
    englishTitle: "Foundation & Below Ground Works",
    chineseTitle: "地基及地下基础工程",
    englishShortDescription: "Below-ground and foundation works of the building.",
    chineseShortDescription: "大楼的地下基础及地基工程。",
    category: "construction",
  },
  {
    id: "2b",
    code: "2(b)",
    percentage: 15,
    englishTitle: "Structural Framework",
    chineseTitle: "主体结构工程",
    englishShortDescription:
      "Main structural framework including relevant columns, beams and floor slabs.",
    chineseShortDescription: "大楼主要主体结构，包括相关柱、梁及楼板工程。",
    category: "construction",
  },
  {
    id: "2c",
    code: "2(c)",
    percentage: 10,
    englishTitle: "Walls, Door & Window Frames",
    chineseTitle: "墙体及门窗框工程",
    englishShortDescription:
      "Walls of the parcel with relevant door and window frames placed in position.",
    chineseShortDescription: "单位墙体以及相关门框和窗框安装至规定阶段。",
    category: "construction",
  },
  {
    id: "2d",
    code: "2(d)",
    percentage: 10,
    englishTitle: "Roofing, Electrical, Plumbing & Services",
    chineseTitle: "屋顶、水电及管线工程",
    englishShortDescription:
      "Roofing or ceiling, electrical wiring, plumbing without fittings and relevant internal services.",
    chineseShortDescription:
      "屋顶或天花、电线、水管（不包括洁具配件）及相关内部管线工程。",
    category: "construction",
  },
  {
    id: "2e",
    code: "2(e)",
    percentage: 10,
    englishTitle: "Internal & External Finishes",
    chineseTitle: "室内外饰面工程",
    englishShortDescription:
      "Internal and external finishes of the parcel have reached the required stage.",
    chineseShortDescription: "单位的室内及外部饰面工程达到规定施工阶段。",
    category: "construction",
  },
  {
    id: "2f",
    code: "2(f)",
    percentage: 5,
    englishTitle: "Sewerage Works",
    chineseTitle: "排污系统工程",
    englishShortDescription: "Sewerage works serving the building.",
    chineseShortDescription: "为大楼提供服务的排污系统工程。",
    category: "construction",
  },
  {
    id: "2g",
    code: "2(g)",
    percentage: 2.5,
    englishTitle: "Drainage Works",
    chineseTitle: "排水系统工程",
    englishShortDescription: "Drainage works serving the building.",
    chineseShortDescription: "为大楼提供服务的排水系统工程。",
    category: "construction",
  },
  {
    id: "2h",
    code: "2(h)",
    percentage: 2.5,
    englishTitle: "Road Works",
    chineseTitle: "道路工程",
    englishShortDescription: "Road works serving the building.",
    chineseShortDescription: "为大楼提供服务的道路工程。",
    category: "construction",
  },
  {
    id: "vp",
    code: "VP",
    percentage: 17.5,
    englishTitle: "Vacant Possession",
    chineseTitle: "正式交屋",
    englishShortDescription:
      "Vacant possession of the parcel with water and electricity supply ready for connection.",
    chineseShortDescription: "单位正式交屋，并具备水电供应连接条件。",
    category: "vp",
  },
  {
    id: "strata",
    code: "STRATA",
    percentage: 2.5,
    englishTitle: "Strata Title & Transfer",
    chineseTitle: "分层地契与转让",
    englishShortDescription: "Strata title and transfer documentation stage.",
    chineseShortDescription: "分层地契及转让文件阶段。",
    category: "strata",
  },
  {
    id: "stakeholder",
    code: "STAKEHOLDER",
    percentage: 5,
    englishTitle: "Stakeholder Retention",
    chineseTitle: "缺陷责任期保留款",
    englishShortDescription:
      "Retention amount released as 2.5% after 8 months from VP and 2.5% after 24 months from VP.",
    chineseShortDescription:
      "保留款分两阶段发放：交屋后8个月2.5%，交屋后24个月2.5%。",
    category: "stakeholder",
  },
] as const satisfies readonly ScheduleHStageDefinition[];

const constructionStageIds = new Set<ScheduleHStageId>([
  "2a",
  "2b",
  "2c",
  "2d",
  "2e",
  "2f",
  "2g",
  "2h",
]);

function normalizeMoney(value: number) {
  if (!Number.isFinite(value)) return 0;

  return Math.max(value, 0);
}

function isStandardNinetyPercentLoan(loanMarginPercent: number) {
  return Math.abs(loanMarginPercent - 90) < 0.000001;
}

function getValidationErrors(input: ProgressiveInterestInput) {
  const validationErrors: string[] = [];

  if (!Number.isFinite(input.spaPrice) || input.spaPrice <= 0) {
    validationErrors.push("SPA Price must be greater than 0.");
  }

  if (
    !Number.isFinite(input.loanMarginPercent) ||
    input.loanMarginPercent <= 0 ||
    input.loanMarginPercent > 100
  ) {
    validationErrors.push("Loan margin must be greater than 0 and no more than 100.");
  }

  if (!Number.isFinite(input.annualInterestRatePercent) || input.annualInterestRatePercent < 0) {
    validationErrors.push("Annual interest rate must be 0 or greater.");
  }

  for (const [stageId, override] of Object.entries(input.bankReleaseOverridesByStageId ?? {})) {
    if (!scheduleHStages.some((stage) => stage.id === stageId)) {
      validationErrors.push(`Unknown bank release override stage: ${stageId}.`);
      continue;
    }

    if (override !== undefined && (!Number.isFinite(override) || override < 0)) {
      validationErrors.push("Bank release overrides must be non-negative numbers.");
    }
  }

  return validationErrors;
}

function resolveStageBankRelease({
  input,
  stage,
  stageAmount,
  isValid,
}: {
  input: ProgressiveInterestInput;
  stage: ScheduleHStageDefinition;
  stageAmount: number;
  isValid: boolean;
}) {
  if (!isValid) {
    return {
      amount: null,
      status: "invalid_input",
      assumption: "Input values must be valid before estimating progressive interest.",
    } satisfies {
      amount: number | null;
      status: ProgressiveInterestCalculationStatus;
      assumption: string;
    };
  }

  const override = input.bankReleaseOverridesByStageId?.[stage.id];

  if (override !== undefined && Number.isFinite(override) && override >= 0) {
    return {
      amount: normalizeMoney(override),
      status: "manual_override",
      assumption: "Manual bank release override supplied for this stage.",
    } satisfies {
      amount: number | null;
      status: ProgressiveInterestCalculationStatus;
      assumption: string;
    };
  }

  if (stage.category === "signing") {
    return {
      amount: 0,
      status: "buyer_equity_stage",
      assumption: "SPA signing 10% is treated as buyer initial payment with no progressive interest.",
    } satisfies {
      amount: number | null;
      status: ProgressiveInterestCalculationStatus;
      assumption: string;
    };
  }

  if (stage.category === "construction") {
    if (isStandardNinetyPercentLoan(input.loanMarginPercent)) {
      return {
        amount: stageAmount,
        status: "system_estimate",
        assumption:
          "System estimate for the locked V1 90% loan reference schedule, excluding the SPA signing 10%.",
      } satisfies {
        amount: number | null;
        status: ProgressiveInterestCalculationStatus;
        assumption: string;
      };
    }

    return {
      amount: null,
      status: "manual_release_required",
      assumption:
        "Non-90% loan margins require manual bank release confirmation to avoid false precision.",
    } satisfies {
      amount: number | null;
      status: ProgressiveInterestCalculationStatus;
      assumption: string;
    };
  }

  return {
    amount: null,
    status: "not_progressive_interest_stage",
    assumption: "This Schedule H stage is shown for payment-stage context only.",
  } satisfies {
    amount: number | null;
    status: ProgressiveInterestCalculationStatus;
    assumption: string;
  };
}

export function getScheduleHPercentageTotal() {
  return scheduleHStages.reduce((sum, stage) => sum + stage.percentage, 0);
}

export function calculateProgressiveInterest(
  input: ProgressiveInterestInput,
): ProgressiveInterestResult {
  const validationErrors = getValidationErrors(input);
  const isValid = validationErrors.length === 0;
  const spaPrice = isValid ? input.spaPrice : normalizeMoney(input.spaPrice);
  const loanMarginPercent = Number.isFinite(input.loanMarginPercent)
    ? input.loanMarginPercent
    : 0;
  const annualInterestRatePercent = Number.isFinite(input.annualInterestRatePercent)
    ? input.annualInterestRatePercent
    : 0;
  const loanAmount = isValid ? spaPrice * (loanMarginPercent / 100) : 0;
  const buyerEquity = isValid ? Math.max(spaPrice - loanAmount, 0) : 0;
  let cumulativeSchedulePercentage = 0;
  let cumulativeBankDisbursement = 0;
  let cumulativeBankDisbursementIsKnown = true;

  const stages = scheduleHStages.map((stage) => {
    cumulativeSchedulePercentage += stage.percentage;
    const stageAmount = spaPrice * (stage.percentage / 100);
    const bankRelease = resolveStageBankRelease({
      input,
      stage,
      stageAmount,
      isValid,
    });

    if (bankRelease.amount === null) {
      if (constructionStageIds.has(stage.id)) {
        cumulativeBankDisbursementIsKnown = false;
      }

      return {
        stage,
        stagePercentage: stage.percentage,
        stageAmount,
        cumulativeSchedulePercentage,
        estimatedBankReleaseForStage: null,
        cumulativeEstimatedBankDisbursement: null,
        estimatedMonthlyProgressiveInterest: null,
        calculationStatus: bankRelease.status,
        assumption: bankRelease.assumption,
      } satisfies ProgressiveInterestStageResult;
    }

    cumulativeBankDisbursement += bankRelease.amount;
    const cappedCumulativeBankDisbursement = Math.min(cumulativeBankDisbursement, loanAmount);
    const cumulativeEstimatedBankDisbursement = cumulativeBankDisbursementIsKnown
      ? cappedCumulativeBankDisbursement
      : null;
    const estimatedMonthlyProgressiveInterest =
      cumulativeEstimatedBankDisbursement === null || stage.category !== "construction"
        ? null
        : cumulativeEstimatedBankDisbursement * (annualInterestRatePercent / 100) / 12;

    return {
      stage,
      stagePercentage: stage.percentage,
      stageAmount,
      cumulativeSchedulePercentage,
      estimatedBankReleaseForStage: bankRelease.amount,
      cumulativeEstimatedBankDisbursement,
      estimatedMonthlyProgressiveInterest,
      calculationStatus: bankRelease.status,
      assumption: bankRelease.assumption,
    } satisfies ProgressiveInterestStageResult;
  });

  return {
    spaPrice,
    loanMarginPercent,
    annualInterestRatePercent,
    loanAmount,
    buyerEquity,
    isValid,
    validationErrors,
    stages,
  };
}
