import {
  deleteCustomerBirthday,
  getCustomerBirthday,
  updateCustomerBirthday,
} from "@/app/api/customer-birthdays/customer-birthday-service";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  return getCustomerBirthday(id);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  return updateCustomerBirthday(request, id);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  return deleteCustomerBirthday(id);
}
