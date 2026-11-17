import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const projectRoot = new URL("../", import.meta.url);

export async function resolve(specifier, context, nextResolve) {
  const candidates = [];
  if (specifier.startsWith("@/")) {
    const relative = specifier.slice(2);
    candidates.push(new URL(`${relative}.ts`, projectRoot));
    candidates.push(new URL(`${relative}.tsx`, projectRoot));
  } else if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL) {
    candidates.push(new URL(`${specifier}.ts`, context.parentURL));
    candidates.push(new URL(`${specifier}.tsx`, context.parentURL));
  }
  for (const candidate of candidates) {
    if (existsSync(fileURLToPath(candidate))) return { url: candidate.href, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
