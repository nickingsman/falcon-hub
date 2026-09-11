export function getDuplicateName(sourceName: string, existingNames: string[]) {
  const normalizedNames = new Set(existingNames.map((name) => name.trim().toLowerCase()));
  const baseName = sourceName.replace(/ Copy(?: \d+)?$/i, "").trim();

  for (let copyNumber = 1; ; copyNumber += 1) {
    const suffix = copyNumber === 1 ? " Copy" : ` Copy ${copyNumber}`;
    const candidate = `${baseName}${suffix}`;

    if (!normalizedNames.has(candidate.toLowerCase())) return candidate;
  }
}
