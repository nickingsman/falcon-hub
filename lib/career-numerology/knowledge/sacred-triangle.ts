import type { KnowledgeEntry, SacredTrianglePosition } from "../types";

export const sacredTriangleKnowledge = Object.fromEntries(
  Object.entries({
    主运: "该位置数字代表整体运势走向。",
    家族: "拿该数字的优点作为互动策略。",
    朋友: "发挥该数字能量的优点，用于社交。",
    事业: "发挥该数字能量的优点。",
    转机: "发挥该数字能量的优点，作为逆转方向。",
    感情: "拿该数字的优点作为互动策略。",
    危机: "重点查看该数字能量的缺点，并提醒切忌再犯。",
    钱财: "以该数字的理财优点作为策略。",
    信念: "从该数字的工作观、感情观、人生观作为自己的理念参考。",
  }).map(([position, content]) => [position, { title: position, content, status: "verified" }]),
) as Record<SacredTrianglePosition, KnowledgeEntry>;
