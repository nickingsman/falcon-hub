import {
  getMalaysiaLastWeekRange,
  getMalaysiaThisMonthRange,
  getMalaysiaThisWeekRange,
  getMalaysiaTodayDateString,
  isValidDateString,
} from "@/lib/malaysia-date";

export const salesStatuses = ["booking", "submitted", "loan_approved", "sign_spa", "cancelled"] as const;
export type SalesStatus = (typeof salesStatuses)[number];
export type SalesPeriod = "this_week" | "last_week" | "this_month" | "this_year" | "custom";

export const salesStatusLabels: Record<SalesStatus, string> = {
  booking: "Booking",
  submitted: "Submitted",
  loan_approved: "Loan Approved",
  sign_spa: "Sign SPA",
  cancelled: "Cancelled",
};

export function parseSalesPercentage(value: unknown) {
  const text = typeof value === "number" ? String(value) : typeof value === "string" ? value.trim() : "";
  const match = /^(\d+)(?:\.(\d{1,4}))?$/.exec(text);
  if (!match) return null;
  const whole = Number(match[1]);
  const fraction = Number((match[2] ?? "").padEnd(4, "0"));
  const scaled = whole * 10_000 + fraction;
  if (!Number.isSafeInteger(scaled) || scaled <= 0 || scaled > 1_000_000) return null;
  return { scaled, normalized: `${Math.floor(scaled / 10_000)}.${String(scaled % 10_000).padStart(4, "0")}` };
}

export function normalizeSalesUnit(value: string) {
  return value.trim().toLowerCase();
}

export type SalesContributor = {
  memberId: string;
  memberName: string;
  position: string | null;
  portion: number;
};

export type SalesCase = {
  id: string;
  projectId: string;
  projectName: string;
  unitNo: string;
  bookingDate: string;
  nettPrice: number;
  falconPortion: number;
  status: SalesStatus;
  spaSignedDate: string | null;
  cancelDate: string | null;
  remark: string | null;
  contributors: SalesContributor[];
  statusHistory?: Array<{ status: SalesStatus; effectiveDate: string | null; createdAt: string; eventType: "lifecycle" | "spa_correction"; note: string | null }>;
  unitHistory?: Array<{ previousUnitNo: string; newUnitNo: string; changedAt: string }>;
};

export type SalesTopCloser = {
  memberId: string;
  memberName: string;
  position: string | null;
  closingFigure: number;
  creditedGdv: number;
};

export function getSalesDateRange(period: string | null, from?: string | null, to?: string | null) {
  if (period === "last_week") return getMalaysiaLastWeekRange();
  if (period === "this_month") return getMalaysiaThisMonthRange();
  if (period === "this_year") {
    const today = getMalaysiaTodayDateString();
    return { from: `${today.slice(0, 4)}-01-01`, to: today };
  }
  if (period === "custom" && from && to && isValidDateString(from) && isValidDateString(to) && from <= to) {
    return { from, to };
  }
  return getMalaysiaThisWeekRange();
}

export function isLeaderboardExcluded(position: string | null) {
  const normalized = position?.trim().toLowerCase();
  return normalized === "project manager" || normalized === "managing partner";
}

export function calculateSalesTopClosers(
  cases: Array<Pick<SalesCase, "nettPrice" | "contributors">>,
) {
  const memberMap = new Map<string, SalesTopCloser>();

  for (const salesCase of cases) {
    for (const contributor of salesCase.contributors) {
      const current = memberMap.get(contributor.memberId) ?? {
        memberId: contributor.memberId,
        memberName: contributor.memberName,
        position: contributor.position,
        closingFigure: 0,
        creditedGdv: 0,
      };
      current.closingFigure += contributor.portion / 100;
      current.creditedGdv += salesCase.nettPrice * contributor.portion / 100;
      memberMap.set(contributor.memberId, current);
    }
  }

  return [...memberMap.values()].sort(
    (a, b) =>
      b.closingFigure - a.closingFigure ||
      b.creditedGdv - a.creditedGdv ||
      a.memberName.localeCompare(b.memberName) ||
      a.memberId.localeCompare(b.memberId),
  );
}

export function calculateSalesAnalytics(cases: SalesCase[], from: string, to: string) {
  const bookingCases = cases.filter((item) => item.bookingDate >= from && item.bookingDate <= to);
  const convertedCases = cases.filter(
    (item) => item.spaSignedDate && item.spaSignedDate >= from && item.spaSignedDate <= to,
  );
  const closingFigure = bookingCases.reduce((sum, item) => sum + item.falconPortion / 100, 0);
  const creditedGdv = bookingCases.reduce((sum, item) => sum + item.nettPrice * item.falconPortion / 100, 0);
  const convertFigure = convertedCases.reduce((sum, item) => sum + item.falconPortion / 100, 0);
  const convertedCreditedGdv = convertedCases.reduce((sum, item) => sum + item.nettPrice * item.falconPortion / 100, 0);
  const cancelledCases = bookingCases.filter((item) => item.status === "cancelled");

  const topClosers = calculateSalesTopClosers(bookingCases).filter(
    (item) => !isLeaderboardExcluded(item.position),
  );

  const projectMap = new Map<string, { projectId: string; projectName: string; closingFigure: number; creditedGdv: number; convertFigure: number }>();
  for (const salesCase of bookingCases) {
    const current = projectMap.get(salesCase.projectId) ?? { projectId: salesCase.projectId, projectName: salesCase.projectName, closingFigure: 0, creditedGdv: 0, convertFigure: 0 };
    current.closingFigure += salesCase.falconPortion / 100;
    current.creditedGdv += salesCase.nettPrice * salesCase.falconPortion / 100;
    projectMap.set(salesCase.projectId, current);
  }
  for (const salesCase of convertedCases) {
    const current = projectMap.get(salesCase.projectId) ?? { projectId: salesCase.projectId, projectName: salesCase.projectName, closingFigure: 0, creditedGdv: 0, convertFigure: 0 };
    current.convertFigure += salesCase.falconPortion / 100;
    projectMap.set(salesCase.projectId, current);
  }

  return {
    closingFigure, creditedGdv, convertFigure, convertedCreditedGdv,
    conversionRate: closingFigure > 0 ? convertFigure / closingFigure * 100 : 0,
    cancelledCount: cancelledCases.length,
    cancelledCreditedGdv: cancelledCases.reduce((sum, item) => sum + item.nettPrice * item.falconPortion / 100, 0),
    topClosers,
    projects: [...projectMap.values()].sort((a, b) => b.closingFigure - a.closingFigure),
  };
}
