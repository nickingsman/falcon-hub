import { NextResponse } from "next/server";
import { getAuthenticatedUserProfile } from "@/lib/auth";
import { createSupabaseSsrClient } from "@/lib/supabase-ssr";

function getRequiredString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getOptionalString(value: unknown) {
  const stringValue = getRequiredString(value);

  return stringValue || null;
}

function normalizeNric(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/[\s-]/g, "") : "";
}

function isValidDateValue(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsedDate = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(parsedDate.getTime()) &&
    parsedDate.toISOString().slice(0, 10) === value
  );
}

export async function POST(request: Request) {
  const authContext = await getAuthenticatedUserProfile();

  if (!authContext) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  if (!authContext.profile) {
    return NextResponse.json(
      { error: "User profile is required" },
      { status: 403 }
    );
  }

  if (authContext.profile.status !== "pending_profile") {
    return NextResponse.json(
      { error: "Profile completion is not available for this account" },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const fullName = getRequiredString(body.fullName);
    const chineseName = getOptionalString(body.chineseName);
    const phone = getRequiredString(body.phone);
    const birthday = getRequiredString(body.birthday);
    const nricNumber = normalizeNric(body.nricNumber);

    if (!fullName) {
      return NextResponse.json(
        { error: "Full Name is required" },
        { status: 400 }
      );
    }

    if (!phone) {
      return NextResponse.json(
        { error: "Phone is required" },
        { status: 400 }
      );
    }

    if (!birthday || !isValidDateValue(birthday)) {
      return NextResponse.json(
        { error: "Birthday is required" },
        { status: 400 }
      );
    }

    if (!/^\d{12}$/.test(nricNumber)) {
      return NextResponse.json(
        { error: "NRIC must be 12 digits or use YYMMDD-PB-#### format" },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseSsrClient();
    const { data, error } = await supabase.rpc("complete_user_profile", {
      p_full_name: fullName,
      p_chinese_name: chineseName,
      p_phone: phone,
      p_birthday: birthday,
      p_nric_number: nricNumber,
    });

    if (error) {
      const status =
        error.code === "42501" || error.code === "28000"
          ? 403
          : error.code === "23505"
            ? 409
            : error.code === "22023" ||
                error.code === "23502" ||
                error.code === "23503"
              ? 400
              : 500;

      return NextResponse.json(
        { error: error.message || "Unable to complete profile" },
        { status }
      );
    }

    return NextResponse.json({
      success: true,
      memberId: Array.isArray(data) ? data[0]?.member_id ?? null : null,
    });
  } catch (error) {
    console.error("POST /api/auth/complete-profile error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to complete profile",
      },
      { status: 500 }
    );
  }
}
