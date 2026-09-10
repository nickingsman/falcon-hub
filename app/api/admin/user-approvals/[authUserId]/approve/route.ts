import { NextResponse } from "next/server";
import type { UserRole } from "@/lib/auth";
import { isEmploymentType, isMemberPosition } from "@/lib/member-options";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import {
  canAssignUserRole,
  requireUserApprovalAccess,
} from "@/lib/permissions";

type RouteContext = {
  params: Promise<{ authUserId: string }>;
};

function getStringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeNullableString(value: unknown) {
  const normalizedValue = getStringValue(value);

  return normalizedValue || null;
}

function isValidDateValue(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsedDate = new Date(`${value}T00:00:00.000Z`);

  return !Number.isNaN(parsedDate.getTime());
}

export async function POST(request: Request, { params }: RouteContext) {
  const authorization = await requireUserApprovalAccess();

  if (!authorization.authorized) {
    return authorization.response;
  }

  try {
    const { authUserId } = await params;

    if (authUserId === authorization.user.id) {
      return NextResponse.json(
        { error: "You cannot approve your own account" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const role = getStringValue(body.role);
    const approvedPosition = getStringValue(body.position);
    const approvedEmploymentType = getStringValue(body.employment_type);
    const approvedLeaderId = normalizeNullableString(body.leader_id);
    const approvedJoinDate = getStringValue(body.join_date);

    if (!canAssignUserRole(authorization.profile, role)) {
      return NextResponse.json(
        { error: "You cannot assign this role" },
        { status: 403 }
      );
    }

    if (!approvedPosition || !isMemberPosition(approvedPosition)) {
      return NextResponse.json(
        { error: "Select a valid Falcon position" },
        { status: 400 }
      );
    }

    if (!approvedEmploymentType || !isEmploymentType(approvedEmploymentType)) {
      return NextResponse.json(
        { error: "Employment Type must be Core Agent or Part Time Agent" },
        { status: 400 }
      );
    }

    if (!approvedJoinDate || !isValidDateValue(approvedJoinDate)) {
      return NextResponse.json(
        { error: "Join Date is required" },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();
    const { data: targetProfile, error: targetProfileError } = await supabase
      .from("user_profiles")
      .select("auth_user_id, status")
      .eq("auth_user_id", authUserId)
      .maybeSingle();

    if (targetProfileError) {
      throw targetProfileError;
    }

    if (!targetProfile) {
      return NextResponse.json(
        { error: "Registration not found" },
        { status: 404 }
      );
    }

    if (targetProfile.status !== "pending_approval") {
      return NextResponse.json(
        { error: "Registration is no longer pending approval" },
        { status: 409 }
      );
    }

    if (approvedLeaderId) {
      const { data: leader, error: leaderError } = await supabase
        .from("users")
        .select("id")
        .eq("id", approvedLeaderId)
        .eq("is_deleted", false)
        .eq("status", "Active")
        .maybeSingle();

      if (leaderError) {
        throw leaderError;
      }

      if (!leader) {
        return NextResponse.json(
          { error: "Selected leader is not active" },
          { status: 400 }
        );
      }
    }

    const { data: updatedProfile, error: updateError } = await supabase
      .from("user_profiles")
      .update({
        role: role as UserRole,
        status: "pending_profile",
        approved_position: approvedPosition,
        approved_employment_type: approvedEmploymentType,
        approved_leader_id: approvedLeaderId,
        approved_join_date: approvedJoinDate,
        approved_at: new Date().toISOString(),
        approved_by: authorization.user.id,
      })
      .eq("auth_user_id", authUserId)
      .eq("status", "pending_approval")
      .select("auth_user_id, role, status")
      .maybeSingle();

    if (updateError) {
      throw updateError;
    }

    if (!updatedProfile) {
      return NextResponse.json(
        { error: "Registration is no longer pending approval" },
        { status: 409 }
      );
    }

    return NextResponse.json(updatedProfile);
  } catch (error) {
    console.error("POST /api/admin/user-approvals/[authUserId]/approve error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to approve registration",
      },
      { status: 500 }
    );
  }
}
