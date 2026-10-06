import type { IntermediateNumber, NumerologyNumber, Type45Key, Type45Knowledge } from "../types";
import { getSpecialTypesForKey } from "./special-types-20";

export const TYPE_45_KEYS = [
  "10/1", "19/10/1", "28/10/1", "37/10/1", "46/10/1",
  "11/2", "20/2", "29/11/2", "38/11/2", "47/11/2",
  "12/3", "21/3", "30/3", "39/12/3", "48/12/3",
  "4/4", "13/4", "22/4", "31/4", "40/4",
  "5/5", "14/5", "23/5", "32/5", "41/5",
  "6/6", "15/6", "24/6", "33/6", "42/6",
  "7/7", "16/7", "25/7", "34/7", "43/7",
  "8/8", "17/8", "26/8", "35/8", "44/8",
  "9/9", "18/9", "27/9", "36/9", "45/9",
] as const satisfies readonly Type45Key[];

const noOuterInner = new Set<Type45Key>(["10/1", "11/2", "12/3", "4/4", "5/5", "6/6", "7/7", "8/8", "9/9"]);

function structuralEntry(key: Type45Key): Type45Knowledge {
  const parts = key.split("/").map(Number);
  const first = parts[0] ?? 0;
  const final = parts.at(-1) as NumerologyNumber;
  const intermediate = parts.slice(0, -1).find((value) => value >= 10 && value <= 12) as IntermediateNumber | undefined;
  return {
    key,
    outerNumber: noOuterInner.has(key) ? null : Math.floor(first / 10) as NumerologyNumber,
    innerNumber: noOuterInner.has(key) ? null : first % 10 as NumerologyNumber,
    intermediateNumber: intermediate ?? null,
    lifeNumber: final,
    specialTypes: getSpecialTypesForKey(key),
    status: "structure_only",
  };
}

const entries = Object.fromEntries(TYPE_45_KEYS.map((key) => [key, structuralEntry(key)])) as Record<Type45Key, Type45Knowledge>;

entries["42/6"] = {
  ...entries["42/6"],
  summary: "感情丰富，重视关系与爱，带有浪漫与理想主义倾向。愿意付出、照顾与牺牲，性格敏感、温和、谨慎。重视家庭、生活品质与情感，也具有学习与发展专业技能的倾向。",
  strengths: ["理想主义", "热情", "有同理心", "忠诚可靠", "情感丰富，容易被感动", "乐观、较单纯", "容易相处", "具有艺术、美感与想象力", "做事细心", "重视专业能力"],
  challenges: ["容易过度理想化", "可能为了感情妥协或牺牲自己", "期待过高时容易失望", "情绪较容易受伤或波动", "有时过度感性", "需要留意欲望与孤独感"],
  status: "verified_normalized",
};

entries["32/5"] = {
  ...entries["32/5"],
  summary: "聪明、活泼、反应快。思想与行为中仍带有传统价值，对自己有要求并追求完美。希望得到别人的尊重与欣赏。兼具理性与感性，具有创造力、社交能力与观察力。主动、好胜，也擅长解决问题。",
  strengths: ["领导力", "影响力", "社交魅力", "企图心", "说服能力", "多才多艺", "容易吸引别人", "人缘较好"],
  challenges: ["内在容易产生混乱", "面对变化可能三分钟热度", "急躁", "缺乏耐性", "容易给自己压力", "讲话可能太直接", "有机会卷入别人的感情问题", "为避免冲突而压下问题", "过度追求成功时可能忽略伴侣或家庭"],
  status: "verified_normalized",
};

entries["28/10/1"] = {
  ...entries["28/10/1"],
  summary: "诚实、大方、坦率直接。行动果断，有胆量与冒险精神。懂得把握机会并采取行动。感情深而真诚，热心且愿意帮助别人。具有创造力、目标感与领导倾向。希望建立自己的事业与成就。",
  strengths: ["头脑敏锐", "个性鲜明", "领导能力强", "有冲劲", "有企图心", "热情", "大方", "精力与行动力较强", "有耐力", "理性", "冷静", "务实", "有判断力", "对自己人较好"],
  challenges: ["容易固执", "不够变通", "社交表达可能欠圆滑", "敏感、容易受伤", "不容易接受拒绝或批评", "控制欲需要留意", "不喜欢别人替自己做决定", "对改变可能产生抗拒", "讲话过于直接时容易显得没礼貌", "涉及自身利益时可能对风险有所犹豫"],
  status: "verified_normalized",
};

export const type45Knowledge = entries;

export function getType45Knowledge(key: string) {
  return TYPE_45_KEYS.includes(key as Type45Key)
    ? type45Knowledge[key as Type45Key]
    : undefined;
}
