import { NextResponse } from "next/server";
import {
  canViewOrganizationChart,
  getAuthorizedOrganizationMembers,
  type OrganizationChartMember,
} from "@/lib/organization-chart";
import { requireMembersApiReadAccess } from "@/lib/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

const organizationMemberFields = `
  id,
  member_code,
  full_name,
  display_name,
  position,
  status,
  leader_id
`;

export async function GET() {
  const authorization = await requireMembersApiReadAccess();

  if (!authorization.authorized) {
    return authorization.response;
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("users")
      .select(organizationMemberFields)
      .eq("is_deleted", false)
      .order("member_code", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const allMembers = (data ?? []) as OrganizationChartMember[];
    const members = getAuthorizedOrganizationMembers(allMembers, {
      role: authorization.profile.role,
      memberId: authorization.profile.member_id,
    });
    const available = canViewOrganizationChart(
      members,
      authorization.profile.role,
    );

    return NextResponse.json(
      { available, members: available ? members : [] },
      { status: 200 },
    );
  } catch (error) {
    console.error("GET /api/members/organization-chart error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load organization chart",
      },
      { status: 500 },
    );
  }
}
