"use client";

import { formatMemberCode } from "@/lib/member-display";
import { SearchCombobox } from "../../components/SearchCombobox";

export type LeaderMeetingMemberOption = {
  id: string;
  memberCode: number | null;
  fullName: string | null;
  displayName: string | null;
  name: string;
  position: string | null;
};

export function MemberMultiSelect({
  members,
  selectedIds,
  onChange,
}: {
  members: LeaderMeetingMemberOption[];
  selectedIds: string[];
  onChange: (memberIds: string[]) => void;
}) {
  const selectedMembers = selectedIds.map((memberId) => members.find((member) => member.id === memberId)).filter((member): member is LeaderMeetingMemberOption => Boolean(member));
  const options = members
    .filter((member) => !selectedIds.includes(member.id))
    .map((member) => ({
      id: member.id,
      label: `${member.name}${member.position ? ` — ${member.position}` : ""}`,
      description: formatMemberCode(member.memberCode) ? `Member ${formatMemberCode(member.memberCode)}` : undefined,
      searchText: [member.displayName, member.fullName, formatMemberCode(member.memberCode)].filter(Boolean).join(" "),
    }));

  return <div>
    {selectedMembers.length ? <div className="mt-2 flex flex-wrap gap-2">{selectedMembers.map((member) => <span key={member.id} className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-[#dfcfaa] bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700"><span className="truncate">{member.name}</span><button type="button" aria-label={`Remove ${member.name}`} onClick={() => onChange(selectedIds.filter((id) => id !== member.id))} className="shrink-0 text-zinc-400 hover:text-red-700">×</button></span>)}</div> : null}
    <SearchCombobox value="" options={options} placeholder="Search member..." emptyLabel="No more members found." onChange={(memberId) => onChange(selectedIds.includes(memberId) ? selectedIds : [...selectedIds, memberId])} />
  </div>;
}
