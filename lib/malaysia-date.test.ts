import assert from "node:assert/strict";
import test from "node:test";
import {
  getMalaysiaLastMonthRange,
  getMalaysiaLastYearRange,
} from "./malaysia-date";

test("last month is the previous complete calendar month", () => {
  assert.deepEqual(getMalaysiaLastMonthRange(new Date("2026-10-07T12:00:00+08:00")), {
    from: "2026-09-01",
    to: "2026-09-30",
  });
});

test("last month crosses the year boundary", () => {
  assert.deepEqual(getMalaysiaLastMonthRange(new Date("2026-01-15T12:00:00+08:00")), {
    from: "2025-12-01",
    to: "2025-12-31",
  });
});

test("last year is the previous complete calendar year", () => {
  assert.deepEqual(getMalaysiaLastYearRange(new Date("2026-10-07T12:00:00+08:00")), {
    from: "2025-01-01",
    to: "2025-12-31",
  });
});
