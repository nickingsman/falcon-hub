export type MemberIdentity = {
  full_name: string | null;
  member_code?: number | null;
};

export function formatMemberCode(memberCode: number | null | undefined) {
  if (typeof memberCode !== "number" || !Number.isFinite(memberCode)) {
    return null;
  }

  return String(memberCode).padStart(3, "0");
}

export function formatMemberDisplayName(member: MemberIdentity | null | undefined) {
  const name = member?.full_name || "Unnamed member";
  const code = formatMemberCode(member?.member_code);

  return code ? `${name} (${code})` : name;
}
