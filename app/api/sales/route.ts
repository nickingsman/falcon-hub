import { createSales, listSales } from "@/app/api/sales/sales-service";
export const dynamic = "force-dynamic";
export function GET(request: Request) { return listSales(request); }
export function POST(request: Request) { return createSales(request); }
