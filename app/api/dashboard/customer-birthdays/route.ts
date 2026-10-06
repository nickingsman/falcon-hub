import { NextResponse } from "next/server";
import { requireWhatsAppFlowAccess } from "@/lib/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import { getDaysUntilBirthday, parseBirthday } from "@/lib/whatsapp-flow";

type CustomerBirthdayRow = {
  customer_name: string;
  project: string | null;
  unit: string | null;
  birthday: string | null;
};

export const dynamic = "force-dynamic";

export async function GET() {
  const authorization = await requireWhatsAppFlowAccess();
  if (!authorization.authorized) return authorization.response;

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("customer_birthdays")
      .select("customer_name, project, unit, birthday")
      .eq("owner_user_id", authorization.user.id)
      .eq("is_deleted", false)
      .not("birthday", "is", null)
      .order("customer_name", { ascending: true });
    if (error) throw error;

    const today = [];
    const upcoming = [];
    for (const row of (data ?? []) as CustomerBirthdayRow[]) {
      const birthday = parseBirthday(row.birthday);
      const daysUntil = getDaysUntilBirthday(row.birthday);
      if (!birthday || daysUntil === null || daysUntil < 0 || daysUntil > 30) continue;
      const item = {
        customerName: row.customer_name,
        project: row.project,
        unit: row.unit,
        month: birthday.month,
        day: birthday.day,
        daysUntil,
      };
      if (daysUntil === 0) today.push(item);
      else upcoming.push(item);
    }

    today.sort((a, b) => a.customerName.localeCompare(b.customerName));
    upcoming.sort((a, b) => a.daysUntil - b.daysUntil || a.customerName.localeCompare(b.customerName));
    return NextResponse.json({ today, upcoming });
  } catch (error) {
    console.error("GET /api/dashboard/customer-birthdays error:", error);
    return NextResponse.json({ error: "Unable to load customer birthday reminders" }, { status: 500 });
  }
}
