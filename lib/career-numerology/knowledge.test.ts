import assert from "node:assert/strict";
import test from "node:test";

import {
  TYPE_45_KEYS,
  classicLineKnowledge,
  getMissingKnowledgeKeys,
  intermediateNumberKnowledge,
  lifeCodePersonalYearKnowledge,
  missingNumberKnowledge,
  newLineKnowledge,
  numberKnowledge,
  personalYearKnowledge,
  relationshipCombinationKnowledge,
  sacredTriangleKnowledge,
  specialTypeGroups,
  type45Knowledge,
} from "./knowledge";

test("all deterministic knowledge families have complete structural keys", () => {
  assert.deepEqual(Object.keys(numberKnowledge), ["1", "2", "3", "4", "5", "6", "7", "8", "9"]);
  assert.deepEqual(Object.keys(intermediateNumberKnowledge), ["10", "11", "12"]);
  assert.deepEqual(Object.keys(missingNumberKnowledge), ["1", "2", "3", "4", "5", "6", "7", "8", "9"]);
  assert.deepEqual(Object.keys(personalYearKnowledge), ["1", "2", "3", "4", "5", "6", "7", "8", "9"]);
  assert.deepEqual(Object.keys(relationshipCombinationKnowledge), ["2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"]);
  assert.equal(Object.keys(classicLineKnowledge).length, 12);
  assert.equal(Object.keys(newLineKnowledge).length, 12);
  assert.equal(Object.keys(sacredTriangleKnowledge).length, 9);
});

test("all 45 legal type keys exist", () => {
  assert.equal(TYPE_45_KEYS.length, 45);
  assert.equal(Object.keys(type45Knowledge).length, 45);
  for (const key of TYPE_45_KEYS) assert.equal(type45Knowledge[key].key, key);
});

test("intermediate numbers come from the actual chain", () => {
  assert.equal(type45Knowledge["28/10/1"].intermediateNumber, 10);
  assert.equal(type45Knowledge["29/11/2"].intermediateNumber, 11);
  assert.equal(type45Knowledge["39/12/3"].intermediateNumber, 12);
  assert.equal(type45Knowledge["20/2"].intermediateNumber, null);
});

test("single forms do not fabricate outer or inner numbers", () => {
  for (const key of ["4/4", "5/5", "6/6", "7/7", "8/8", "9/9"] as const) {
    assert.equal(type45Knowledge[key].outerNumber, null);
    assert.equal(type45Knowledge[key].innerNumber, null);
  }
});

test("five verified special groups contain four members and preserve overlaps", () => {
  assert.equal(Object.keys(specialTypeGroups).length, 5);
  for (const group of Object.values(specialTypeGroups)) assert.equal(group.members.length, 4);
  assert.deepEqual(type45Knowledge["37/10/1"].specialTypes, ["四大鬼才", "四大业务"]);
  assert.deepEqual(type45Knowledge["25/7"].specialTypes, ["四大鬼才", "四大人才"]);
  assert.deepEqual(type45Knowledge["32/5"].specialTypes, ["四大业务"]);
});

test("three verified normalized 45-type fixtures contain supplied course content", () => {
  for (const key of ["42/6", "32/5", "28/10/1"] as const) {
    const entry = type45Knowledge[key];
    assert.equal(entry.status, "verified_normalized");
    assert.ok(entry.summary);
    assert.ok(entry.strengths?.length);
    assert.ok(entry.challenges?.length);
  }
});

test("traditional and new grid line knowledge remain separate namespaces", () => {
  assert.equal(classicLineKnowledge["357"]?.status, "verified_normalized");
  assert.equal(newLineKnowledge["357"]?.status, "structure_only");
  assert.notEqual(classicLineKnowledge["357"], newLineKnowledge["357"]);
  assert.equal(classicLineKnowledge["159"]?.status, "verified_normalized");
  assert.equal(newLineKnowledge["159"]?.status, "structure_only");
  for (const key of ["13", "17", "39", "79"]) assert.equal(newLineKnowledge[key]?.status, "structure_only");
});

test("personal-year and 45-type 24/6 records are separate contexts", () => {
  assert.equal(personalYearKnowledge[6].status, "unresolved");
  assert.equal(type45Knowledge["24/6"].status, "structure_only");
  assert.notEqual(personalYearKnowledge[6], type45Knowledge["24/6"]);
});

test("LifeCode by Personal Year structure preserves direction across all 81 pairs", () => {
  assert.equal(Object.keys(lifeCodePersonalYearKnowledge).length, 9);
  assert.equal(Object.keys(lifeCodePersonalYearKnowledge[1]).length, 9);
  assert.equal(lifeCodePersonalYearKnowledge[6][8].title, "生涯运数 6 × 流年 8");
  assert.equal(lifeCodePersonalYearKnowledge[8][6].title, "生涯运数 8 × 流年 6");
  assert.notEqual(lifeCodePersonalYearKnowledge[6][8].title, lifeCodePersonalYearKnowledge[8][6].title);
});

test("relationship 10 to 12 remain separate from intermediate 10 to 12", () => {
  for (const number of [10, 11, 12] as const) {
    assert.notEqual(relationshipCombinationKnowledge[number], intermediateNumberKnowledge[number]);
    assert.match(relationshipCombinationKnowledge[number].title, /人际运数/);
    assert.match(intermediateNumberKnowledge[number].title, /中间数特性/);
  }
});

test("all relationship entries 2–12 contain verified normalized strengths and challenges", () => {
  for (const number of [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const) {
    const entry = relationshipCombinationKnowledge[number];
    assert.equal(entry.status, "verified_normalized");
    assert.ok(entry.strengths?.length);
    assert.ok(entry.challenges?.length);
  }
});

test("all nine Sacred Triangle position rules are verified", () => {
  assert.equal(Object.keys(sacredTriangleKnowledge).length, 9);
  for (const entry of Object.values(sacredTriangleKnowledge)) {
    assert.equal(entry.status, "verified");
    assert.ok(entry.content);
  }
});

test("unresolved records contain no fabricated placeholder body text", () => {
  const unresolved = [
    ...Object.values(missingNumberKnowledge),
    ...Object.values(personalYearKnowledge),
    ...Object.values(newLineKnowledge),
  ];
  assert.ok(unresolved.every((entry) => entry.content === undefined));
  assert.ok(unresolved.every((entry) => entry.content !== "解析内容待补充"));
  assert.equal(Object.values(relationshipCombinationKnowledge)
    .filter((entry) => entry.status === "unresolved").length, 0);
  assert.ok(getMissingKnowledgeKeys().length > 0);
});
