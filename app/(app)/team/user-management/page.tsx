"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { UserRole, UserProfileStatus } from "@/lib/auth";
import { useAppPermissions } from "@/app/(app)/components/AppPermissionProvider";
import { formatMemberCode, formatMemberDisplayName } from "@/lib/member-display";
import {
  employmentTypeOptions,
  falconPositionRankings,
  memberPositionOptions,
  memberStatusOptions,
} from "@/lib/member-options";
import InvitationManagement from "./InvitationManagement";

type ManagedMember = {
  id: string;
  member_code: number | null;
  full_name: string | null;
  display_name: string | null;
  chinese_name: string | null;
  email: string | null;
  position: string | null;
  employment_type: string | null;
  leader_id: string | null;
  join_date: string | null;
  status: string | null;
};

type ManagedAccount = {
  authUserId: string;
  authEmail: string | null;
  authCreatedAt: string;
  role: UserRole;
  accountStatus: UserProfileStatus;
  member: ManagedMember | null;
  actionPermissions: {
    canEditRole: boolean;
    canEditMemberProfile: boolean;
    canDeactivateAccess: boolean;
    canReactivateAccess: boolean;
  };
};

type MemberWithoutAccount = {
  member: ManagedMember;
  falconHubAccess: "No Account";
};

type LeaderOption = {
  id: string;
  member_code: number | null;
  full_name: string | null;
  display_name: string | null;
  position: string | null;
  employment_type: string | null;
};

type UserManagementResponse = {
  accounts: ManagedAccount[];
  membersWithoutAccounts: MemberWithoutAccount[];
  assignableRoles: UserRole[];
  leaderOptions: LeaderOption[];
};

type EditForm = {
  role: UserRole;
  display_name: string;
  position: string;
  employment_type: string;
  leader_id: string;
  join_date: string;
  status: string;
};

const roleLabels: Record<UserRole, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  leader: "Leader",
  agent: "Agent",
};

const accountStatusLabels: Record<UserProfileStatus, string> = {
  pending_approval: "Pending Approval",
  pending_profile: "Pending Profile",
  active: "Active",
  inactive: "Inactive",
  rejected: "Rejected",
};

function formatDate(value: string | null) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("en-MY", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(new Date(value));
}

function getMemberName(member: ManagedMember | null) {
  return member ? formatMemberDisplayName(member) : "Unlinked Account";
}

export default function UserManagementPage() {
  const { canManageUsers } = useAppPermissions();
  const [accounts, setAccounts] = useState<ManagedAccount[]>([]);
  const [membersWithoutAccounts, setMembersWithoutAccounts] = useState<MemberWithoutAccount[]>([]);
  const [assignableRoles, setAssignableRoles] = useState<UserRole[]>([]);
  const [leaderOptions, setLeaderOptions] = useState<LeaderOption[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<ManagedAccount | null>(null);
  const [formState, setFormState] = useState<EditForm | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const leaderMap = useMemo(() => {
    return new Map(
      leaderOptions.map((leader) => [
        leader.id,
        formatMemberDisplayName(leader),
      ]),
    );
  }, [leaderOptions]);

  const fetchUserManagement = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage("");

      const response = await fetch("/api/admin/users", {
        cache: "no-store",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to load user management");
      }

      const data = result as UserManagementResponse;

      setAccounts(data.accounts ?? []);
      setMembersWithoutAccounts(data.membersWithoutAccounts ?? []);
      setAssignableRoles(data.assignableRoles ?? []);
      setLeaderOptions(data.leaderOptions ?? []);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to load user management",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchUserManagement();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [fetchUserManagement]);

  const filteredAccounts = accounts.filter((account) => {
    const searchable = [
      account.authEmail,
      account.role,
      account.accountStatus,
      account.member?.full_name,
      account.member?.display_name,
      formatMemberCode(account.member?.member_code),
      account.member?.position,
      account.member?.employment_type,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return searchable.includes(search.toLowerCase());
  });

  const filteredMembersWithoutAccounts = membersWithoutAccounts.filter(({ member }) => {
    const searchable = [
      member.full_name,
      member.display_name,
      formatMemberCode(member.member_code),
      member.email,
      member.position,
      member.employment_type,
      member.status,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return searchable.includes(search.toLowerCase());
  });

  function openEditModal(account: ManagedAccount) {
    if (!canManageUsers) return;
    if (
      !account.actionPermissions.canEditRole &&
      !account.actionPermissions.canEditMemberProfile
    ) {
      return;
    }

    setSelectedAccount(account);
    setFormState({
      role: account.role,
      display_name: account.member?.display_name || "",
      position: account.member?.position || memberPositionOptions[0],
      employment_type: account.member?.employment_type || employmentTypeOptions[0],
      leader_id: account.member?.leader_id || "",
      join_date: account.member?.join_date || "",
      status: account.member?.status || memberStatusOptions[0],
    });
    setErrorMessage("");
  }

  function closeEditModal() {
    if (saving) return;

    setSelectedAccount(null);
    setFormState(null);
    setErrorMessage("");
  }

  function updateFormField(field: keyof EditForm, value: string) {
    setFormState((current) =>
      current
        ? {
            ...current,
            [field]: value,
          }
        : current,
    );
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedAccount || !formState || !canManageUsers) return;

    try {
      setSaving(true);
      setErrorMessage("");

      const response = await fetch(`/api/admin/users/${selectedAccount.authUserId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          role: selectedAccount.actionPermissions.canEditRole
            ? formState.role
            : undefined,
          memberProfile:
            selectedAccount.member &&
            selectedAccount.actionPermissions.canEditMemberProfile
            ? {
                position: formState.position,
                display_name: formState.display_name,
                employment_type: formState.employment_type,
                leader_id: formState.leader_id || null,
                join_date: formState.join_date || null,
                status: formState.status,
              }
            : undefined,
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to update user");
      }

      closeEditModal();
      await fetchUserManagement();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update user");
    } finally {
      setSaving(false);
    }
  }

  async function updateAccess(account: ManagedAccount, action: "deactivate" | "reactivate") {
    if (!canManageUsers) return;

    const actionLabel = action === "deactivate" ? "deactivate" : "reactivate";
    const confirmed = window.confirm(
      `Are you sure you want to ${actionLabel} Falcon Hub access for ${
        account.authEmail || getMemberName(account.member)
      }?`,
    );

    if (!confirmed) return;

    try {
      setSaving(true);
      setErrorMessage("");

      const response = await fetch(
        `/api/admin/users/${account.authUserId}/${action}`,
        {
          method: "POST",
        },
      );
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `Unable to ${actionLabel} access`);
      }

      await fetchUserManagement();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : `Unable to ${actionLabel} access`,
      );
    } finally {
      setSaving(false);
    }
  }

  if (!canManageUsers) {
    return (
      <>
        <header className="flex items-center justify-between border-b border-zinc-200 bg-white/80 px-6 py-4 backdrop-blur">
          <div>
            <p className="text-sm text-zinc-500">Team - User Management</p>
            <p className="text-base font-semibold text-zinc-900">Access Denied</p>
          </div>
        </header>
        <main className="p-6 lg:p-8">
          <section className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
            <h1 className="text-2xl font-semibold text-zinc-950">
              User Management is restricted.
            </h1>
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              Only active Admin and Super Admin accounts can manage Falcon Hub users.
            </p>
          </section>
        </main>
      </>
    );
  }

  return (
    <>
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white/80 px-6 py-4 backdrop-blur">
        <div>
          <p className="text-sm text-zinc-500">Team - User Management</p>
          <p className="text-base font-semibold text-zinc-900">Account Lifecycle</p>
        </div>
      </header>

      <main className="p-6 lg:p-8">
        <section className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.24em] text-zinc-500">
                Admin Controls
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">
                User Management
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-600">
                Manage Falcon Hub account access separately from live member profile details.
              </p>
            </div>
            <label className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600 lg:max-w-xs">
              <span className="mb-1 block text-xs uppercase tracking-[0.24em] text-zinc-400">
                Search
              </span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-full bg-transparent outline-none"
                placeholder="Search users"
              />
            </label>
          </div>

          {errorMessage && !selectedAccount ? (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </div>
          ) : null}
        </section>

        <InvitationManagement />

        <section className="mt-8 rounded-[28px] border border-zinc-200 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 text-sm">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-zinc-500">
                    Member Profile
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-zinc-500">
                    Falcon Hub Access
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-zinc-500">
                    Company Fields
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-zinc-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 bg-white">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-zinc-600">
                      Loading user management...
                    </td>
                  </tr>
                ) : filteredAccounts.length === 0 && filteredMembersWithoutAccounts.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-zinc-600">
                      No users found.
                    </td>
                  </tr>
                ) : (
                  <>
                    {filteredAccounts.map((account) => (
                      <tr key={account.authUserId} className="align-top text-zinc-700">
                        <td className="px-4 py-4">
                          <p className="font-medium text-zinc-950">
                            {getMemberName(account.member)}
                          </p>
                          {account.member?.display_name ? (
                            <p className="mt-1 text-xs text-zinc-500">
                              Full Name: {account.member.full_name || "-"}
                            </p>
                          ) : null}
                          <p className="mt-1 text-xs text-zinc-500">
                            {account.member?.chinese_name || "-"}
                          </p>
                          <p className="mt-2 text-xs text-zinc-500">
                            Member: {account.member?.status || "Not linked"}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          <p className="font-medium text-zinc-900">
                            {roleLabels[account.role]}
                          </p>
                          <p className="mt-1 text-xs text-zinc-500">
                            {accountStatusLabels[account.accountStatus]}
                          </p>
                          <p className="mt-2 text-xs text-zinc-500">
                            {account.authEmail || "-"}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          <p>{account.member?.position || "-"}</p>
                          <p className="mt-1 text-xs text-zinc-500">
                            {account.member?.employment_type || "-"}
                          </p>
                          <p className="mt-1 text-xs text-zinc-500">
                            Leader:{" "}
                            {account.member?.leader_id
                              ? leaderMap.get(account.member.leader_id) || "-"
                              : "-"}
                          </p>
                          <p className="mt-1 text-xs text-zinc-500">
                            Join: {formatDate(account.member?.join_date ?? null)}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-col items-start gap-2">
                            {account.actionPermissions.canEditRole ||
                            account.actionPermissions.canEditMemberProfile ? (
                              <button
                                type="button"
                                onClick={() => openEditModal(account)}
                                className="text-sm font-medium text-blue-600 hover:text-blue-800"
                              >
                                Edit
                              </button>
                            ) : null}
                            {account.actionPermissions.canDeactivateAccess ? (
                              <button
                                type="button"
                                onClick={() => updateAccess(account, "deactivate")}
                                disabled={saving}
                                className="text-sm font-medium text-red-600 hover:text-red-800 disabled:opacity-50"
                              >
                                Deactivate Access
                              </button>
                            ) : null}
                            {account.actionPermissions.canReactivateAccess ? (
                              <button
                                type="button"
                                onClick={() => updateAccess(account, "reactivate")}
                                disabled={saving}
                                className="text-sm font-medium text-emerald-700 hover:text-emerald-900 disabled:opacity-50"
                              >
                                Reactivate Access
                              </button>
                            ) : null}
                            {!account.actionPermissions.canEditRole &&
                            !account.actionPermissions.canEditMemberProfile &&
                            !account.actionPermissions.canDeactivateAccess &&
                            !account.actionPermissions.canReactivateAccess ? (
                              <span className="text-zinc-400">-</span>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}

                    {filteredMembersWithoutAccounts.map(({ member }) => (
                      <tr key={member.id} className="align-top text-zinc-700">
                        <td className="px-4 py-4">
                          <p className="font-medium text-zinc-950">
                            {formatMemberDisplayName(member)}
                          </p>
                          {member.display_name ? (
                            <p className="mt-1 text-xs text-zinc-500">
                              Full Name: {member.full_name || "-"}
                            </p>
                          ) : null}
                          <p className="mt-1 text-xs text-zinc-500">
                            {member.chinese_name || "-"}
                          </p>
                          <p className="mt-2 text-xs text-zinc-500">
                            Member: {member.status || "-"}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          <p className="font-medium text-zinc-900">No Account</p>
                          <p className="mt-1 text-xs text-zinc-500">
                            Invite/Create Account deferred
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          <p>{member.position || "-"}</p>
                          <p className="mt-1 text-xs text-zinc-500">
                            {member.employment_type || "-"}
                          </p>
                          <p className="mt-1 text-xs text-zinc-500">
                            Leader: {member.leader_id ? leaderMap.get(member.leader_id) || "-" : "-"}
                          </p>
                          <p className="mt-1 text-xs text-zinc-500">
                            Join: {formatDate(member.join_date)}
                          </p>
                        </td>
                        <td className="px-4 py-4 text-zinc-400">-</td>
                      </tr>
                    ))}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {selectedAccount && formState ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-5">
              <div>
                <h2 className="text-xl font-semibold text-zinc-900">
                  Edit User
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  {selectedAccount.authEmail || getMemberName(selectedAccount.member)}
                </p>
              </div>
              <button
                type="button"
                onClick={closeEditModal}
                className="text-2xl leading-none text-zinc-400 hover:text-zinc-900"
              >
                x
              </button>
            </div>

            <form onSubmit={handleSave}>
              <div className="space-y-5 px-6 py-6">
                {selectedAccount.actionPermissions.canEditRole ? (
                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                    <p className="text-sm font-semibold text-zinc-900">
                      Falcon Hub Access
                    </p>
                    <label className="mt-4 block text-sm text-zinc-600">
                      <span className="mb-2 block font-medium text-zinc-900">
                        Role
                      </span>
                      <select
                        required
                        value={formState.role}
                        onChange={(event) => updateFormField("role", event.target.value)}
                        className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none focus:border-zinc-900"
                      >
                        {assignableRoles.map((role) => (
                          <option key={role} value={role}>
                            {roleLabels[role]}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                ) : null}

                {selectedAccount.member &&
                selectedAccount.actionPermissions.canEditMemberProfile ? (
                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                    <p className="text-sm font-semibold text-zinc-900">
                      Live Member Profile
                    </p>
                    <p className="mt-1 text-xs leading-5 text-zinc-500">
                      These fields update public member data. Approval snapshots are unchanged.
                    </p>

                    <div className="mt-4 grid gap-5 md:grid-cols-2">
                      <label className="block text-sm text-zinc-600">
                        <span className="mb-2 block font-medium text-zinc-900">
                          Display Name
                        </span>
                        <input
                          maxLength={80}
                          value={formState.display_name}
                          onChange={(event) => updateFormField("display_name", event.target.value)}
                          className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none focus:border-zinc-900"
                          placeholder="Uses Full Name when blank"
                        />
                      </label>
                      <label className="block text-sm text-zinc-600">
                        <span className="mb-2 block font-medium text-zinc-900">
                          Position
                        </span>
                        <select
                          required
                          value={formState.position}
                          onChange={(event) => updateFormField("position", event.target.value)}
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
                          Employment Type
                        </span>
                        <select
                          required
                          value={formState.employment_type}
                          onChange={(event) => updateFormField("employment_type", event.target.value)}
                          className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none focus:border-zinc-900"
                        >
                          {employmentTypeOptions.map((employmentType) => (
                            <option key={employmentType} value={employmentType}>
                              {employmentType}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="block text-sm text-zinc-600">
                        <span className="mb-2 block font-medium text-zinc-900">
                          Leader
                        </span>
                        <select
                          value={formState.leader_id}
                          onChange={(event) => updateFormField("leader_id", event.target.value)}
                          className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none focus:border-zinc-900"
                        >
                          <option value="">No leader</option>
                          {leaderOptions
                            .filter((leader) => leader.id !== selectedAccount.member?.id)
                            .map((leader) => (
                              <option key={leader.id} value={leader.id}>
                                {formatMemberDisplayName(leader)}
                                {leader.position ? ` - ${leader.position}` : ""}
                              </option>
                            ))}
                        </select>
                      </label>

                      <label className="block text-sm text-zinc-600">
                        <span className="mb-2 block font-medium text-zinc-900">
                          Join Date
                        </span>
                        <input
                          type="date"
                          value={formState.join_date}
                          onChange={(event) => updateFormField("join_date", event.target.value)}
                          className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm outline-none focus:border-zinc-900"
                        />
                      </label>

                      <label className="block text-sm text-zinc-600">
                        <span className="mb-2 block font-medium text-zinc-900">
                          Member Status
                        </span>
                        <select
                          required
                          value={formState.status}
                          onChange={(event) => updateFormField("status", event.target.value)}
                          className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none focus:border-zinc-900"
                        >
                          {memberStatusOptions.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
                    Member profile fields become editable after this account completes profile setup.
                  </div>
                )}

                {errorMessage ? (
                  <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
                    {errorMessage}
                  </div>
                ) : null}
              </div>

              <div className="flex justify-end gap-3 border-t border-zinc-200 px-6 py-4">
                <button
                  type="button"
                  onClick={closeEditModal}
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
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
