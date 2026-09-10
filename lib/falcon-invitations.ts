import "server-only";

import { createHash, randomBytes } from "node:crypto";

const inviteAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function normalizeInvitationEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function normalizeInvitationCode(value: unknown) {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

export function hashInvitationCode(code: string) {
  return createHash("sha256").update(code, "utf8").digest("hex");
}

export function generateInvitationCode() {
  const random = randomBytes(16);
  const characters = Array.from(random, (byte) => inviteAlphabet[byte % inviteAlphabet.length]);
  return `FALCON-${characters.slice(0, 4).join("")}-${characters.slice(4, 8).join("")}-${characters.slice(8, 12).join("")}-${characters.slice(12, 16).join("")}`;
}
