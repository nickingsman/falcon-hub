import type { KnowledgeEntry } from "../types";

export const newLineKnowledge: Record<string, KnowledgeEntry> = Object.fromEntries(
  ["816", "357", "492", "834", "159", "672", "852", "654", "13", "17", "39", "79"]
    .map((id) => [id, { title: `${id}｜连线成立`, status: "structure_only" }]),
);
