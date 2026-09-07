import {
  createCustomerBirthday,
  listCustomerBirthdays,
} from "@/app/api/customer-birthdays/customer-birthday-service";

export const dynamic = "force-dynamic";

export async function GET() {
  return listCustomerBirthdays();
}

export async function POST(request: Request) {
  return createCustomerBirthday(request);
}
