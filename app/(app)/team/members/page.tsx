"use client";

import { useEffect, useMemo, useState } from "react";
import { createSupabaseClient } from "@/lib/supabase";

type MemberRecord = {
  id: string | number;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  employment_type: string | null;
  position: string | null;
  leader_id: string | number | null;
  join_date: string | null;
  status: string | null;
};

type MemberFormState = {
  full_name: string;
  email: string;
  phone: string;
  employment_type: string;
  position: string;
  leader_id: string;
  join_date: string;
  status: string;
};

const initialFormState: MemberFormState = {
  full_name: "",
  email: "",
  phone: "",
  employment_type: "Core Agent",
  position: "Team Leader",
  leader_id: "",
  join_date: "",
  status: "Active",
};

function getInitials(fullName: string | null) {
  if (!fullName) return "U";

  return fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export default function MembersPage() {
const [members, setMembers] = useState<MemberRecord[]>([]);
const [search, setSearch] = useState("");
const [positionFilter, setPositionFilter] = useState("All");
const [employmentFilter, setEmploymentFilter] = useState("All");
const [leaderFilter, setLeaderFilter] = useState("All");
const [statusFilter, setStatusFilter] = useState("All");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formState, setFormState] = useState<MemberFormState>(initialFormState);
  const [editingMemberId, setEditingMemberId] = useState<string | number | null>(null);
  const filteredMembers = members.filter((member) => {
  const matchSearch = (member.full_name ?? "")
    .toLowerCase()
    .includes(search.toLowerCase());

  const matchPosition =
    positionFilter === "All" ||
    member.position === positionFilter;

  const matchEmployment =
    employmentFilter === "All" ||
    member.employment_type === employmentFilter;

  const matchLeader =
    leaderFilter === "All" ||
    String(member.leader_id) === leaderFilter;

  const matchStatus =
    statusFilter === "All" ||
    member.status === statusFilter;

  return matchSearch && matchPosition && matchEmployment && matchLeader && matchStatus;
});
console.log(filteredMembers);
  useEffect(() => {
  console.log("editingMemberId changed:", editingMemberId);
}, [editingMemberId]);

  const fetchMembers = async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const supabase = createSupabaseClient();
      const { data, error } = await supabase
  .from("users")
  .select(`
  id,
  full_name,
  chinese_name,
  phone,
  email,
  birthday,
  join_date,
  position,
  employment_type,
  status,
  leader_id,
  avatar_url,
  created_at,
  updated_at
`)
  .eq("is_deleted", false)
  .order("join_date", { ascending: false });

      if (error) {
        throw error;
      }

      setMembers((data ?? []) as MemberRecord[]);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load members");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchMembers();
  }, []);

  const leaderMap = useMemo(() => {
    return new Map(
      members
        .filter((member) => !!member.full_name)
        .map((member) => [String(member.id), member.full_name as string]),
    );
  }, [members]);

  const summaryCards = useMemo(() => {
    const totalMembers = members.length;
    const activeMembers = members.filter(
      (member) => (member.status || "").toLowerCase() === "active",
    ).length;
    const coreAgents = members.filter(
      (member) => (member.employment_type || "").toLowerCase() === "core agent",
    ).length;
    const partTimeAgents = members.filter(
      (member) => (member.employment_type || "").toLowerCase() === "part time agent",
    ).length;

    return [
      { label: "Total Members", value: String(totalMembers), detail: "Across all teams" },
      { label: "Active Members", value: String(activeMembers), detail: "Engaged this month" },
      { label: "Core Agents", value: String(coreAgents), detail: "Primary operators" },
      { label: "Part Time Agents", value: String(partTimeAgents), detail: "Flexible support" },
    ];
  }, [members]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

  setIsSubmitting(true);
  setErrorMessage(null);

  try {
    const payload = {
      full_name: formState.full_name.trim(),
      email: formState.email.trim() || null,
      phone: formState.phone.trim() || null,
      employment_type: formState.employment_type || null,
      position: formState.position || null,
      leader_id: formState.leader_id || null,
      join_date: formState.join_date || null,
      status: formState.status || "Active",
    };

    const url = editingMemberId
  ? `/api/members/${editingMemberId}`
  : "/api/members";

const method = editingMemberId ? "PATCH" : "POST";

console.log("========== HANDLE SUBMIT ==========");
console.log("editingMemberId:", editingMemberId);
console.log("method:", method);
console.log("url:", url);

const response = await fetch(url, {
  method,
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify(payload),
});

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Unable to create member");
    }

    setFormState(initialFormState);
    setIsDrawerOpen(false);

    await fetchMembers();
  } catch (error) {
    setErrorMessage(
      error instanceof Error
        ? error.message
        : "Unable to create member"
    );
  } finally {
    setIsSubmitting(false);
  }
};
const handleDelete = async (id: string | number) => {
  const confirmed = window.confirm(
    "Are you sure you want to delete this member?"
  );

  if (!confirmed) return;

  try {
    const response = await fetch(`/api/members/${id}`, {
      method: "DELETE",
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Unable to delete member");
    }

    await fetchMembers();
  } catch (error) {
    setErrorMessage(
      error instanceof Error
        ? error.message
        : "Unable to delete member"
    );
  }
};

  return (
    <>
          <header className="flex items-center justify-between border-b border-zinc-200 bg-white/80 px-6 py-4 backdrop-blur">
            <div>
              <p className="text-sm text-zinc-500">Team • Members</p>
              <p className="text-base font-semibold text-zinc-900">Team Management</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsDrawerOpen(true)}
                className="rounded-full border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm font-medium text-zinc-700"
              >
                + Add Member
              </button>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 text-sm font-semibold text-white">
                N
              </div>
            </div>
          </header>

          <main className="p-6 lg:p-8">
            <section className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-sm font-medium uppercase tracking-[0.24em] text-zinc-500">
                    Team Directory
                  </p>
                  <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">
                    Members
                  </h1>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-600">
                    A live view of the people supporting Falcon Hub, sourced directly from Supabase.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDrawerOpen(true)}
                  className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
                >
                  + Add Member
                </button>
              </div>
            </section>

            <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {summaryCards.map((card) => (
                <div
                  key={card.label}
                  className="rounded-[24px] border border-zinc-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]"
                >
                  <p className="text-sm text-zinc-500">{card.label}</p>
                  <p className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">
                    {card.value}
                  </p>
                  <p className="mt-2 text-sm text-zinc-600">{card.detail}</p>
                </div>
              ))}
            </section>

            <section className="mt-8 rounded-[28px] border border-zinc-200 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <label className="rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
                  <span className="mb-1 block text-xs uppercase tracking-[0.24em] text-zinc-400">
                    Search Member
                  </span>
                  <input className="w-full bg-transparent outline-none" placeholder="Search" value={search}
  onChange={(event) => setSearch(event.target.value)}
/>
                </label>
                <label className="rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
                  <span className="mb-1 block text-xs uppercase tracking-[0.24em] text-zinc-400">
                    Position
                  </span>
                  <select
                    className="w-full bg-transparent outline-none"
                    value={positionFilter}
                    onChange={(event) => setPositionFilter(event.target.value)}
                  >
                    <option value="All">All</option>
                    <option value="Managing Partner">Managing Partner</option>
                    <option value="Project Manager">Project Manager</option>
                    <option value="Group Leader">Group Leader</option>
                    <option value="Senior Team Leader">Senior Team Leader</option>
                    <option value="Team Leader">Team Leader</option>
                    <option value="Senior REN">Senior REN</option>
                    <option value="REN 75">REN 75</option>
                    <option value="REN 70">REN 70</option>
                  </select>
                </label>
                <label className="rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
                  <span className="mb-1 block text-xs uppercase tracking-[0.24em] text-zinc-400">
                    Employment Type
                  </span>
                  <select
                    className="w-full bg-transparent outline-none"
                    value={employmentFilter}
                    onChange={(event) => setEmploymentFilter(event.target.value)}
                  >
                    <option value="All">All</option>
                    <option value="Core Agent">Core Agent</option>
                    <option value="Part Time Agent">Part Time Agent</option>
                  </select>
                </label>
                <label className="rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
                  <span className="mb-1 block text-xs uppercase tracking-[0.24em] text-zinc-400">
                    Leader
                  </span>
                  <select
                    className="w-full bg-transparent outline-none"
                    value={leaderFilter}
                    onChange={(event) => setLeaderFilter(event.target.value)}
                  >
                    <option value="All">All</option>
                    {members.map((member) => (
                      <option key={String(member.id)} value={String(member.id)}>
                        {member.full_name || "Unnamed member"}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
                  <span className="mb-1 block text-xs uppercase tracking-[0.24em] text-zinc-400">
                    Status
                  </span>
                  <select
                    className="w-full bg-transparent outline-none"
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                  >
                    <option value="All">All</option>
                    <option value="Active">Active</option>
                    <option value="Review">Review</option>
                    <option value="Pending">Pending</option>
                  </select>
                </label>
              </div>

              {errorMessage ? (
                <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {errorMessage}
                </div>
              ) : null}

              <div className="mt-4 overflow-hidden rounded-[24px] border border-zinc-200">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-zinc-200">
                    <thead className="bg-zinc-50">
                      <tr>
                        {[
                          "Avatar",
                          "Full Name",
                          "Position",
                          "Employment Type",
                          "Leader",
                          "Join Date",
                          "Status",
                          "Actions",
                        ].map((heading) => (
                          <th
                            key={heading}
                            className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500"
                          >
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 bg-white">
                      {isLoading ? (
                        <tr>
                          <td colSpan={8} className="px-4 py-10 text-center text-sm text-zinc-600">
                            Loading members...
                          </td>
                        </tr>
                      ) : filteredMembers.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-4 py-10 text-center text-sm text-zinc-600">
                            No members found.
                          </td>
                        </tr>
                      ) : (
                        filteredMembers.map((member) => (
                          <tr key={String(member.id)} className="text-sm text-zinc-700">
                            <td className="px-4 py-4">
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 text-sm font-semibold text-white">
                                {getInitials(member.full_name)}
                              </div>
                            </td>
                            <td className="px-4 py-4 font-medium text-zinc-900">
                              {member.full_name || "Unnamed member"}
                            </td>
                            <td className="px-4 py-4">{member.position || "—"}</td>
                            <td className="px-4 py-4">{member.employment_type || "—"}</td>
                            <td className="px-4 py-4">
                              {member.leader_id ? leaderMap.get(String(member.leader_id)) || "—" : "—"}
                            </td>
                            <td className="px-4 py-4">{member.join_date || "—"}</td>
                            <td className="px-4 py-4">
                              <span
                                className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                                  (member.status || "").toLowerCase() === "active"
                                    ? "bg-emerald-50 text-emerald-700"
                                    : "bg-amber-50 text-amber-700"
                                }`}
                              >
                                {member.status || "Pending"}
                              </span>
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex gap-3">
  <button
    type="button"
    onClick={() => {
      setEditingMemberId(member.id);

      setFormState({
        full_name: member.full_name || "",
        email: member.email || "",
        phone: member.phone || "",
        employment_type: member.employment_type || "Core Agent",
        position: member.position || "Team Leader",
        leader_id: member.leader_id ? String(member.leader_id) : "",
        join_date: member.join_date || "",
        status: member.status || "Active",
      });

      setIsDrawerOpen(true);
    }}
    className="text-sm font-medium text-blue-600 hover:text-blue-800"
  >
    EDIT
  </button>
  <button
  type="button"
  onClick={() => handleDelete(member.id)}
  className="text-sm font-medium text-red-600 hover:text-red-800"
>
  DELETE
</button>
</div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </main>

      <div
        className={`fixed inset-0 z-40 bg-black/20 transition ${
          isDrawerOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setIsDrawerOpen(false)}
      />

      <aside
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-zinc-200 bg-white shadow-[0_20px_80px_rgba(15,23,42,0.2)] transition-transform ${
          isDrawerOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-5">
          <div>
            <p className="text-sm text-zinc-500">
  {editingMemberId ? "Edit Member" : "New Member"}
</p>

<h2 className="text-xl font-semibold text-zinc-950">
  {editingMemberId ? "Edit Member" : "Add Member"}
</h2>
          </div>
          <button
            type="button"
            onClick={() => setIsDrawerOpen(false)}
            className="rounded-full border border-zinc-200 px-3 py-2 text-sm text-zinc-600"
          >
            Close
          </button>
        </div>

        <form
  onSubmit={(e) => {
    console.log("editingMemberId =", editingMemberId);
    handleSubmit(e);
  }}
>
          <label className="block text-sm text-zinc-600">
            <span className="mb-1 block font-medium text-zinc-900">Full Name</span>
            <input
              required
              value={formState.full_name}
              onChange={(event) =>
                setFormState((current) => ({ ...current, full_name: event.target.value }))
              }
              className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 outline-none"
              placeholder="Full name"
            />
          </label>
          <label className="block text-sm text-zinc-600">
            <span className="mb-1 block font-medium text-zinc-900">Email</span>
            <input
              type="email"
              value={formState.email}
              onChange={(event) => setFormState((current) => ({ ...current, email: event.target.value }))}
              className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 outline-none"
              placeholder="name@company.com"
            />
          </label>
          <label className="block text-sm text-zinc-600">
            <span className="mb-1 block font-medium text-zinc-900">Phone</span>
            <input
              value={formState.phone}
              onChange={(event) => setFormState((current) => ({ ...current, phone: event.target.value }))}
              className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 outline-none"
              placeholder="Phone"
            />
          </label>
          <label className="block text-sm text-zinc-600">
            <span className="mb-1 block font-medium text-zinc-900">Employment Type</span>
            <select
              value={formState.employment_type}
              onChange={(event) =>
                setFormState((current) => ({ ...current, employment_type: event.target.value }))
              }
              className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 outline-none"
            >
              <option value="Core Agent">Core Agent</option>
              <option value="Part Time Agent">Part Time Agent</option>
            </select>
          </label>
          <label className="block text-sm text-zinc-600">
            <span className="mb-1 block font-medium text-zinc-900">Position</span>
            <select
              value={formState.position}
              onChange={(event) =>
                setFormState((current) => ({ ...current, position: event.target.value }))
              }
              className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 outline-none"
            >
              <option value="Managing Partner">Managing Partner</option>
              <option value="Project Manager">Project Manager</option>
              <option value="Group Leader">Group Leader</option>
              <option value="Senior Team Leader">Senior Team Leader</option>
              <option value="Team Leader">Team Leader</option>
              <option value="Senior REN">Senior REN</option>
              <option value="REN 75">REN 75</option>
              <option value="REN 70">REN 70</option>
            </select>
          </label>
          <label className="block text-sm text-zinc-600">
            <span className="mb-1 block font-medium text-zinc-900">Leader</span>
            <select
              value={formState.leader_id}
              onChange={(event) =>
                setFormState((current) => ({ ...current, leader_id: event.target.value }))
              }
              className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 outline-none"
            >
              <option value="">No leader</option>
              {members.map((member) => (
                <option key={String(member.id)} value={String(member.id)}>
                  {member.full_name || "Unnamed member"}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm text-zinc-600">
            <span className="mb-1 block font-medium text-zinc-900">Join Date</span>
            <input
              type="date"
              value={formState.join_date}
              onChange={(event) =>
                setFormState((current) => ({ ...current, join_date: event.target.value }))
              }
              className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 outline-none"
            />
          </label>
          <label className="block text-sm text-zinc-600">
            <span className="mb-1 block font-medium text-zinc-900">Status</span>
            <select
              value={formState.status}
              onChange={(event) =>
                setFormState((current) => ({ ...current, status: event.target.value }))
              }
              className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 outline-none"
            >
              <option value="Active">Active</option>
              <option value="Review">Review</option>
              <option value="Pending">Pending</option>
            </select>
          </label>

          {errorMessage ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-3 border-t border-zinc-200 pt-4">
            <button
              type="button"
              onClick={() => setIsDrawerOpen(false)}
              className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting
  ? "Saving..."
  : editingMemberId
      ? "Save Changes"
      : "Save Member"}
            </button>
          </div>
        </form>
      </aside>
    </>
  );
}
