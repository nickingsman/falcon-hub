export const historicalMemberAliases = new Map([
  ["yang li", "ong yang li"],
  ["yangli", "ong yang li"],
  ["alvin foo", "alvin"],
]);

export const historicalProjectAliases = new Map([
  ["aster hill", "aster hill residence"],
  ["aurum suites", "aurum suite"],
  ["bamboo hill", "bamboo hills residence"],
  ["connaught one", "the connaught one"],
  ["d'parc", "d'parc residence"],
  ["enlace suite 1", "enlace suites 1"],
  ["forest hill", "foresthill residences"],
  ["maxxon", "the maxxon"],
  ["residensi zig", "zig residence"],
  ["tangen", "tangen residence"],
  ["the courtyard", "the courtyard residence"],
  ["the era residence", "the era"],
  ["the shang", "the shang residence"],
  ["trinity rainfora", "trinity rainfora residence"],
  ["tuan straits residence", "tuan straits"],
]);

const confirmedDateCorrections = new Map([
  [28, "2026-01-23"],
  [32, "2026-01-29"],
  [45, "2026-02-02"],
  [119, "2026-03-21"],
]);

const confirmedUnitCorrections = new Map([
  [74, "08-16"],
  [132, "09-06"],
  [227, "01-01"],
]);

const confirmedContributorAllocationCorrections = new Map<number, ReadonlyMap<string, number>>([
  [87, new Map([
    ["nicholas yap", 50],
    ["peiling", 25],
    ["sim yap", 25],
  ])],
  [207, new Map([
    ["nicholas yap", 16.67],
    ["ah seng", 16.67],
    ["hermes lim", 16.66],
    ["eric siow", 50],
  ])],
]);

const confirmedStatusCorrections = new Map([
  [117, "booking" as const],
]);

export function normalizeHistoricalName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function getHistoricalMemberLookupName(value: string) {
  const normalized = normalizeHistoricalName(value);
  return historicalMemberAliases.get(normalized) ?? normalized;
}

export function getHistoricalProjectLookupName(value: string) {
  const normalized = normalizeHistoricalName(value);
  return historicalProjectAliases.get(normalized) ?? normalized;
}

export function getHistoricalCorrectedUnit(sourceRow: number, sourceUnit: string) {
  return confirmedUnitCorrections.get(sourceRow) ?? sourceUnit.trim();
}

export function getHistoricalCorrectedDate(sourceRow: number, parsedDate: string | null) {
  return confirmedDateCorrections.get(sourceRow) ?? parsedDate;
}

export function getHistoricalContributorAllocationCorrection(sourceRow: number) {
  return confirmedContributorAllocationCorrections.get(sourceRow) ?? null;
}

export function getHistoricalStatusCorrection(sourceRow: number) {
  return confirmedStatusCorrections.get(sourceRow) ?? null;
}

export function getFirstUnusedHistoricalUnit(sourceUnit: string, occupied: ReadonlySet<string>) {
  let candidate = sourceUnit;
  while (occupied.has(candidate.trim().toLowerCase())) candidate += ".";
  return candidate;
}
