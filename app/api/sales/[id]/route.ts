import { updateSales } from "@/app/api/sales/sales-service";
export const dynamic = "force-dynamic";
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return updateSales(request, id);
}
