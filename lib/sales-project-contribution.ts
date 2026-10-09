export type ProjectContributionSalesStatus = "booking" | "submitted" | "loan_approved" | "sign_spa" | "cancelled";

export type ProjectContributionStatusFilter = "all" | "converted" | ProjectContributionSalesStatus;

export type ProjectContributionCase = {
  id: string;
  projectKey: string;
  projectName: string;
  unitNo: string;
  bookingDate: string;
  nettPrice: number;
  falconPortion: number;
  status: ProjectContributionSalesStatus;
  allocationStatus: "verified" | "pending";
  contributors: Array<{
    memberId: string | null;
    sourceMemberName: string | null;
    memberName: string;
    portion: number | null;
  }>;
};

export type PendingProjectContribution = {
  salesCaseId: string;
  bookingDate: string;
  projectName: string;
  unitNo: string;
  status: ProjectContributionSalesStatus;
  falconPortion: number;
  falconCreditedGdv: number;
  sourceContributorNames: string[];
};

export type ProjectContributionDetail = {
  salesCaseId: string;
  bookingDate: string;
  projectName: string;
  unitNo: string;
  status: ProjectContributionSalesStatus;
  memberKey: string;
  memberName: string;
  contributorPercentage: number;
  portion: number;
  creditedGdv: number;
};

export type ProjectContributionRow = {
  rank: number;
  memberKey: string;
  memberName: string;
  salesCases: number;
  totalPortion: number;
  creditedGdv: number;
  details: ProjectContributionDetail[];
};

export type ProjectContributionReport = {
  projectKey: string;
  projectName: string;
  from: string;
  to: string;
  statusFilter: ProjectContributionStatusFilter;
  summary: {
    totalSalesCases: number;
    totalContributors: number;
    totalPortion: number;
    totalCreditedGdv: number;
    pendingAllocationCases: number;
    pendingFalconCreditedGdv: number;
  };
  rows: ProjectContributionRow[];
  details: ProjectContributionDetail[];
  pendingAllocations: PendingProjectContribution[];
};

export function normalizeHistoricalIdentity(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-MY");
}

export function getProjectContributionProjectKey(projectId: string | null, sourceProjectName: string | null) {
  if (projectId) return `project:${projectId}`;
  const normalized = sourceProjectName ? normalizeHistoricalIdentity(sourceProjectName) : "";
  return normalized ? `historical:${normalized}` : "historical:unknown";
}

export function getProjectContributionMemberKey(memberId: string | null, sourceMemberName: string | null) {
  if (memberId) return `member:${memberId}`;
  const normalized = sourceMemberName ? normalizeHistoricalIdentity(sourceMemberName) : "";
  return normalized ? `historical-member:${normalized}` : "historical-member:unknown";
}

function matchesStatus(status: ProjectContributionSalesStatus, filter: ProjectContributionStatusFilter) {
  if (filter === "all") return true;
  if (filter === "converted") return status === "sign_spa";
  return status === filter;
}

export function calculateProjectContributionReport(
  cases: ProjectContributionCase[],
  input: {
    projectKey: string;
    projectName: string;
    from: string;
    to: string;
    statusFilter: ProjectContributionStatusFilter;
  },
): ProjectContributionReport {
  const filteredCases = [...new Map(
    cases
      .filter(
        (salesCase) =>
          salesCase.projectKey === input.projectKey &&
          salesCase.bookingDate >= input.from &&
          salesCase.bookingDate <= input.to &&
          matchesStatus(salesCase.status, input.statusFilter),
      )
      .map((salesCase) => [salesCase.id, salesCase]),
  ).values()];
  const memberMap = new Map<string, Omit<ProjectContributionRow, "rank"> & { caseIds: Set<string> }>();
  const details: ProjectContributionDetail[] = [];
  const pendingAllocations: PendingProjectContribution[] = [];

  for (const salesCase of filteredCases) {
    if (salesCase.allocationStatus === "pending") {
      pendingAllocations.push({
        salesCaseId: salesCase.id,
        bookingDate: salesCase.bookingDate,
        projectName: salesCase.projectName,
        unitNo: salesCase.unitNo,
        status: salesCase.status,
        falconPortion: salesCase.falconPortion,
        falconCreditedGdv: salesCase.nettPrice * salesCase.falconPortion / 100,
        sourceContributorNames: salesCase.contributors.map((item) => item.sourceMemberName?.trim() || item.memberName).filter(Boolean),
      });
      continue;
    }
    for (const contributor of salesCase.contributors) {
      if (contributor.portion === null) continue;
      const memberKey = getProjectContributionMemberKey(contributor.memberId, contributor.sourceMemberName);
      const portion = contributor.portion / 100;
      const creditedGdv = salesCase.nettPrice * portion;
      const detail: ProjectContributionDetail = {
        salesCaseId: salesCase.id,
        bookingDate: salesCase.bookingDate,
        projectName: salesCase.projectName,
        unitNo: salesCase.unitNo,
        status: salesCase.status,
        memberKey,
        memberName: contributor.sourceMemberName?.trim() || contributor.memberName,
        contributorPercentage: contributor.portion,
        portion,
        creditedGdv,
      };
      details.push(detail);

      const current = memberMap.get(memberKey) ?? {
        memberKey,
        memberName: contributor.memberName,
        salesCases: 0,
        totalPortion: 0,
        creditedGdv: 0,
        details: [],
        caseIds: new Set<string>(),
      };
      current.caseIds.add(salesCase.id);
      current.salesCases = current.caseIds.size;
      current.totalPortion += portion;
      current.creditedGdv += creditedGdv;
      current.details.push(detail);
      memberMap.set(memberKey, current);
    }
  }

  const rows = [...memberMap.values()]
    .sort(
      (a, b) =>
        b.totalPortion - a.totalPortion ||
        b.creditedGdv - a.creditedGdv ||
        b.salesCases - a.salesCases ||
        a.memberName.localeCompare(b.memberName, "en-MY") ||
        a.memberKey.localeCompare(b.memberKey),
    )
    .map((row, index) => ({
      rank: index + 1,
      memberKey: row.memberKey,
      memberName: row.memberName,
      salesCases: row.salesCases,
      totalPortion: row.totalPortion,
      creditedGdv: row.creditedGdv,
      details: row.details.sort(
        (a, b) => b.bookingDate.localeCompare(a.bookingDate) || a.salesCaseId.localeCompare(b.salesCaseId),
      ),
    }));

  return {
    projectKey: input.projectKey,
    projectName: input.projectName,
    from: input.from,
    to: input.to,
    statusFilter: input.statusFilter,
    summary: {
      totalSalesCases: new Set(filteredCases.map((salesCase) => salesCase.id)).size,
      totalContributors: rows.length,
      totalPortion: rows.reduce((sum, row) => sum + row.totalPortion, 0),
      totalCreditedGdv: rows.reduce((sum, row) => sum + row.creditedGdv, 0),
      pendingAllocationCases: pendingAllocations.length,
      pendingFalconCreditedGdv: pendingAllocations.reduce((sum, row) => sum + row.falconCreditedGdv, 0),
    },
    rows,
    details: details.sort(
      (a, b) =>
        b.bookingDate.localeCompare(a.bookingDate) ||
        a.memberName.localeCompare(b.memberName, "en-MY") ||
        a.salesCaseId.localeCompare(b.salesCaseId),
    ),
    pendingAllocations: pendingAllocations.sort((a, b) => b.bookingDate.localeCompare(a.bookingDate) || a.salesCaseId.localeCompare(b.salesCaseId)),
  };
}

export function buildProjectContributionExportRows(report: ProjectContributionReport) {
  return {
    summary: report.rows.map((row) => ({
      Project: report.projectName,
      "Date Range": `${report.from} to ${report.to}`,
      "Status Filter": report.statusFilter,
      Rank: row.rank,
      Member: row.memberName,
      "Sales Cases": row.salesCases,
      "Total Portion": row.totalPortion,
      "Credited GDV": row.creditedGdv,
    })),
    details: report.details.map((detail) => ({
      "Booking Date": detail.bookingDate,
      Project: detail.projectName,
      Unit: detail.unitNo,
      Status: detail.status,
      Member: detail.memberName,
      "Contributor Percentage": detail.contributorPercentage,
      Portion: detail.portion,
      "Credited GDV": detail.creditedGdv,
    })),
    pending: report.pendingAllocations.map((item) => ({
      "Booking Date": item.bookingDate,
      Project: item.projectName,
      Unit: item.unitNo,
      Status: item.status,
      "Falcon Portion": item.falconPortion,
      "Falcon Credited GDV": item.falconCreditedGdv,
      "Source Contributor Names": item.sourceContributorNames.join(", "),
      Allocation: "Pending Allocation",
    })),
  };
}
