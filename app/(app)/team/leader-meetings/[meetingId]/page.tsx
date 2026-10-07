"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button, EmptyState, PageHeader, SectionHeader, StatusBadge } from "../../../components/ui";
import { LeaderMeetingMemberOption, MemberMultiSelect } from "../MemberMultiSelect";

type Meeting = { id: string; participants: { id: string; member_id: string; member_name_snapshot: string }[]; meeting_date: string; status: "draft" | "in_progress" | "completed" | "cancelled"; general_minutes: string | null; additional_notes: string | null; completed_at: string | null };
type Topic = { id: string; discussion_item_id: string | null; topic_snapshot: string; source_notes_snapshot: string | null; discussion_notes: string | null; decision_outcome: string | null; outcome_status: "discussed" | "resolved" | "deferred"; sort_order: number };
type ActionAssignee = { id: string; member_id: string; member_name_snapshot: string };
type Action = { id: string; meeting_topic_id: string | null; action: string; assignees: ActionAssignee[]; due_date: string | null; status: "open" | "completed" | "cancelled"; completed_at: string | null };
type Detail = { meeting: Meeting; topics: Topic[]; actions: Action[] };
type ActionForm = { action: string; assigneeMemberIds: string[]; dueDate: string; meetingTopicId: string };

const inputClass = "mt-2 min-h-11 w-full rounded-2xl border border-[var(--falcon-soft-border)] bg-[#fafaf8] px-4 py-3 text-sm outline-none focus:border-[var(--falcon-gold-dark)] focus:bg-white";

function formatDate(value: string | null, withTime = false) {
  if (!value) return "—";
  const date = value.length === 10 ? new Date(`${value}T00:00:00+08:00`) : new Date(value);
  return new Intl.DateTimeFormat("en-MY", { day: "numeric", month: "long", year: "numeric", ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}), timeZone: "Asia/Kuala_Lumpur" }).format(date);
}

export default function LeaderMeetingPage() {
  const { meetingId } = useParams<{ meetingId: string }>();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [members, setMembers] = useState<LeaderMeetingMemberOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [generalMinutes, setGeneralMinutes] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [topics, setTopics] = useState<Topic[]>([]);
  const [newTopic, setNewTopic] = useState("");
  const [actionForm, setActionForm] = useState<ActionForm>({ action: "", assigneeMemberIds: [], dueDate: "", meetingTopicId: "" });

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [detailResponse, memberResponse] = await Promise.all([fetch(`/api/leader-meetings/meetings/${meetingId}`, { cache: "no-store" }), fetch("/api/leader-meetings/member-options", { cache: "no-store" })]);
      const [detailPayload, memberPayload] = await Promise.all([detailResponse.json(), memberResponse.json()]);
      if (!detailResponse.ok) throw new Error(detailPayload.error || "Unable to load meeting");
      if (!memberResponse.ok) throw new Error(memberPayload.error || "Unable to load members");
      const next = detailPayload as Detail;
      setDetail(next); setTopics(next.topics); setGeneralMinutes(next.meeting.general_minutes ?? ""); setAdditionalNotes(next.meeting.additional_notes ?? ""); setMembers(memberPayload.members ?? []);
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Unable to load meeting"); }
    finally { setLoading(false); }
  }, [meetingId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [load]);

  function topicPayload() {
    return topics.map((topic) => ({ id: topic.id, discussionNotes: topic.discussion_notes ?? "", decisionOutcome: topic.decision_outcome ?? "", outcomeStatus: topic.outcome_status }));
  }

  async function saveDraft() {
    setSaving(true); setError("");
    try {
      const response = await fetch(`/api/leader-meetings/meetings/${meetingId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ generalMinutes, additionalNotes, topics: topicPayload() }) });
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "Unable to save draft"); await load();
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Unable to save draft"); }
    finally { setSaving(false); }
  }

  async function completeMeeting() {
    if (!window.confirm("Complete this meeting and preserve it as historical Minutes?")) return;
    setSaving(true); setError("");
    try {
      const response = await fetch(`/api/leader-meetings/meetings/${meetingId}/complete`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ generalMinutes, additionalNotes, topics: topicPayload() }) });
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "Unable to complete meeting"); await load();
    } catch (completeError) { setError(completeError instanceof Error ? completeError.message : "Unable to complete meeting"); }
    finally { setSaving(false); }
  }

  async function addTopic(event: FormEvent) {
    event.preventDefault(); if (!newTopic.trim()) return;
    const response = await fetch(`/api/leader-meetings/meetings/${meetingId}/topics`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic: newTopic }) });
    const payload = await response.json(); if (!response.ok) setError(payload.error || "Unable to add topic"); else { setNewTopic(""); await load(); }
  }

  async function addAction(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const response = await fetch(`/api/leader-meetings/meetings/${meetingId}/action-items`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(actionForm) });
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "Unable to add action item"); setActionForm({ action: "", assigneeMemberIds: [], dueDate: "", meetingTopicId: "" }); await load();
    } catch (actionError) { setError(actionError instanceof Error ? actionError.message : "Unable to add action item"); }
    finally { setSaving(false); }
  }

  async function setActionStatus(action: Action, status: Action["status"]) {
    const response = await fetch(`/api/leader-meetings/action-items/${action.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    if (response.ok) await load(); else setError((await response.json()).error || "Unable to update action item");
  }

  if (loading && !detail) return <main className="p-8 text-center text-sm text-zinc-500">Loading meeting…</main>;
  if (!detail) return <main className="p-8"><p className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error || "Meeting not found"}</p></main>;
  const completed = detail.meeting.status === "completed";

  return <main className="space-y-5 px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
    <Link href="/team/leader-meetings" className="text-sm font-semibold text-zinc-500 hover:text-zinc-900">← Leader Meetings</Link>
    <PageHeader eyebrow={completed ? "Historical Minutes" : "Meeting Workspace"} title="Meeting" description={formatDate(detail.meeting.meeting_date)} meta={<StatusBadge variant={completed ? "success" : "accent"}>{completed ? "Completed" : "In Progress"}</StatusBadge>} actions={!completed ? <div className="flex flex-wrap gap-2"><Button variant="secondary" disabled={saving} onClick={() => void saveDraft()}>Save Draft</Button><Button disabled={saving} onClick={() => void completeMeeting()}>Complete Meeting</Button></div> : null} />
    <p className="rounded-2xl border border-[var(--falcon-soft-border)] bg-white px-4 py-3 text-sm text-zinc-700"><span className="font-semibold text-zinc-950">Participants:</span> {detail.meeting.participants.map((participant) => participant.member_name_snapshot).join(" · ")}</p>
    {error ? <p className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p> : null}
    {completed ? <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Completed {formatDate(detail.meeting.completed_at, true)}. Minutes are read-only; action statuses remain follow-up items.</p> : null}

    <section className="rounded-[24px] border border-[var(--falcon-soft-border)] bg-white p-5 shadow-sm"><SectionHeader title="Topics" description={completed ? "Historical discussion and decision snapshots." : "Record discussion, decisions and the outcome for each topic."} />
      <div className="mt-5 space-y-4">{topics.length ? topics.map((topic, index) => <article key={topic.id} className="rounded-2xl border border-zinc-200 p-4"><div className="flex items-start gap-3"><span className="text-sm font-semibold text-[var(--falcon-gold-dark)]">{String(index + 1).padStart(2, "0")}</span><div className="min-w-0 flex-1"><h3 className="font-semibold text-zinc-950">{topic.topic_snapshot}</h3>{topic.source_notes_snapshot ? <div className="mt-3 rounded-xl bg-[#faf9f5] px-3 py-2"><p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Original Note</p><p className="mt-1 whitespace-pre-wrap text-sm text-zinc-700">{topic.source_notes_snapshot}</p></div> : null}</div></div>
        {completed ? <div className="mt-4 grid gap-4 sm:grid-cols-2"><div><p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Discussion</p><p className="mt-1 whitespace-pre-wrap text-sm text-zinc-800">{topic.discussion_notes || "—"}</p></div><div><p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Decision / Outcome</p><p className="mt-1 whitespace-pre-wrap text-sm text-zinc-800">{topic.decision_outcome || "—"}</p></div><StatusBadge variant={topic.outcome_status === "resolved" ? "success" : topic.outcome_status === "deferred" ? "warning" : "neutral"}>{topic.outcome_status}</StatusBadge></div> : <div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">Discussion<textarea rows={4} maxLength={10000} value={topic.discussion_notes ?? ""} onChange={(event) => setTopics((current) => current.map((item) => item.id === topic.id ? { ...item, discussion_notes: event.target.value } : item))} className={inputClass} /></label><label className="text-sm font-medium">Decision / Outcome<textarea rows={4} maxLength={10000} value={topic.decision_outcome ?? ""} onChange={(event) => setTopics((current) => current.map((item) => item.id === topic.id ? { ...item, decision_outcome: event.target.value } : item))} className={inputClass} /></label><label className="text-sm font-medium sm:col-span-2">Outcome<select value={topic.outcome_status} onChange={(event) => setTopics((current) => current.map((item) => item.id === topic.id ? { ...item, outcome_status: event.target.value as Topic["outcome_status"] } : item))} className={inputClass}><option value="discussed">Discussed</option><option value="resolved">Resolved</option><option value="deferred">Deferred</option></select></label></div>}
      </article>) : <EmptyState title="No topics yet" description="Add an ad-hoc topic below." />}</div>
      {!completed ? <form onSubmit={addTopic} className="mt-4 flex flex-col gap-2 sm:flex-row"><input value={newTopic} maxLength={240} onChange={(event) => setNewTopic(event.target.value)} placeholder="Add an ad-hoc topic..." className="min-h-11 min-w-0 flex-1 rounded-2xl border border-zinc-200 px-4 text-sm outline-none focus:border-[var(--falcon-gold-dark)]" /><Button disabled={!newTopic.trim()}>+ Add Topic</Button></form> : null}
    </section>

    <section className="rounded-[24px] border border-[var(--falcon-soft-border)] bg-white p-5 shadow-sm"><SectionHeader title="General Minutes" />{completed ? <div className="mt-4 grid gap-5 sm:grid-cols-2"><div><p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">General Minutes</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-800">{detail.meeting.general_minutes || "—"}</p></div><div><p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Additional Notes</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-800">{detail.meeting.additional_notes || "—"}</p></div></div> : <div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">General Minutes<textarea rows={7} maxLength={20000} value={generalMinutes} onChange={(event) => setGeneralMinutes(event.target.value)} className={inputClass} /></label><label className="text-sm font-medium">Additional Notes<textarea rows={7} maxLength={10000} value={additionalNotes} onChange={(event) => setAdditionalNotes(event.target.value)} className={inputClass} /></label></div>}</section>

    <section className="rounded-[24px] border border-[var(--falcon-soft-border)] bg-white p-5 shadow-sm"><SectionHeader title="Action Items" description="Action assignees do not receive Leader Meetings access." />
      <div className="mt-4 divide-y divide-zinc-100 rounded-2xl border border-zinc-200">{detail.actions.length ? detail.actions.map((action) => <div key={action.id} className="flex items-start gap-3 px-4 py-3"><input type="checkbox" checked={action.status === "completed"} disabled={action.status === "cancelled"} onChange={(event) => void setActionStatus(action, event.target.checked ? "completed" : "open")} className="mt-1 h-4 w-4 accent-[#8f6e35]" /><div className="min-w-0 flex-1"><p className={`text-sm font-medium ${action.status === "completed" ? "text-zinc-400 line-through" : "text-zinc-900"}`}>{action.action}</p><p className="mt-1 text-xs text-zinc-500"><span className="font-medium text-zinc-600">Assigned To:</span> {action.assignees.map((assignee) => assignee.member_name_snapshot).join(" · ")} · Due {formatDate(action.due_date)}</p></div><StatusBadge variant={action.status === "completed" ? "success" : action.status === "cancelled" ? "neutral" : "warning"}>{action.status}</StatusBadge></div>) : <p className="px-4 py-6 text-center text-sm text-zinc-500">No action items.</p>}</div>
      {!completed ? <form onSubmit={addAction} className="mt-5 grid gap-4 rounded-2xl border border-[#e4d7b7] bg-[#fbf8ef] p-4 sm:grid-cols-2"><label className="text-sm font-medium sm:col-span-2">Action *<input value={actionForm.action} maxLength={500} onChange={(event) => setActionForm((current) => ({ ...current, action: event.target.value }))} className={inputClass} /></label><fieldset className="min-w-0 text-sm font-medium"><legend>Assigned To *</legend><MemberMultiSelect members={members} selectedIds={actionForm.assigneeMemberIds} onChange={(assigneeMemberIds) => setActionForm((current) => ({ ...current, assigneeMemberIds }))} /></fieldset><label className="text-sm font-medium">Due Date<input type="date" value={actionForm.dueDate} onChange={(event) => setActionForm((current) => ({ ...current, dueDate: event.target.value }))} className={inputClass} /></label><label className="text-sm font-medium sm:col-span-2">Related Topic<select value={actionForm.meetingTopicId} onChange={(event) => setActionForm((current) => ({ ...current, meetingTopicId: event.target.value }))} className={inputClass}><option value="">Meeting-level action</option>{topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.topic_snapshot}</option>)}</select></label><div className="sm:col-span-2"><Button disabled={saving || !actionForm.action.trim() || actionForm.assigneeMemberIds.length === 0}>+ Add Action</Button></div></form> : null}
    </section>
  </main>;
}
