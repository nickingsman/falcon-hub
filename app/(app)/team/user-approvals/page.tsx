"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import type { UserRole } from "@/lib/auth";
import { formatMemberDisplayName } from "@/lib/member-display";
import { employmentTypeOptions, falconPositionRankings } from "@/lib/member-options";
import { useAppPermissions } from "../../components/AppPermissionProvider";

type PendingRegistration = {
  auth_user_id: string;
  email: string | null;
  created_at: string;
  status: string;
};

type LeaderOption = {
  id: string;
  member_code: number | null;
  full_name: string | null;
  position: string | null;
  employment_type: string | null;
};

type ApprovalResponse = {
  pendingRegistrations: PendingRegistration[];
  assignableRoles: UserRole[];
  leaderOptions: LeaderOption[];
};

type ApprovalForm = {
  role: UserRole | "";
  position: string;
  employment_type: string;
  leader_id: string;
  join_date: string;
};

const emptyApprovalForm: ApprovalForm = {
  role: "",
  position: "",
  employment_type: "",
  leader_id: "",
  join_date: "",
};

const roleLabels: Record<UserRole, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  leader: "Leader",
  agent: "Agent",
};

function formatDate(value: string) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("en-MY", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(new Date(value));
}

export default function UserApprovalsPage() {
  const { canManageUserApprovals } = useAppPermissions();
  const [pendingRegistrations, setPendingRegistrations] = useState<PendingRegistration[]>([]);
  const [assignableRoles, setAssignableRoles] = useState<UserRole[]>([]);
  const [leaderOptions, setLeaderOptions] = useState<LeaderOption[]>([]);
  const [selectedRegistration, setSelectedRegistration] = useState<PendingRegistration | null>(null);
  const [approvalForm, setApprovalForm] = useState<ApprovalForm>(emptyApprovalForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const fetchApprovals = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage("");

      const response = await fetch("/api/admin/user-approvals", {
        cache: "no-store",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to load user approvals");
      }

      const approvalData = result as ApprovalResponse;

      setPendingRegistrations(approvalData.pendingRegistrations ?? []);
      setAssignableRoles(approvalData.assignableRoles ?? []);
      setLeaderOptions(approvalData.leaderOptions ?? []);
    } catch (error) {
      console.error("Load user approvals error:", error);

      setErrorMessage(
        error instanceof Error ? error.message : "Unable to load user approvals"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchApprovals();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [fetchApprovals]);

  function openApprovalModal(registration: PendingRegistration) {
    if (!canManageUserApprovals) return;

    setSelectedRegistration(registration);
    setApprovalForm({
      ...emptyApprovalForm,
      role: assignableRoles[0] ?? "",
      position: falconPositionRankings[0].value,
      employment_type: employmentTypeOptions[0],
    });
    setErrorMessage("");
  }

  function closeApprovalModal() {
    if (saving) return;

    setSelectedRegistration(null);
    setApprovalForm(emptyApprovalForm);
    setErrorMessage("");
  }

  function updateApprovalField(field: keyof ApprovalForm, value: string) {
    setApprovalForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleApprove(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedRegistration || !canManageUserApprovals) return;

    try {
      setSaving(true);
      setErrorMessage("");

      const response = await fetch(
        `/api/admin/user-approvals/${selectedRegistration.auth_user_id}/approve`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            role: approvalForm.role,
            position: approvalForm.position,
            employment_type: approvalForm.employment_type,
            leader_id: approvalForm.leader_id || null,
            join_date: approvalForm.join_date,
          }),
        }
      );
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to approve registration");
      }

      closeApprovalModal();
      await fetchApprovals();
    } catch (error) {
      console.error("Approve registration error:", error);

      setErrorMessage(
        error instanceof Error ? error.message : "Unable to approve registration"
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleReject(registration: PendingRegistration) {
    if (!canManageUserApprovals) return;

    const confirmed = window.confirm(
      `Reject registration for ${registration.email || "this user"}?`
    );

    if (!confirmed) return;

    try {
      setSaving(true);
      setErrorMessage("");

      const response = await fetch(
        `/api/admin/user-approvals/${registration.auth_user_id}/reject`,
        {
          method: "POST",
        }
      );
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to reject registration");
      }

      await fetchApprovals();
    } catch (error) {
      console.error("Reject registration error:", error);

      setErrorMessage(
        error instanceof Error ? error.message : "Unable to reject registration"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white/80 px-6 py-4 backdrop-blur">
        <div>
          <p className="text-sm text-zinc-500">Team - User Approvals</p>
          <p className="text-base font-semibold text-zinc-900">Registration Review</p>
        </div>
      </header>

      <main className="p-6 lg:p-8">
        <section className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.24em] text-zinc-500">
                Pending Approval
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">
                User Approvals
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-600">
                Review new Falcon Hub registrations and assign company access details.
              </p>
            </div>
          </div>

          {errorMessage && !selectedRegistration ? (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </div>
          ) : null}

          <div className="mt-6 overflow-hidden rounded-2xl border border-zinc-200">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Registration Date</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-zinc-500">
                      Loading pending registrations...
                    </td>
                  </tr>
                ) : pendingRegistrations.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-zinc-500">
                      No pending registrations.
                    </td>
                  </tr>
                ) : (
                  pendingRegistrations.map((registration) => (
                    <tr
                      key={registration.auth_user_id}
                      className="border-b border-zinc-100 last:border-0"
                    >
                      <td className="px-4 py-4 font-medium text-zinc-900">
                        {registration.email || "-"}
                      </td>
                      <td className="px-4 py-4 text-zinc-600">
                        {formatDate(registration.created_at)}
                      </td>
                      <td className="px-4 py-4">
                        <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700">
                          {registration.status}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        {canManageUserApprovals ? (
                          <div className="flex items-center gap-4">
                            <button
                              type="button"
                              onClick={() => openApprovalModal(registration)}
                              className="text-sm font-medium text-zinc-700 hover:text-black"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => handleReject(registration)}
                              disabled={saving}
                              className="text-sm font-medium text-red-500 hover:text-red-700 disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-zinc-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {selectedRegistration ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-5">
              <div>
                <h2 className="text-xl font-semibold text-zinc-900">
                  Approve Registration
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  {selectedRegistration.email || "Pending user"}
                </p>
              </div>
              <button
                type="button"
                onClick={closeApprovalModal}
                className="text-2xl leading-none text-zinc-400 hover:text-zinc-900"
              >
                x
              </button>
            </div>

            <form onSubmit={handleApprove}>
              <div className="space-y-5 px-6 py-6">
                <div className="grid gap-5 md:grid-cols-2">
                  <label className="block text-sm text-zinc-600">
                    <span className="mb-2 block font-medium text-zinc-900">
                      Role *
                    </span>
                    <select
                      required
                      value={approvalForm.role}
                      onChange={(event) => updateApprovalField("role", event.target.value)}
                      className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none focus:border-zinc-900"
                    >
                      {assignableRoles.map((role) => (
                        <option key={role} value={role}>
                          {roleLabels[role]}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block text-sm text-zinc-600">
                    <span className="mb-2 block font-medium text-zinc-900">
                      Join Date *
                    </span>
                    <input
                      type="date"
                      required
                      value={approvalForm.join_date}
                      onChange={(event) => updateApprovalField("join_date", event.target.value)}
                      className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm outline-none focus:border-zinc-900"
                    />
                  </label>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <label className="block text-sm text-zinc-600">
                    <span className="mb-2 block font-medium text-zinc-900">
                      Position *
                    </span>
                    <select
                      required
                      value={approvalForm.position}
                      onChange={(event) => updateApprovalField("position", event.target.value)}
                      className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none focus:border-zinc-900"
                    >
                      {falconPositionRankings.map((position) => (
                        <option key={position.value} value={position.value}>
                          {position.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block text-sm text-zinc-600">
                    <span className="mb-2 block font-medium text-zinc-900">
                      Employment Type *
                    </span>
                    <select
                      required
                      value={approvalForm.employment_type}
                      onChange={(event) => updateApprovalField("employment_type", event.target.value)}
                      className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none focus:border-zinc-900"
                    >
                      {employmentTypeOptions.map((employmentType) => (
                        <option key={employmentType} value={employmentType}>
                          {employmentType}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="block text-sm text-zinc-600">
                  <span className="mb-2 block font-medium text-zinc-900">
                    Leader
                  </span>
                  <select
                    value={approvalForm.leader_id}
                    onChange={(event) => updateApprovalField("leader_id", event.target.value)}
                    className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none focus:border-zinc-900"
                  >
                    <option value="">No leader</option>
                    {leaderOptions.map((leader) => (
                      <option key={leader.id} value={leader.id}>
                        {formatMemberDisplayName(leader)}
                        {leader.position ? ` - ${leader.position}` : ""}
                      </option>
                    ))}
                  </select>
                </label>

                {errorMessage ? (
                  <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
                    {errorMessage}
                  </div>
                ) : null}
              </div>

              <div className="flex justify-end gap-3 border-t border-zinc-200 px-6 py-4">
                <button
                  type="button"
                  onClick={closeApprovalModal}
                  disabled={saving}
                  className="rounded-xl border border-zinc-300 px-5 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-zinc-900 px-5 py-3 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? "Approving..." : "Approve"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
