import type { UserProfile, UserRole } from "@/lib/auth";

export const adminUserManagementMemberFields = `
  id,
  member_code,
  full_name,
  display_name,
  chinese_name,
  email,
  position,
  employment_type,
  leader_id,
  join_date,
  status
`;

export const adminUserManagementProfileFields = `
  auth_user_id,
  member_id,
  role,
  status,
  created_at,
  updated_at
`;

export type AdminManagedMember = {
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

export type AdminManagedProfile = {
  auth_user_id: string;
  member_id: string | null;
  role: UserRole;
  status: UserProfile["status"];
  created_at: string;
  updated_at: string;
};
