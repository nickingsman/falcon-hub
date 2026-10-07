"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { getMalaysiaTodayDateString } from "@/lib/malaysia-date";
import { Button, EmptyState, PageHeader, SectionHeader, StatusBadge } from "../../components/ui";
import { LeaderMeetingMemberOption, MemberMultiSelect } from "./MemberMultiSelect";

type Participant = { id: string; member_id: string; member_name_snapshot: string };
type DiscussionItem = { id: string; participants: Participant[]; topic: string; notes: string | null; priority: "low" | "normal" | "high"; status: "pending" | "deferred"; created_at: string };
type OpenAction = { id: string; meeting_id: string; action: string; assignees: Participant[]; due_date: string | null; status: "open"; meetingParticipants: Participant[]; meetingDate: string | null };
type RecentMeeting = { id: string; participants: Participant[]; meeting_date: string; completed_at: string; topicCount: number; decisionCount: number; openActionCount: number };
type Overview = { discussionItems: DiscussionItem[]; openActions: OpenAction[]; recentMeetings: RecentMeeting[]; today: string };

const inputClass = "mt-2 min-h-11 w-full rounded-2xl border border-[var(--falcon-soft-border)] bg-[#fafaf8] px-4 py-3 text-sm outline-none focus:border-[var(--falcon-gold-dark)] focus:bg-white";

function formatDate(value: string | null) {
  if (!value) return "No due date";
  return new Intl.DateTimeFormat("en-MY", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kuala_Lumpur" }).format(new Date(`${value.slice(0, 10)}T00:00:00+08:00`));
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/45 p-3 sm:items-center"><div className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-[26px] bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4"><h2 className="text-lg font-semibold text-zinc-950">{title}</h2><button type="button" onClick={onClose} className="rounded-full px-3 py-1 text-sm font-semibold text-zinc-500 hover:bg-zinc-100">Close</button></div>{children}</div></div>;
}

export default function LeaderMeetingsPage() {
  const router = useRouter();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [members, setMembers] = useState<LeaderMeetingMemberOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [discussionOpen, setDiscussionOpen] = useState(false);
  const [meetingOpen, setMeetingOpen] = useState(false);
  const [editing, setEditing] = useState<DiscussionItem | null>(null);
  const [discussionForm, setDiscussionForm] = useState({ participantMemberIds: [] as string[], topic: "", notes: "", priority: "normal" });
  const [meetingForm, setMeetingForm] = useState({ participantMemberIds: [] as string[], discussionItemIds: [] as string[], meetingDate: getMalaysiaTodayDateString() });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [overviewResponse, memberResponse] = await Promise.all([fetch("/api/leader-meetings/overview", { cache: "no-store" }), fetch("/api/leader-meetings/member-options", { cache: "no-store" })]);
      const [overviewPayload, memberPayload] = await Promise.all([overviewResponse.json(), memberResponse.json()]);
      if (!overviewResponse.ok) throw new Error(overviewPayload.error || "Unable to load Leader Meetings");
      if (!memberResponse.ok) throw new Error(memberPayload.error || "Unable to load members");
      setOverview(overviewPayload); setMembers(memberPayload.members ?? []);
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Unable to load Leader Meetings"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [load]);

  function openDiscussion(item: DiscussionItem | null = null) {
    setEditing(item);
    setDiscussionForm({ participantMemberIds: item?.participants.map((participant) => participant.member_id) ?? [], topic: item?.topic ?? "", notes: item?.notes ?? "", priority: item?.priority ?? "normal" });
    setDiscussionOpen(true);
  }

  async function saveDiscussion(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const response = await fetch(editing ? `/api/leader-meetings/discussion-items/${editing.id}` : "/api/leader-meetings/discussion-items", { method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(discussionForm) });
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "Unable to save discussion item");
      setDiscussionOpen(false); await load();
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Unable to save discussion item"); }
    finally { setSaving(false); }
  }

  async function archiveDiscussion(item: DiscussionItem) {
    if (!window.confirm(`Archive “${item.topic}”?`)) return;
    const response = await fetch(`/api/leader-meetings/discussion-items/${item.id}`, { method: "DELETE" });
    if (response.ok) await load(); else setError((await response.json()).error || "Unable to archive discussion item");
  }

  async function startMeeting(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const response = await fetch("/api/leader-meetings/meetings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(meetingForm) });
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "Unable to start meeting");
      router.push(`/team/leader-meetings/${payload.id}`);
    } catch (startError) { setError(startError instanceof Error ? startError.message : "Unable to start meeting"); setSaving(false); }
  }

  async function completeAction(action: OpenAction) {
    const response = await fetch(`/api/leader-meetings/action-items/${action.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "completed" }) });
    if (response.ok) await load(); else setError((await response.json()).error || "Unable to complete action item");
  }

  const overdue = overview?.openActions.filter((item) => item.due_date && item.due_date < (overview.today || "")) ?? [];
  const upcoming = overview?.openActions.filter((item) => !item.due_date || item.due_date >= (overview.today || "")) ?? [];
  const matchingDiscussionItems = useMemo(() => {
    const selectedParticipants = new Set(meetingForm.participantMemberIds);
    return (overview?.discussionItems ?? []).filter((item) => item.participants.some((participant) => selectedParticipants.has(participant.member_id)));
  }, [meetingForm.participantMemberIds, overview?.discussionItems]);

  function updateMeetingParticipants(participantMemberIds: string[]) {
    const selectedParticipants = new Set(participantMemberIds);
    const relevantIds = new Set((overview?.discussionItems ?? []).filter((item) => item.participants.some((participant) => selectedParticipants.has(participant.member_id))).map((item) => item.id));
    setMeetingForm((current) => ({ ...current, participantMemberIds, discussionItemIds: current.discussionItemIds.filter((itemId) => relevantIds.has(itemId)) }));
  }

  return <main className="space-y-5 px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
    <PageHeader eyebrow="Team" title="Leader Meetings" description="Private management workspace" actions={<div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={() => openDiscussion()}>+ Discussion Item</Button><Button onClick={() => setMeetingOpen(true)}>Start Meeting</Button></div>} />
    {error ? <p className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p> : null}
    {loading && !overview ? <p className="py-12 text-center text-sm text-zinc-500">Loading Leader Meetings…</p> : null}
    {overview ? <>
      <section className="rounded-[24px] border border-[var(--falcon-soft-border)] bg-white p-5 shadow-sm"><SectionHeader title="To Discuss" description="Pending and deferred topics with their discussion participants." action={<Button variant="ghost" onClick={() => openDiscussion()}>+ Add</Button>} />
        <div className="mt-4 divide-y divide-zinc-100 rounded-2xl border border-zinc-200">{overview.discussionItems.length ? overview.discussionItems.map((item) => <div key={item.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-start"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-medium text-zinc-900">{item.topic}</p>{item.priority === "high" ? <StatusBadge variant="warning">High</StatusBadge> : item.status === "deferred" ? <StatusBadge variant="neutral">Deferred</StatusBadge> : null}</div><p className="mt-1 text-xs text-zinc-500"><span className="font-medium text-zinc-600">Discuss With:</span> {item.participants.map((participant) => participant.member_name_snapshot).join(" · ")}</p>{item.notes ? <p className="mt-2 line-clamp-2 text-sm text-zinc-500">{item.notes}</p> : null}<p className="mt-1 text-xs text-zinc-400">Added {formatDate(item.created_at)}</p></div><div className="flex shrink-0 gap-3 text-sm"><button onClick={() => openDiscussion(item)} className="font-semibold text-zinc-700">Edit</button><button onClick={() => void archiveDiscussion(item)} className="font-semibold text-zinc-400 hover:text-red-700">Archive</button></div></div>) : <div className="p-4"><EmptyState title="Nothing pending" description="Add a discussion item when something needs to be raised in a future meeting." /></div>}</div>
      </section>
      <section className="rounded-[24px] border border-[var(--falcon-soft-border)] bg-white p-5 shadow-sm"><SectionHeader title="Open Action Items" description="Unresolved follow-ups across Leader Meetings." />
        <div className="mt-4 space-y-5">{[{ label: "Overdue", items: overdue }, { label: "Upcoming / Open", items: upcoming }].map((group) => group.items.length ? <div key={group.label}><p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">{group.label}</p><div className="divide-y divide-zinc-100 rounded-2xl border border-zinc-200">{group.items.map((item) => <div key={item.id} className="flex items-start gap-3 px-4 py-3"><input type="checkbox" aria-label={`Complete ${item.action}`} onChange={() => void completeAction(item)} className="mt-1 h-4 w-4 accent-[#8f6e35]" /><div className="min-w-0 flex-1"><p className="text-sm font-medium text-zinc-900">{item.action}</p><p className="mt-1 text-xs text-zinc-500">{item.assignees.map((assignee) => assignee.member_name_snapshot).join(" · ")}</p><p className="mt-1 text-xs text-zinc-500">Meeting: {item.meetingParticipants.map((participant) => participant.member_name_snapshot).join(" · ")} · Due {formatDate(item.due_date)}</p></div><Link href={`/team/leader-meetings/${item.meeting_id}`} className="shrink-0 text-xs font-semibold text-[var(--falcon-gold-dark)]">Meeting</Link></div>)}</div></div> : null)}{!overview.openActions.length ? <EmptyState title="No open actions" description="Action items created during meetings will appear here." /> : null}</div>
      </section>
      <section className="rounded-[24px] border border-[var(--falcon-soft-border)] bg-white p-5 shadow-sm"><SectionHeader title="Recent Meetings" description="Completed minutes and decisions." /><div className="mt-4 divide-y divide-zinc-100 rounded-2xl border border-zinc-200">{overview.recentMeetings.length ? overview.recentMeetings.map((meeting) => <Link key={meeting.id} href={`/team/leader-meetings/${meeting.id}`} className="flex items-center justify-between gap-4 px-4 py-3 transition hover:bg-zinc-50"><div><p className="font-semibold text-zinc-950">{meeting.participants.map((participant) => participant.member_name_snapshot).join(" · ")}</p><p className="mt-1 text-xs text-zinc-500">{formatDate(meeting.meeting_date)}</p></div><p className="text-right text-xs text-zinc-500">{meeting.topicCount} Topics · {meeting.decisionCount} Decisions · {meeting.openActionCount} Open Actions</p></Link>) : <p className="px-4 py-8 text-center text-sm text-zinc-500">No completed meetings yet.</p>}</div></section>
    </> : null}
    {discussionOpen ? <Modal title={editing ? "Edit Discussion Item" : "Add Discussion Item"} onClose={() => setDiscussionOpen(false)}><form onSubmit={saveDiscussion} className="space-y-4 p-5"><fieldset className="text-sm font-medium"><legend>Discuss With *</legend><MemberMultiSelect members={members} selectedIds={discussionForm.participantMemberIds} onChange={(participantMemberIds) => setDiscussionForm((current) => ({ ...current, participantMemberIds }))} /></fieldset><label className="block text-sm font-medium">Topic *<input value={discussionForm.topic} maxLength={240} onChange={(event) => setDiscussionForm((current) => ({ ...current, topic: event.target.value }))} className={inputClass} /></label><label className="block text-sm font-medium">Notes<textarea value={discussionForm.notes} maxLength={5000} rows={4} onChange={(event) => setDiscussionForm((current) => ({ ...current, notes: event.target.value }))} className={inputClass} /></label><label className="block text-sm font-medium">Priority<select value={discussionForm.priority} onChange={(event) => setDiscussionForm((current) => ({ ...current, priority: event.target.value }))} className={inputClass}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option></select></label><div className="flex justify-end gap-2 pt-2"><Button type="button" variant="secondary" onClick={() => setDiscussionOpen(false)}>Cancel</Button><Button disabled={saving || discussionForm.participantMemberIds.length === 0 || !discussionForm.topic.trim()}>{saving ? "Saving…" : "Save"}</Button></div></form></Modal> : null}
    {meetingOpen ? <Modal title="Start Meeting" onClose={() => setMeetingOpen(false)}><form onSubmit={startMeeting} className="space-y-4 p-5"><fieldset className="text-sm font-medium"><legend>Meeting With / Participants *</legend><MemberMultiSelect members={members} selectedIds={meetingForm.participantMemberIds} onChange={updateMeetingParticipants} /></fieldset><label className="block text-sm font-medium">Meeting Date *<input type="date" required value={meetingForm.meetingDate} onChange={(event) => setMeetingForm((current) => ({ ...current, meetingDate: event.target.value }))} className={inputClass} /></label><fieldset><legend className="text-sm font-medium">Discussion Topics</legend><p className="mt-1 text-xs leading-5 text-zinc-500">Choose the pending or deferred items that should be included. Items appear when they share at least one selected participant.</p><div className="mt-2 max-h-56 divide-y divide-zinc-100 overflow-y-auto rounded-2xl border border-zinc-200">{matchingDiscussionItems.length ? matchingDiscussionItems.map((item) => <label key={item.id} className="flex cursor-pointer items-start gap-3 px-3 py-3 text-sm"><input type="checkbox" checked={meetingForm.discussionItemIds.includes(item.id)} onChange={(event) => setMeetingForm((current) => ({ ...current, discussionItemIds: event.target.checked ? [...current.discussionItemIds, item.id] : current.discussionItemIds.filter((id) => id !== item.id) }))} className="mt-0.5 h-4 w-4 accent-[#8f6e35]" /><span><span className="block font-medium text-zinc-900">{item.topic}</span><span className="mt-0.5 block text-xs text-zinc-500">{item.participants.map((participant) => participant.member_name_snapshot).join(" · ")}</span></span></label>) : <p className="px-3 py-4 text-sm text-zinc-500">{meetingForm.participantMemberIds.length ? "No matching discussion items." : "Select participants to see matching discussion items."}</p>}</div></fieldset><div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setMeetingOpen(false)}>Cancel</Button><Button disabled={saving || meetingForm.participantMemberIds.length === 0}>{saving ? "Starting…" : "Start Meeting"}</Button></div></form></Modal> : null}
  </main>;
}
