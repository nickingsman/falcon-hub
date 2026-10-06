import type { KnowledgeEntry, NumerologyNumber } from "../types";

export const personalYearKnowledge = Object.fromEntries(
  Array.from({ length: 9 }, (_, index) => {
    const number = (index + 1) as NumerologyNumber;
    return [number, { title: `流年 ${number}`, status: "unresolved" }];
  }),
) as Record<NumerologyNumber, KnowledgeEntry>;
