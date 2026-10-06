import type { KnowledgeEntry, NumerologyNumber } from "../types";

export const lifeCodePersonalYearKnowledge = Object.fromEntries(
  Array.from({ length: 9 }, (_, lifeIndex) => {
    const lifeNumber = (lifeIndex + 1) as NumerologyNumber;
    return [
      lifeNumber,
      Object.fromEntries(
        Array.from({ length: 9 }, (_, yearIndex) => {
          const yearNumber = (yearIndex + 1) as NumerologyNumber;
          return [
            yearNumber,
            {
              title: `生涯运数 ${lifeNumber} × 流年 ${yearNumber}`,
              status: "structure_only",
            },
          ];
        }),
      ) as Record<NumerologyNumber, KnowledgeEntry>,
    ];
  }),
) as Record<NumerologyNumber, Record<NumerologyNumber, KnowledgeEntry>>;
