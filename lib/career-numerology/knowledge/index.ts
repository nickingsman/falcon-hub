import { classicLineKnowledge } from "./classic-lines";
import { intermediateNumberKnowledge } from "./intermediate-numbers";
import { lifeCodePersonalYearKnowledge } from "./lifecode-personal-years";
import { missingNumberKnowledge } from "./missing-numbers";
import { newLineKnowledge } from "./new-lines";
import { numberKnowledge } from "./numbers";
import { personalYearKnowledge } from "./personal-years";
import { relationshipCombinationKnowledge } from "./relationship-combinations";
import { sacredTriangleKnowledge } from "./sacred-triangle";
import { specialTypeGroups } from "./special-types-20";
import { getType45Knowledge, TYPE_45_KEYS, type45Knowledge } from "./types-45";

export {
  classicLineKnowledge,
  intermediateNumberKnowledge,
  lifeCodePersonalYearKnowledge,
  missingNumberKnowledge,
  newLineKnowledge,
  numberKnowledge,
  personalYearKnowledge,
  relationshipCombinationKnowledge,
  sacredTriangleKnowledge,
  specialTypeGroups,
  getType45Knowledge,
  TYPE_45_KEYS,
  type45Knowledge,
};

export function getMissingKnowledgeKeys() {
  const collect = (prefix: string, entries: Record<string | number, { status: string }>) =>
    Object.entries(entries)
      .filter(([, entry]) => entry.status === "structure_only" || entry.status === "unresolved")
      .map(([key]) => `${prefix}:${key}`);

  return [
    ...collect("type45", type45Knowledge),
    ...collect("intermediate", intermediateNumberKnowledge),
    ...collect("missing", missingNumberKnowledge),
    ...collect("classic-line", classicLineKnowledge),
    ...collect("new-line", newLineKnowledge),
    ...collect("personal-year", personalYearKnowledge),
    ...collect("sacred-triangle", sacredTriangleKnowledge),
    ...collect("relationship", relationshipCombinationKnowledge),
  ];
}
