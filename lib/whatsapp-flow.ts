export type MalaysiaDateParts = {
  year: number;
  month: number;
  day: number;
};

export type WhatsAppFlowCustomerInput = {
  customer_name: string;
  phone: string | null;
  birthday: string | null;
  project: string | null;
  project_id: string | null;
  unit: string | null;
  tags: string[];
  remarks: string | null;
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const whatsappMessageTemplates = [
  {
    id: "birthday",
    label: "Birthday",
    message: "Hi {{name}}, wishing you a very Happy Birthday! May your year ahead be filled with happiness, good health and success.",
  },
  {
    id: "mid-autumn",
    label: "Mid-Autumn Festival",
    message: "Hi {{name}}, wishing you and your family a joyful Mid-Autumn Festival filled with happiness, harmony and wonderful moments together.",
  },
  {
    id: "chinese-new-year",
    label: "Chinese New Year",
    message: "Hi {{name}}, wishing you and your family a prosperous Chinese New Year filled with good health, happiness and success.",
  },
  {
    id: "christmas",
    label: "Christmas",
    message: "Hi {{name}}, wishing you and your family a Merry Christmas filled with joy, peace and wonderful moments.",
  },
  {
    id: "custom",
    label: "Custom",
    message: "Hi {{name}}, ",
  },
] as const;

export type WhatsAppTemplateId = (typeof whatsappMessageTemplates)[number]["id"];

export function renderWhatsAppTemplate(templateId: WhatsAppTemplateId, customerName: string) {
  const template = whatsappMessageTemplates.find((item) => item.id === templateId);
  return (template?.message ?? "").replaceAll("{{name}}", customerName.trim());
}

export function normalizeMalaysiaWhatsAppPhone(phone: string | null | undefined) {
  const original = phone?.trim() ?? "";
  if (!original) return { valid: false as const, error: "This customer does not have a phone number." };
  if (!/^\+?[0-9\s()-]+$/.test(original)) {
    return { valid: false as const, error: "Enter a valid Malaysian phone number before opening WhatsApp." };
  }

  const digits = original.replace(/\D/g, "");
  const normalized = digits.startsWith("60")
    ? digits
    : digits.startsWith("0")
      ? `60${digits.slice(1)}`
      : "";

  if (!/^60\d{9,10}$/.test(normalized)) {
    return { valid: false as const, error: "Enter a valid Malaysian phone number before opening WhatsApp." };
  }

  return { valid: true as const, phone: normalized };
}

export function buildWhatsAppUrl(phone: string | null | undefined, message: string) {
  const normalized = normalizeMalaysiaWhatsAppPhone(phone);
  if (!normalized.valid) return normalized;
  if (!message.trim()) {
    return { valid: false as const, error: "Enter a message before opening WhatsApp." };
  }
  return {
    valid: true as const,
    url: `https://wa.me/${normalized.phone}?text=${encodeURIComponent(message)}`,
  };
}

export function isWhatsAppFlowRoleAllowed(role: string | null | undefined) {
  return role === "super_admin";
}

export function getMalaysiaDateParts(date = new Date()): MalaysiaDateParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  return {
    year: Number(parts.find((part) => part.type === "year")?.value),
    month: Number(parts.find((part) => part.type === "month")?.value),
    day: Number(parts.find((part) => part.type === "day")?.value),
  };
}

export function parseBirthday(value: string | null | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

function isValidMonthDay(year: number, month: number, day: number) {
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

export function getDaysUntilBirthday(
  birthday: string | null | undefined,
  today = getMalaysiaDateParts(),
) {
  const parsed = parseBirthday(birthday);
  if (!parsed) return null;

  const todayTime = Date.UTC(today.year, today.month - 1, today.day);
  let candidateYear = today.year;

  while (!isValidMonthDay(candidateYear, parsed.month, parsed.day)) {
    candidateYear += 1;
  }

  let nextBirthday = Date.UTC(candidateYear, parsed.month - 1, parsed.day);
  if (nextBirthday < todayTime) {
    candidateYear += 1;
    while (!isValidMonthDay(candidateYear, parsed.month, parsed.day)) {
      candidateYear += 1;
    }
    nextBirthday = Date.UTC(candidateYear, parsed.month - 1, parsed.day);
  }

  return Math.round((nextBirthday - todayTime) / 86_400_000);
}

function optionalText(value: unknown, maxLength: number) {
  if (value === undefined || value === null || value === "") return { value: null };
  if (typeof value !== "string") return { error: "is invalid" };
  const trimmed = value.trim();
  if (!trimmed) return { value: null };
  if (trimmed.length > maxLength) return { error: `must be ${maxLength} characters or fewer` };
  return { value: trimmed };
}

function normalizeTags(value: unknown) {
  if (value === undefined || value === null) return { value: [] as string[] };
  if (!Array.isArray(value)) return { error: "Tags are invalid" };

  const tags: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string") return { error: "Tags are invalid" };
    const tag = item.trim();
    if (!tag) continue;
    if (tag.length > 40) return { error: "Each tag must be 40 characters or fewer" };
    const normalized = tag.toLowerCase();
    if (!seen.has(normalized)) {
      seen.add(normalized);
      tags.push(tag);
    }
  }

  if (tags.length > 20) return { error: "A customer may have no more than 20 tags" };
  return { value: tags };
}

export function normalizeWhatsAppFlowCustomer(
  body: Record<string, unknown>,
): { value: WhatsAppFlowCustomerInput } | { error: string } {
  const name = typeof body.customerName === "string" ? body.customerName.trim() : "";
  if (!name || name.length > 120) return { error: "Customer name is required and must be 120 characters or fewer" };

  const phone = optionalText(body.phone, 40);
  if (phone.error) return { error: `Phone ${phone.error}` };
  const project = optionalText(body.project, 160);
  if (project.error) return { error: `Project ${project.error}` };
  const unit = optionalText(body.unit, 80);
  if (unit.error) return { error: `Unit ${unit.error}` };
  const remarks = optionalText(body.remarks, 1000);
  if (remarks.error) return { error: `Notes ${remarks.error}` };
  const tags = normalizeTags(body.tags);
  if (tags.error) return { error: tags.error };

  const birthdayText = typeof body.birthday === "string" ? body.birthday.trim() : body.birthday;
  const birthday = birthdayText === undefined || birthdayText === null || birthdayText === ""
    ? null
    : typeof birthdayText === "string" && parseBirthday(birthdayText)
      ? birthdayText
      : undefined;
  if (birthday === undefined) return { error: "Birthday must use YYYY-MM-DD format" };

  const projectId = body.projectId === undefined || body.projectId === null || body.projectId === ""
    ? null
    : typeof body.projectId === "string" && uuidPattern.test(body.projectId)
      ? body.projectId
      : undefined;
  if (projectId === undefined) return { error: "Project is invalid" };

  return {
    value: {
      customer_name: name,
      phone: phone.value ?? null,
      birthday,
      project: project.value ?? null,
      project_id: projectId,
      unit: unit.value ?? null,
      tags: tags.value ?? [],
      remarks: remarks.value ?? null,
    },
  };
}
