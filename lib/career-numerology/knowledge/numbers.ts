import type { NumberKnowledge, NumerologyNumber } from "../types";

const titles: Record<NumerologyNumber, string> = {
  1: "开创与目标",
  2: "合作与协调",
  3: "沟通与灵敏",
  4: "执行与稳定",
  5: "表达与自由",
  6: "关怀与接纳",
  7: "真实与谨慎",
  8: "丰足与权利",
  9: "正直与智慧",
};

export const numberKnowledge = Object.fromEntries(
  Object.entries(titles).map(([number, title]) => [
    number,
    { number: Number(number) as NumerologyNumber, core: { title }, status: "verified_normalized" },
  ]),
) as Record<NumerologyNumber, NumberKnowledge>;
