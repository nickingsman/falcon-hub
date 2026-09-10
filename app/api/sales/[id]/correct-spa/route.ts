import { correctSalesSpa } from "@/app/api/sales/sales-service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return correctSalesSpa(request, id);
}
