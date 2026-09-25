"use client";

import { useMemo, useState } from "react";
import { SearchCombobox } from "@/app/(app)/components/SearchCombobox";
import { formatMemberCode, formatMemberDisplayName } from "@/lib/member-display";
import { getDirectReports } from "@/lib/member-hierarchy";
import {
  getOrganizationAncestorPath,
  getOrganizationCounts,
  getOrganizationRoots,
  type OrganizationChartMember,
} from "@/lib/organization-chart";

type OrganizationChartProps = {
  members: OrganizationChartMember[];
};

function getInitials(member: OrganizationChartMember) {
  return formatMemberDisplayName(member)
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function OrganizationChart({ members }: OrganizationChartProps) {
  const roots = useMemo(() => getOrganizationRoots(members), [members]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => new Set(roots.map((member) => member.id)),
  );
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const childrenByLeader = useMemo(() => {
    const entries = members.map((member) => [
      member.id,
      getDirectReports(members, member.id),
    ] as const);
    return new Map(entries);
  }, [members]);
  const countsByMember = useMemo(
    () =>
      new Map(
        members.map((member) => [
          member.id,
          getOrganizationCounts(members, member.id),
        ]),
      ),
    [members],
  );
  const searchOptions = useMemo(
    () =>
      members.map((member) => ({
        id: member.id,
        label: formatMemberDisplayName(member),
        description: member.position || undefined,
        searchText: [
          member.display_name,
          member.full_name,
          formatMemberCode(member.member_code),
          member.member_code,
        ]
          .filter(Boolean)
          .join(" "),
      })),
    [members],
  );

  function selectMember(memberId: string) {
    setSelectedMemberId(memberId);
    if (!memberId) return;

    const ancestorPath = getOrganizationAncestorPath(members, memberId);
    setExpandedIds((current) => {
      const next = new Set(current);
      for (const ancestorId of ancestorPath.slice(0, -1)) {
        next.add(ancestorId);
      }
      return next;
    });

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        document
          .getElementById(`organization-member-${memberId}`)
          ?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
      });
    });
  }

  function toggleMember(memberId: string) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(memberId)) next.delete(memberId);
      else next.add(memberId);
      return next;
    });
  }

  function renderMember(member: OrganizationChartMember, ancestors: Set<string>) {
    const children = childrenByLeader.get(member.id) ?? [];
    const counts = countsByMember.get(member.id) ?? {
      directReports: 0,
      totalDownline: 0,
    };
    const expanded = expandedIds.has(member.id);
    const nextAncestors = new Set(ancestors).add(member.id);

    return (
      <li key={member.id} className="relative pl-8 first:pt-0">
        <span className="absolute left-0 top-10 h-px w-8 bg-zinc-300" aria-hidden="true" />
        <article
          id={`organization-member-${member.id}`}
          className={`w-72 rounded-[22px] border bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.05)] transition sm:w-80 ${
            selectedMemberId === member.id
              ? "border-[#b8924a] ring-4 ring-[#b8924a]/15"
              : "border-zinc-200"
          }`}
        >
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-sm font-semibold text-white">
              {getInitials(member)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-zinc-950">
                {formatMemberDisplayName(member)}
              </p>
              <p className="mt-1 truncate text-sm text-zinc-500">
                {member.position || "Position not set"}
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 border-t border-zinc-100 pt-3 text-xs">
            <div>
              <p className="text-zinc-400">Direct Reports</p>
              <p className="mt-1 font-semibold text-zinc-900">{counts.directReports}</p>
            </div>
            <div>
              <p className="text-zinc-400">Total Downline</p>
              <p className="mt-1 font-semibold text-zinc-900">{counts.totalDownline}</p>
            </div>
          </div>

          {children.length ? (
            <button
              type="button"
              onClick={() => toggleMember(member.id)}
              aria-expanded={expanded}
              className="mt-3 w-full rounded-xl bg-[#f7f0df] px-3 py-2 text-xs font-semibold text-[#795f2c] transition hover:bg-[#efe2c5]"
            >
              {expanded ? "Collapse" : `Expand ${children.length}`}
            </button>
          ) : null}
        </article>

        {expanded && children.length ? (
          <ul className="ml-8 mt-4 space-y-4 border-l border-zinc-300 pb-1">
            {children.map((child) =>
              nextAncestors.has(child.id)
                ? null
                : renderMember(child, nextAncestors),
            )}
          </ul>
        ) : null}
      </li>
    );
  }

  return (
    <section className="mt-6 rounded-[28px] border border-zinc-200 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.04)] sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-zinc-500">
            Organization Chart
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">
            Falcon hierarchy
          </h2>
          <p className="mt-2 text-sm text-zinc-600">
            Expand each branch to explore direct reports and the complete downline.
          </p>
        </div>
        <div className="w-full lg:max-w-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-400">
              Search Member
            </span>
            {selectedMemberId ? (
              <button
                type="button"
                onClick={() => selectMember("")}
                className="text-xs font-medium text-zinc-500 hover:text-zinc-900"
              >
                Clear
              </button>
            ) : null}
          </div>
          <SearchCombobox
            value={selectedMemberId}
            options={searchOptions}
            placeholder="Search name or member code..."
            emptyLabel="No members found"
            onChange={selectMember}
          />
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-[22px] border border-zinc-200 bg-[#fbfaf7] p-4 sm:p-6">
        <div className="min-w-max pr-8">
          {roots.length ? (
            <ul className="space-y-8 border-l border-zinc-300">
              {roots.map((root) => renderMember(root, new Set()))}
            </ul>
          ) : (
            <p className="py-8 text-center text-sm text-zinc-500">
              No organization hierarchy is available.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
