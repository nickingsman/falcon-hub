export type SalesSearchRecord = {
  projectName: string;
  unitNo: string;
};

type SearchTimer = ReturnType<typeof setTimeout>;

type SalesSearchSchedulerOptions = {
  delayMs?: number;
  schedule?: (callback: () => void, delayMs: number) => SearchTimer;
  cancel?: (timer: SearchTimer) => void;
};

export function normalizeSalesSearch(value: string) {
  return value.trim().toLocaleLowerCase("en-MY");
}

export function rankSalesSearchMatches<T extends SalesSearchRecord>(records: T[], value: string) {
  const search = normalizeSalesSearch(value);
  if (!search) return records;

  return records
    .map((record, index) => {
      const unitNo = normalizeSalesSearch(record.unitNo);
      const projectName = normalizeSalesSearch(record.projectName);
      const rank = unitNo === search
        ? 0
        : unitNo.startsWith(search)
          ? 1
          : unitNo.includes(search)
            ? 2
            : projectName.includes(search)
              ? 3
              : null;

      return { record, index, rank };
    })
    .filter((item): item is { record: T; index: number; rank: number } => item.rank !== null)
    .sort((left, right) => left.rank - right.rank || left.index - right.index)
    .map((item) => item.record);
}

export function createSalesSearchScheduler(
  commit: (value: string) => void,
  options: SalesSearchSchedulerOptions = {},
) {
  const delayMs = options.delayMs ?? 300;
  const schedule = options.schedule ?? ((callback, delay) => setTimeout(callback, delay));
  const cancel = options.cancel ?? ((timer) => clearTimeout(timer));
  let pendingTimer: SearchTimer | null = null;

  function cancelPending() {
    if (pendingTimer === null) return;
    cancel(pendingTimer);
    pendingTimer = null;
  }

  function commitImmediately(value: string) {
    cancelPending();
    commit(normalizeSalesSearch(value));
  }

  return {
    schedule(value: string) {
      cancelPending();
      pendingTimer = schedule(() => {
        pendingTimer = null;
        commit(normalizeSalesSearch(value));
      }, delayMs);
    },
    submit(value: string) {
      commitImmediately(value);
    },
    clear() {
      commitImmediately("");
    },
    cancel: cancelPending,
  };
}

export function createLatestSalesRequestSequence() {
  let latestRequest = 0;

  return {
    begin() {
      latestRequest += 1;
      return latestRequest;
    },
    isLatest(request: number) {
      return request === latestRequest;
    },
  };
}

export function areSalesResultsCurrent({
  searchInput,
  submittedSearch,
  resolvedSearch,
  currentQuery,
  resolvedQuery,
  loading,
}: {
  searchInput: string;
  submittedSearch: string;
  resolvedSearch: string | null;
  currentQuery: string;
  resolvedQuery: string | null;
  loading: boolean;
}) {
  return !loading
    && normalizeSalesSearch(searchInput) === submittedSearch
    && submittedSearch === resolvedSearch
    && currentQuery === resolvedQuery;
}
