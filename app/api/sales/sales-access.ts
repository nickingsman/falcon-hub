import type { UserProfile } from "@/lib/auth";
import { buildSalesAccessScope, type SalesAccessScope } from "@/lib/sales-authorization";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

export async function resolveSalesAccessScope(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  profile: UserProfile,
): Promise<SalesAccessScope> {
  if (profile.role !== "leader") return buildSalesAccessScope(profile, []);

  const members: Array<{ id: string; leader_id: string | null; status: string | null }> = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase
      .from("users")
      .select("id, leader_id, status")
      .range(offset, offset + 999);
    if (error) throw error;
    const page = data ?? [];
    members.push(...page);
    if (page.length < 1000) break;
  }
  return buildSalesAccessScope(profile, members);
}
