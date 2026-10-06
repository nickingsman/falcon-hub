import assert from "node:assert/strict";
import test from "node:test";

import {
  NEW_LINE_DEFINITIONS,
  TRADITIONAL_LINE_DEFINITIONS,
  buildSacredTriangle,
  buildSymbolCells,
  calculateCareerNumerology,
  calculatePersonalYear,
  calculateRelationship,
  calculateRelationshipNumber,
  calculateZodiac,
  detectLines,
  getLifeStageId,
} from "./engine";
import type { NumerologyCell, NumerologyNumber } from "./types";

function requireCanonical(currentDate = "2026-04-19") {
  const result = calculateCareerNumerology({ dateOfBirth: "1999-04-19", currentDate });
  assert.ok(result);
  return result;
}

function cellsWithPresence(numbers: NumerologyNumber[]): NumerologyCell[] {
  return Array.from({ length: 9 }, (_, index) => {
    const number = (index + 1) as NumerologyNumber;
    const present = numbers.includes(number);
    return {
      number,
      symbols: { birth: present ? 1 : 0, talent: 0, life: 0, zodiac: 0 },
      totalEnergy: present ? 1 : 0,
      present,
    };
  });
}

test("canonical DOB preserves the cumulative 4U reduction chains", () => {
  const result = requireCanonical();

  assert.deepEqual(result.year, { total: 28, chain: [28, 10, 1], final: 1 });
  assert.deepEqual(result.month, { total: 32, chain: [32, 5], final: 5 });
  assert.deepEqual(result.day, { total: 42, chain: [42, 6], final: 6 });
  assert.equal(result.talentNumber, 42);
  assert.equal(result.lifeNumber, 6);
  assert.equal(result.combination, "42/6");
  assert.deepEqual(result.layers, { externalAbility: 4, internalThought: 2, lifeCharacter: 6 });
});

test("life stages use day, month, year and permanently return to the first stage at 73+", () => {
  const result = requireCanonical();
  assert.deepEqual(
    result.stages.map(({ ageRange, combination, supported, returnToFirstStage }) => ({ ageRange, combination, supported, returnToFirstStage })),
    [
      { ageRange: "0–18", combination: null, supported: false, returnToFirstStage: false },
      { ageRange: "19–36", combination: "42/6", supported: true, returnToFirstStage: false },
      { ageRange: "37–54", combination: "32/5", supported: true, returnToFirstStage: false },
      { ageRange: "55–72", combination: "28/10/1", supported: true, returnToFirstStage: false },
      { ageRange: "73+", combination: "42/6", supported: true, returnToFirstStage: true },
    ],
  );

  const expected = new Map([[18, "under-19"], [19, "19-36"], [36, "19-36"], [37, "37-54"], [54, "37-54"], [55, "55-72"], [72, "55-72"], [73, "73-plus"], [90, "73-plus"]]);
  for (const [age, stage] of expected) assert.equal(getLifeStageId(age), stage);
});

test("stage table preserves year, month, day order and full chains", () => {
  const result = requireCanonical();
  assert.deepEqual(result.stageTable, [
    { unit: "年", birthValue: "1999", stageChain: "28/10/1", ageRange: "55–72", stageId: "55-72" },
    { unit: "月", birthValue: "04", stageChain: "32/5", ageRange: "37–54", stageId: "37-54" },
    { unit: "日", birthValue: "19", stageChain: "42/6", ageRange: "19–36", stageId: "19-36" },
  ]);
  assert.equal(result.stages.find((stage) => stage.id === "73-plus")?.combination, "42/6");
});

test("canonical symbols preserve source and repeated DOB digit counts", () => {
  const cells = buildSymbolCells("1999-04-19", 42, 6, 1);
  const cell = (number: number) => cells.find((item) => item.number === number);

  assert.deepEqual(cell(1)?.symbols, { birth: 2, talent: 0, life: 0, zodiac: 1 });
  assert.deepEqual(cell(2)?.symbols, { birth: 0, talent: 1, life: 0, zodiac: 0 });
  assert.deepEqual(cell(4)?.symbols, { birth: 1, talent: 1, life: 0, zodiac: 0 });
  assert.deepEqual(cell(6)?.symbols, { birth: 0, talent: 0, life: 1, zodiac: 0 });
  assert.deepEqual(cell(9)?.symbols, { birth: 4, talent: 0, life: 0, zodiac: 0 });
  assert.equal(cells.length, 9);
  assert.equal(cell(1)?.totalEnergy, 3);
});

test("any mixed symbol source makes a number present and missing requires no symbols", () => {
  const cells = buildSymbolCells("2000-01-01", 23, 4, 5);
  assert.equal(cells.find((cell) => cell.number === 1)?.present, true);
  assert.equal(cells.find((cell) => cell.number === 2)?.present, true);
  assert.equal(cells.find((cell) => cell.number === 4)?.present, true);
  assert.equal(cells.find((cell) => cell.number === 5)?.present, true);
  assert.equal(cells.find((cell) => cell.number === 9)?.present, false);
});

test("traditional lines include three-number and canonical two-number lines", () => {
  const lines = detectLines(cellsWithPresence([1, 2, 3, 4, 5, 6, 8, 9]), TRADITIONAL_LINE_DEFINITIONS).map((line) => line.id);
  for (const id of ["123", "159", "24", "26", "48", "68"]) assert.ok(lines.includes(id));
});

test("traditional grid exposes exactly its 12 official line keys", () => {
  const lines = detectLines(cellsWithPresence([1, 2, 3, 4, 5, 6, 7, 8, 9]), TRADITIONAL_LINE_DEFINITIONS).map((line) => line.id);
  assert.deepEqual(lines, ["123", "456", "789", "147", "258", "369", "159", "357", "24", "26", "48", "68"]);
});

test("new grid detects its official three-number and two-number lines", () => {
  const lines = detectLines(cellsWithPresence([1, 2, 3, 5, 6, 7, 8]), NEW_LINE_DEFINITIONS).map((line) => line.id);
  for (const id of ["816", "357", "852"]) assert.ok(lines.includes(id));
  for (const id of ["13", "17"]) assert.ok(lines.includes(id));
});

test("new grid exposes exactly its 12 official line keys", () => {
  const lines = detectLines(cellsWithPresence([1, 2, 3, 4, 5, 6, 7, 8, 9]), NEW_LINE_DEFINITIONS).map((line) => line.id);
  assert.deepEqual(lines, ["816", "357", "492", "834", "159", "672", "852", "654", "13", "17", "39", "79"]);
});

test("personal year changes on the birthday", () => {
  const before = calculatePersonalYear("1999-04-19", "2026-04-18");
  const birthday = calculatePersonalYear("1999-04-19", "2026-04-19");
  const after = calculatePersonalYear("1999-04-19", "2026-04-20");

  assert.equal(before?.applicableYear, 2025);
  assert.equal(before?.number, 5);
  assert.equal(birthday?.applicableYear, 2026);
  assert.equal(birthday?.total, 24);
  assert.deepEqual(birthday?.chain, [24, 6]);
  assert.deepEqual(birthday?.calculationSteps, [
    { digits: [2, 0, 2, 6, 0, 4, 1, 9], total: 24 },
    { digits: [2, 4], total: 6 },
  ]);
  assert.equal(after?.applicableYear, 2026);
  assert.equal(after?.number, 6);
});

test("sacred triangle advances cyclically from the personal year", () => {
  assert.deepEqual(buildSacredTriangle(6), [
    { position: "主运", value: 6 }, { position: "家族", value: 7 }, { position: "朋友", value: 8 },
    { position: "事业", value: 9 }, { position: "转机", value: 1 }, { position: "感情", value: 2 },
    { position: "危机", value: 3 }, { position: "钱财", value: 4 }, { position: "信念", value: 5 },
  ]);
});

test("sacred triangle annual positions remain separate from the permanent life-number center", () => {
  const canonical = requireCanonical();
  assert.equal(canonical.lifeNumber, 6);
  assert.equal(canonical.sacredTriangle.find((item) => item.position === "转机")?.value, 1);

  const laterYear = calculateCareerNumerology({ dateOfBirth: "1999-04-19", currentDate: "2027-04-19" });
  assert.ok(laterYear);
  assert.equal(laterYear.personalYear.number, 7);
  assert.equal(laterYear.sacredTriangle[0]?.value, 7);
  assert.equal(laterYear.lifeNumber, 6);
});

test("relationship combination preserves 10, 11 and 12 and is symmetric", () => {
  const cases = [[5, 5, 10], [5, 6, 11], [6, 6, 12], [6, 7, 4], [6, 9, 6], [9, 9, 9]] as const;
  for (const [first, second, expected] of cases) {
    assert.equal(calculateRelationshipNumber(first, second), expected);
    assert.equal(calculateRelationshipNumber(second, first), expected);
  }
});

test("relationship calculation exposes raw sums and reduction digits", () => {
  assert.deepEqual(calculateRelationship(6, 9), { first: 6, second: 9, rawSum: 15, reductionDigits: [1, 5], result: 6 });
  assert.deepEqual(calculateRelationship(5, 5), { first: 5, second: 5, rawSum: 10, reductionDigits: null, result: 10 });
  assert.deepEqual(calculateRelationship(5, 6), { first: 5, second: 6, rawSum: 11, reductionDigits: null, result: 11 });
  assert.deepEqual(calculateRelationship(6, 6), { first: 6, second: 6, rawSum: 12, reductionDigits: null, result: 12 });
  assert.deepEqual(calculateRelationship(6, 7), { first: 6, second: 7, rawSum: 13, reductionDigits: [1, 3], result: 4 });
});

test("relationship results are limited to the verified 2–12 domain", () => {
  const results = new Set<number>();
  for (let first = 1; first <= 9; first += 1) {
    for (let second = 1; second <= 9; second += 1) {
      results.add(calculateRelationship(first as NumerologyNumber, second as NumerologyNumber).result);
    }
  }
  assert.deepEqual([...results].sort((left, right) => left - right), [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  assert.equal(results.has(1), false);
});

test("canonical DOB resolves 牧羊座 and adds zodiac number 1", () => {
  const result = requireCanonical();
  assert.deepEqual(result.zodiac, { sign: "aries", name: "牧羊座", number: 1 });
  assert.equal(result.zodiacNumber, 1);
  assert.equal(result.cells.find((cell) => cell.number === 1)?.symbols.zodiac, 1);
});

test("all western zodiac signs and transition boundaries use canonical 4U numbers", () => {
  const cases = [
    ["2000-01-19", "摩羯座", 1], ["2000-01-20", "水瓶座", 2],
    ["2000-02-18", "水瓶座", 2], ["2000-02-19", "双鱼座", 3],
    ["2000-03-20", "双鱼座", 3], ["2000-03-21", "牧羊座", 1],
    ["2000-04-19", "牧羊座", 1], ["2000-04-20", "金牛座", 2],
    ["2000-05-20", "金牛座", 2], ["2000-05-21", "双子座", 3],
    ["2000-06-20", "双子座", 3], ["2000-06-21", "巨蟹座", 4],
    ["2000-07-22", "巨蟹座", 4], ["2000-07-23", "狮子座", 5],
    ["2000-08-22", "狮子座", 5], ["2000-08-23", "处女座", 6],
    ["2000-09-22", "处女座", 6], ["2000-09-23", "天秤座", 7],
    ["2000-10-22", "天秤座", 7], ["2000-10-23", "天蝎座", 8],
    ["2000-11-21", "天蝎座", 8], ["2000-11-22", "射手座", 9],
    ["2000-12-21", "射手座", 9], ["2000-12-22", "摩羯座", 1],
  ] as const;

  for (const [date, name, number] of cases) {
    const zodiac = calculateZodiac(date);
    assert.ok(zodiac);
    assert.equal(zodiac.name, name);
    assert.equal(zodiac.number, number);
  }
});
