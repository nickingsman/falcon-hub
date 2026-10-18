import assert from "node:assert/strict";
import test from "node:test";
import {
  areSalesResultsCurrent,
  createLatestSalesRequestSequence,
  createSalesSearchScheduler,
  rankSalesSearchMatches,
} from "./sales-search";

const records = [
  { id: "prefix", unitNo: "B-27-160", projectName: "Arra Residence" },
  { id: "project", unitNo: "A-01-01", projectName: "B-27-16 Residences" },
  { id: "substring", unitNo: "X-B-27-16-A", projectName: "Other Project" },
  { id: "exact", unitNo: "B-27-16", projectName: "Arra Residence" },
  { id: "unrelated", unitNo: "B-27-20", projectName: "Arra Residence" },
];

test("exact Unit No matches are prioritized before prefix, substring, and project matches", () => {
  assert.deepEqual(
    rankSalesSearchMatches(records, " B-27-16 ").map((record) => record.id),
    ["exact", "prefix", "substring", "project"],
  );
});

test("a full Unit No search excludes unrelated units", () => {
  assert.equal(
    rankSalesSearchMatches(records, "b-27-16").some((record) => record.id === "unrelated"),
    false,
  );
});

test("rapid typing commits only the latest debounced search", () => {
  const callbacks = new Map<number, () => void>();
  const cancelled = new Set<number>();
  const commits: string[] = [];
  let nextTimer = 0;
  const scheduler = createSalesSearchScheduler((value) => commits.push(value), {
    schedule(callback) {
      nextTimer += 1;
      callbacks.set(nextTimer, callback);
      return nextTimer as unknown as ReturnType<typeof setTimeout>;
    },
    cancel(timer) {
      cancelled.add(timer as unknown as number);
    },
  });

  scheduler.schedule("B-2");
  scheduler.schedule("B-27");
  scheduler.schedule("B-27-16");
  for (const [timer, callback] of callbacks) {
    if (!cancelled.has(timer)) callback();
  }

  assert.deepEqual(commits, ["b-27-16"]);
});

test("Enter submission is immediate and cancels the pending debounce", () => {
  let pending: (() => void) | null = null;
  let cancelled = false;
  const commits: string[] = [];
  const scheduler = createSalesSearchScheduler((value) => commits.push(value), {
    schedule(callback) {
      pending = callback;
      return 1 as unknown as ReturnType<typeof setTimeout>;
    },
    cancel() {
      cancelled = true;
    },
  });

  scheduler.schedule("B-27");
  scheduler.submit("B-27-16");
  if (!cancelled) (pending as (() => void) | null)?.();

  assert.deepEqual(commits, ["b-27-16"]);
});

test("clearing search is immediate, cancels pending typing, and restores all records", () => {
  let pending: (() => void) | null = null;
  let cancelled = false;
  const commits: string[] = [];
  const scheduler = createSalesSearchScheduler((value) => commits.push(value), {
    schedule(callback) {
      pending = callback;
      return 1 as unknown as ReturnType<typeof setTimeout>;
    },
    cancel() {
      cancelled = true;
    },
  });

  scheduler.schedule("B-27");
  scheduler.clear();
  if (!cancelled) (pending as (() => void) | null)?.();

  assert.deepEqual(commits, [""]);
  assert.equal(rankSalesSearchMatches(records, "").length, records.length);
});

test("stale responses cannot be treated as the latest request", () => {
  const sequence = createLatestSalesRequestSequence();
  const broadSearch = sequence.begin();
  const exactSearch = sequence.begin();

  assert.equal(sequence.isLatest(broadSearch), false);
  assert.equal(sequence.isLatest(exactSearch), true);
});

test("old results stay hidden after a debounced search commits but before its request starts", () => {
  const resolvedQuery = "period=this_month&search=arra";

  assert.equal(areSalesResultsCurrent({
    searchInput: "arra",
    submittedSearch: "arra",
    resolvedSearch: "arra",
    currentQuery: resolvedQuery,
    resolvedQuery,
    loading: false,
  }), true);

  assert.equal(areSalesResultsCurrent({
    searchInput: "B-27-16",
    submittedSearch: "b-27-16",
    resolvedSearch: "arra",
    currentQuery: "period=this_month&search=b-27-16",
    resolvedQuery,
    loading: false,
  }), false);
});

test("results stay hidden when another submitted filter no longer matches the accepted query", () => {
  assert.equal(areSalesResultsCurrent({
    searchInput: "",
    submittedSearch: "",
    resolvedSearch: "",
    currentQuery: "period=this_month&status=sign_spa",
    resolvedQuery: "period=this_month",
    loading: false,
  }), false);
});
