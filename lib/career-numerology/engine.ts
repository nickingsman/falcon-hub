import type {
  CareerNumerologyInput,
  CareerNumerologyResult,
  LifeStage,
  LifeStageId,
  NumerologyCell,
  NumerologyLine,
  NumerologyNumber,
  RelationshipCalculation,
  RelationshipNumber,
  SacredTrianglePosition,
  SacredTriangleValue,
  SymbolCounts,
  WesternZodiacSign,
  ZodiacResult,
} from "./types";

export const TRADITIONAL_LAYOUT = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
export const NEW_LAYOUT = [8, 1, 6, 3, 5, 7, 4, 9, 2] as const;

export const TRADITIONAL_LINE_DEFINITIONS = [
  [1, 2, 3], [4, 5, 6], [7, 8, 9], [1, 4, 7],
  [2, 5, 8], [3, 6, 9], [1, 5, 9], [3, 5, 7],
  [2, 4], [2, 6], [4, 8], [6, 8],
] as const satisfies readonly (readonly NumerologyNumber[])[];

export const NEW_LINE_DEFINITIONS = [
  [8, 1, 6], [3, 5, 7], [4, 9, 2], [8, 3, 4],
  [1, 5, 9], [6, 7, 2], [8, 5, 2], [6, 5, 4],
  [1, 3], [1, 7], [3, 9], [7, 9],
] as const satisfies readonly (readonly NumerologyNumber[])[];

const SACRED_TRIANGLE_POSITIONS: SacredTrianglePosition[] = [
  "主运", "家族", "朋友", "事业", "转机", "感情", "危机", "钱财", "信念",
];

const ZODIAC_META: Record<WesternZodiacSign, Omit<ZodiacResult, "sign">> = {
  aries: { name: "牧羊座", number: 1 },
  taurus: { name: "金牛座", number: 2 },
  gemini: { name: "双子座", number: 3 },
  cancer: { name: "巨蟹座", number: 4 },
  leo: { name: "狮子座", number: 5 },
  virgo: { name: "处女座", number: 6 },
  libra: { name: "天秤座", number: 7 },
  scorpio: { name: "天蝎座", number: 8 },
  sagittarius: { name: "射手座", number: 9 },
  capricorn: { name: "摩羯座", number: 1 },
  aquarius: { name: "水瓶座", number: 2 },
  pisces: { name: "双鱼座", number: 3 },
};

function isNumerologyNumber(value: number): value is NumerologyNumber {
  return Number.isInteger(value) && value >= 1 && value <= 9;
}

function digitSum(value: number) {
  return String(Math.abs(Math.trunc(value)))
    .split("")
    .reduce((sum, digit) => sum + Number(digit), 0);
}

function digitsOf(value: number) {
  return String(Math.abs(Math.trunc(value))).split("").map(Number);
}

function buildReductionChain(total: number) {
  const chain = [total];
  let current = total;

  while (current >= 10) {
    current = digitSum(current);
    chain.push(current);
  }

  if (!isNumerologyNumber(current)) {
    throw new Error("运数必须落在 1 至 9。");
  }

  return { total, chain, final: current };
}

function parseDateOnly(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

function datePartsFromToday() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
}

function compareMonthDay(
  left: { month: number; day: number },
  right: { month: number; day: number },
) {
  if (left.month !== right.month) return left.month - right.month;
  return left.day - right.day;
}

export function calculateAge(dateOfBirth: string, currentDate?: string) {
  const birth = parseDateOnly(dateOfBirth);
  const current = currentDate ? parseDateOnly(currentDate) : datePartsFromToday();
  if (!birth || !current) return null;

  let age = current.year - birth.year;
  if (compareMonthDay(current, birth) < 0) age -= 1;
  return age >= 0 ? age : null;
}

export function calculateZodiac(dateOfBirth: string): ZodiacResult | null {
  const birth = parseDateOnly(dateOfBirth);
  if (!birth) return null;
  const dateCode = birth.month * 100 + birth.day;
  let sign: WesternZodiacSign;

  if (dateCode >= 1222 || dateCode <= 119) sign = "capricorn";
  else if (dateCode <= 218) sign = "aquarius";
  else if (dateCode <= 320) sign = "pisces";
  else if (dateCode <= 419) sign = "aries";
  else if (dateCode <= 520) sign = "taurus";
  else if (dateCode <= 620) sign = "gemini";
  else if (dateCode <= 722) sign = "cancer";
  else if (dateCode <= 822) sign = "leo";
  else if (dateCode <= 922) sign = "virgo";
  else if (dateCode <= 1022) sign = "libra";
  else if (dateCode <= 1121) sign = "scorpio";
  else sign = "sagittarius";

  return { sign, ...ZODIAC_META[sign] };
}

export function getLifeStageId(age: number): LifeStageId {
  if (age < 19) return "under-19";
  if (age <= 36) return "19-36";
  if (age <= 54) return "37-54";
  if (age <= 72) return "55-72";
  return "73-plus";
}

export function buildLifeStages(dayChain: number[], monthChain: number[], yearChain: number[]): LifeStage[] {
  const dayCombination = dayChain.join("/");
  return [
    { id: "under-19", ageRange: "0–18", combination: null, supported: false, returnToFirstStage: false },
    { id: "19-36", ageRange: "19–36", combination: dayCombination, supported: true, returnToFirstStage: false },
    { id: "37-54", ageRange: "37–54", combination: monthChain.join("/"), supported: true, returnToFirstStage: false },
    { id: "55-72", ageRange: "55–72", combination: yearChain.join("/"), supported: true, returnToFirstStage: false },
    { id: "73-plus", ageRange: "73+", combination: dayCombination, supported: true, returnToFirstStage: true },
  ];
}

function addDigitsToSymbols(counts: Map<NumerologyNumber, SymbolCounts>, digits: number[], source: keyof SymbolCounts) {
  for (const digit of digits) {
    if (!isNumerologyNumber(digit)) continue;
    const symbols = counts.get(digit);
    if (symbols) symbols[source] += 1;
  }
}

export function buildSymbolCells(
  dateOfBirth: string,
  talentNumber: number,
  lifeNumber: NumerologyNumber,
  zodiacNumber: NumerologyNumber | null,
): NumerologyCell[] {
  const counts = new Map<NumerologyNumber, SymbolCounts>();
  for (let number = 1; number <= 9; number += 1) {
    counts.set(number as NumerologyNumber, { birth: 0, talent: 0, life: 0, zodiac: 0 });
  }

  addDigitsToSymbols(counts, dateOfBirth.replaceAll("-", "").split("").map(Number), "birth");
  addDigitsToSymbols(counts, String(talentNumber).split("").map(Number), "talent");
  addDigitsToSymbols(counts, [lifeNumber], "life");
  if (zodiacNumber) addDigitsToSymbols(counts, [zodiacNumber], "zodiac");

  return Array.from(counts, ([number, symbols]) => {
    const totalEnergy = Object.values(symbols).reduce((sum, count) => sum + count, 0);
    return { number, symbols, totalEnergy, present: totalEnergy > 0 };
  });
}

export function detectLines(
  cells: NumerologyCell[],
  definitions: readonly (readonly NumerologyNumber[])[],
): NumerologyLine[] {
  const present = new Set(cells.filter((cell) => cell.present).map((cell) => cell.number));
  return definitions
    .filter((numbers) => numbers.every((number) => present.has(number)))
    .map((numbers) => ({ id: numbers.join(""), numbers }));
}

export function calculatePersonalYear(dateOfBirth: string, currentDate?: string) {
  const birth = parseDateOnly(dateOfBirth);
  const current = currentDate ? parseDateOnly(currentDate) : datePartsFromToday();
  if (!birth || !current) return null;

  const birthdayOccurred = compareMonthDay(current, birth) >= 0;
  const applicableYear = birthdayOccurred ? current.year : current.year - 1;
  const sourceDigits = [
    ...digitsOf(applicableYear),
    Math.floor(birth.month / 10), birth.month % 10,
    Math.floor(birth.day / 10), birth.day % 10,
  ];
  const total = sourceDigits.reduce((sum, digit) => sum + digit, 0);
  const reduction = buildReductionChain(total);
  const calculationSteps = [{ digits: sourceDigits, total }];
  for (const value of reduction.chain.slice(0, -1)) {
    const digits = digitsOf(value);
    calculationSteps.push({ digits, total: digits.reduce((sum, digit) => sum + digit, 0) });
  }
  return { applicableYear, total, chain: reduction.chain, number: reduction.final, calculationSteps };
}

export function buildSacredTriangle(personalYear: NumerologyNumber): SacredTriangleValue[] {
  return SACRED_TRIANGLE_POSITIONS.map((position, index) => ({
    position,
    value: (((personalYear - 1 + index) % 9) + 1) as NumerologyNumber,
  }));
}

export function calculateRelationshipNumber(first: NumerologyNumber, second: NumerologyNumber) {
  return calculateRelationship(first, second).result;
}

export function calculateRelationship(
  first: NumerologyNumber,
  second: NumerologyNumber,
): RelationshipCalculation {
  const rawSum = first + second;
  const reductionDigits = rawSum >= 13 ? digitsOf(rawSum) : null;
  return {
    first,
    second,
    rawSum,
    reductionDigits,
    result: (reductionDigits ? reductionDigits.reduce((sum, digit) => sum + digit, 0) : rawSum) as RelationshipNumber,
  };
}

export function calculateCareerNumerology(input: CareerNumerologyInput): CareerNumerologyResult | null {
  const birth = parseDateOnly(input.dateOfBirth);
  const age = calculateAge(input.dateOfBirth, input.currentDate);
  const personalYear = calculatePersonalYear(input.dateOfBirth, input.currentDate);
  const zodiac = calculateZodiac(input.dateOfBirth);
  if (!birth || age === null || !personalYear || !zodiac) return null;

  const yearTotal = digitSum(birth.year);
  const year = buildReductionChain(yearTotal);
  const month = buildReductionChain(yearTotal + digitSum(birth.month));
  const day = buildReductionChain(month.total + digitSum(birth.day));
  const talentDigits = String(day.total).split("").map(Number).filter(isNumerologyNumber);

  const cells = buildSymbolCells(input.dateOfBirth, day.total, day.final, zodiac.number);

  return {
    dateOfBirth: input.dateOfBirth,
    age,
    year,
    month,
    day,
    talentNumber: day.total,
    lifeNumber: day.final,
    combination: day.chain.join("/"),
    layers: {
      externalAbility: talentDigits.length >= 2 ? talentDigits[0] ?? null : null,
      internalThought: talentDigits.length >= 2 ? talentDigits[1] ?? null : talentDigits[0] ?? null,
      lifeCharacter: day.final,
    },
    stages: buildLifeStages(day.chain, month.chain, year.chain),
    stageTable: [
      { unit: "年", birthValue: String(birth.year), stageChain: year.chain.join("/"), ageRange: "55–72", stageId: "55-72" },
      { unit: "月", birthValue: String(birth.month).padStart(2, "0"), stageChain: month.chain.join("/"), ageRange: "37–54", stageId: "37-54" },
      { unit: "日", birthValue: String(birth.day).padStart(2, "0"), stageChain: day.chain.join("/"), ageRange: "19–36", stageId: "19-36" },
    ],
    currentStageId: getLifeStageId(age),
    cells,
    missingNumbers: cells.filter((cell) => !cell.present).map((cell) => cell.number),
    traditionalLines: detectLines(cells, TRADITIONAL_LINE_DEFINITIONS),
    newLines: detectLines(cells, NEW_LINE_DEFINITIONS),
    zodiac,
    zodiacNumber: zodiac.number,
    personalYear,
    sacredTriangle: buildSacredTriangle(personalYear.number),
  };
}
