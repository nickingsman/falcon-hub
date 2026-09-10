import { getAuthenticatedUserProfile } from "@/lib/auth";
import { canManageSales } from "@/lib/permissions";
import HistoricalSalesImportClient from "./HistoricalSalesImportClient";

export const dynamic = "force-dynamic";

export default async function HistoricalSalesImportPage() {
  const authContext = await getAuthenticatedUserProfile();
  if (!canManageSales(authContext?.profile ?? null)) {
    return <main className="px-4 py-8 sm:px-6 lg:px-8"><section className="rounded-[24px] border border-[var(--falcon-soft-border)] bg-white p-6 shadow-sm"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--falcon-gold-dark)]">Falcon Hub Sales</p><h1 className="mt-2 text-2xl font-semibold text-zinc-950">Access Denied</h1><p className="mt-3 text-sm text-zinc-600">Historical Sales Import is available only to Admin and Super Admin users.</p></section></main>;
  }
  return <HistoricalSalesImportClient />;
}
