export type NumerologyNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export type WesternZodiacSign =
  | "aries"
  | "taurus"
  | "gemini"
  | "cancer"
  | "leo"
  | "virgo"
  | "libra"
  | "scorpio"
  | "sagittarius"
  | "capricorn"
  | "aquarius"
  | "pisces";

export type ZodiacResult = {
  sign: WesternZodiacSign;
  name: string;
  number: NumerologyNumber;
};

export type SymbolSource = "birth" | "talent" | "life" | "zodiac";

export type SymbolCounts = Record<SymbolSource, number>;

export type NumerologyCell = {
  number: NumerologyNumber;
  symbols: SymbolCounts;
  totalEnergy: number;
  present: boolean;
};

export type ReductionStage = {
  total: number;
  chain: number[];
  final: NumerologyNumber;
};

export type LifeStageId = "under-19" | "19-36" | "37-54" | "55-72" | "73-plus";

export type LifeStage = {
  id: LifeStageId;
  ageRange: string;
  combination: string | null;
  supported: boolean;
  returnToFirstStage: boolean;
};

export type NumerologyLine = {
  id: string;
  numbers: readonly NumerologyNumber[];
};

export type SacredTrianglePosition =
  | "主运"
  | "家族"
  | "朋友"
  | "事业"
  | "转机"
  | "感情"
  | "危机"
  | "钱财"
  | "信念";

export type SacredTriangleValue = {
  position: SacredTrianglePosition;
  value: NumerologyNumber;
};

export type CareerNumerologyInput = {
  dateOfBirth: string;
  currentDate?: string;
};

export type StageTableColumn = {
  unit: "年" | "月" | "日";
  birthValue: string;
  stageChain: string;
  ageRange: "55–72" | "37–54" | "19–36";
  stageId: "55-72" | "37-54" | "19-36";
};

export type CalculationStep = {
  digits: number[];
  total: number;
};

export type RelationshipCalculation = {
  first: NumerologyNumber;
  second: NumerologyNumber;
  rawSum: number;
  reductionDigits: number[] | null;
  result: RelationshipNumber;
};

export type CareerNumerologyResult = {
  dateOfBirth: string;
  age: number;
  year: ReductionStage;
  month: ReductionStage;
  day: ReductionStage;
  talentNumber: number;
  lifeNumber: NumerologyNumber;
  combination: string;
  layers: {
    externalAbility: NumerologyNumber | null;
    internalThought: NumerologyNumber | null;
    lifeCharacter: NumerologyNumber;
  };
  stages: LifeStage[];
  stageTable: StageTableColumn[];
  currentStageId: LifeStageId;
  cells: NumerologyCell[];
  missingNumbers: NumerologyNumber[];
  traditionalLines: NumerologyLine[];
  newLines: NumerologyLine[];
  zodiac: ZodiacResult;
  zodiacNumber: NumerologyNumber;
  personalYear: {
    applicableYear: number;
    total: number;
    chain: number[];
    number: NumerologyNumber;
    calculationSteps: CalculationStep[];
  };
  sacredTriangle: SacredTriangleValue[];
};

export type KnowledgeStatus =
  | "verified"
  | "verified_normalized"
  | "structure_only"
  | "unresolved";

export type KnowledgeEntry = {
  title: string;
  content?: string;
  status: KnowledgeStatus;
};

export type NumberKnowledge = {
  number: NumerologyNumber;
  core: {
    title: string;
    traits?: string[];
    strengths?: string[];
    challenges?: string[];
  };
  views?: {
    life?: string;
    work?: string;
    relationship?: string;
  };
  status: KnowledgeStatus;
};

export type IntermediateNumber = 10 | 11 | 12;
export type RelationshipNumber = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
export type SpecialTypeId = "四大帝王" | "四大卓越" | "四大鬼才" | "四大业务" | "四大人才";

export type Type45Key =
  | "10/1" | "19/10/1" | "28/10/1" | "37/10/1" | "46/10/1"
  | "11/2" | "20/2" | "29/11/2" | "38/11/2" | "47/11/2"
  | "12/3" | "21/3" | "30/3" | "39/12/3" | "48/12/3"
  | "4/4" | "13/4" | "22/4" | "31/4" | "40/4"
  | "5/5" | "14/5" | "23/5" | "32/5" | "41/5"
  | "6/6" | "15/6" | "24/6" | "33/6" | "42/6"
  | "7/7" | "16/7" | "25/7" | "34/7" | "43/7"
  | "8/8" | "17/8" | "26/8" | "35/8" | "44/8"
  | "9/9" | "18/9" | "27/9" | "36/9" | "45/9";

export type Type45Knowledge = {
  key: Type45Key;
  outerNumber: NumerologyNumber | null;
  innerNumber: NumerologyNumber | null;
  intermediateNumber: IntermediateNumber | null;
  lifeNumber: NumerologyNumber;
  summary?: string;
  points?: string[];
  strengths?: string[];
  challenges?: string[];
  specialTypes: SpecialTypeId[];
  status: "verified" | "verified_normalized" | "structure_only";
  source?: {
    kind: "course_printed";
    part: 3 | 4;
    pages?: number[];
  };
  annotations?: string[];
};

export type RelationshipKnowledge = {
  number: RelationshipNumber;
  title: string;
  strengths?: string[];
  challenges?: string[];
  status: KnowledgeStatus;
};
