import { NextResponse } from "next/server";
import { getAuthenticatedUserProfile } from "@/lib/auth";
import { getMemberDisplayName } from "@/lib/member-display";
import { isDashboardSalesLeaderboardPosition } from "@/lib/member-options";
import {
  calculateSalesTopClosers,
  getSalesDateRange,
  type SalesContributor,
} from "@/lib/sales";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

const rankingPeriods = ["this_week", "this_month", "this_year"] as const;

type RankingPeriod = (typeof rankingPeriods)[number];

type SalesRankingRow = {
  nett_price: number | string;
  contributors: Array<{
    member_id: string;
    portion: number | string;
    member: {
      full_name: string | null;
      display_name: string | null;
      position: string | null;
      status: string | null;
      is_deleted: boolean;
    } | null;
  }> | null;
};

function getRankingPeriod(value: string | null): RankingPeriod {
  return rankingPeriods.includes(value as RankingPeriod)
    ? (value as RankingPeriod)
    : "this_week";
}

export async function GET(request: Request) {
  const authContext = await getAuthenticatedUserProfile();

  if (!authContext) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  if (
    authContext.profile?.status !== "active" ||
    !authContext.profile.member_id
  ) {
    return NextResponse.json(
      { error: "Active linked member profile is required" },
      { status: 403 },
    );
  }

  try {
    const url = new URL(request.url);
    const period = getRankingPeriod(url.searchParams.get("period"));
    const range = getSalesDateRange(period);
    const supabase = createSupabaseAdminClient();
    const rows: SalesRankingRow[] = [];
    const pageSize = 1000;

    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await supabase
        .from("sales_cases")
        .select(`
          nett_price,
          contributors:sales_case_contributors(
            member_id,
            portion,
            member:users!sales_case_contributors_member_id_fkey(
              full_name,
              display_name,
              position,
              status,
              is_deleted
            )
          )
        `)
        .eq("is_deleted", false)
        .gte("booking_date", range.from)
        .lte("booking_date", range.to)
        .order("booking_date", { ascending: true })
        .order("id", { ascending: true })
        .range(offset, offset + pageSize - 1);

      if (error) throw error;

      const pageRows = (data ?? []) as unknown as SalesRankingRow[];
      rows.push(...pageRows);

      if (pageRows.length < pageSize) break;
    }

    const cases = rows.map((row) => ({
      nettPrice: Number(row.nett_price),
      contributors: (row.contributors ?? []).flatMap((contributor) => {
        const member = contributor.member;

        if (
          !member ||
          member.is_deleted ||
          member.status !== "Active" ||
          !isDashboardSalesLeaderboardPosition(member.position)
        ) {
          return [];
        }

        return [
          {
            memberId: contributor.member_id,
            memberName: getMemberDisplayName(member),
            position: member.position,
            portion: Number(contributor.portion),
          } satisfies SalesContributor,
        ];
      }),
    }));

    return NextResponse.json({
      period,
      range,
      timezone: "Asia/Kuala_Lumpur",
      topClosers: calculateSalesTopClosers(cases).slice(0, 5),
    });
  } catch (error) {
    console.error("GET /api/dashboard/sales-ranking error:", error);

    return NextResponse.json(
      { error: "Unable to load Sales ranking" },
      { status: 500 },
    );
  }
}
