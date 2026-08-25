import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

const minimumPasswordLength = 8;

function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function getStringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = normalizeEmail(body.email);
    const password = getStringValue(body.password);
    const confirmPassword = getStringValue(body.confirmPassword);

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    if (!password) {
      return NextResponse.json({ error: "Password is required" }, { status: 400 });
    }

    if (password.length < minimumPasswordLength) {
      return NextResponse.json(
        { error: `Password must be at least ${minimumPasswordLength} characters` },
        { status: 400 }
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        { error: "Passwords do not match" },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();
    const { data: createdUser, error: createUserError } =
      await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

    if (createUserError || !createdUser.user) {
      const errorMessage = createUserError?.message || "Unable to register account";
      const isDuplicateEmail =
        errorMessage.toLowerCase().includes("already") ||
        errorMessage.toLowerCase().includes("registered") ||
        errorMessage.toLowerCase().includes("exists");

      return NextResponse.json(
        {
          error: isDuplicateEmail
            ? "An account with this email already exists"
            : errorMessage,
        },
        { status: isDuplicateEmail ? 409 : 400 }
      );
    }

    const { error: profileError } = await supabase.from("user_profiles").insert({
      auth_user_id: createdUser.user.id,
      member_id: null,
      role: "agent",
      status: "pending_approval",
    });

    if (profileError) {
      await supabase.auth.admin.deleteUser(createdUser.user.id);
      throw profileError;
    }

    return NextResponse.json(
      { success: true, email },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/auth/register error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to register account",
      },
      { status: 500 }
    );
  }
}
