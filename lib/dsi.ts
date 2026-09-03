export const dsiActivityFields = [
  "answered_calls",
  "new_leads_contact",
  "blasting",
  "follow_up",
  "appointment_made",
  "turn_up_appt",
  "presented",
  "unit_closed",
  "unit_sold",
  "unit_converted",
  "social_media_posting",
  "recruitment",
  "sign_up",
] as const;

export type DsiActivityField = (typeof dsiActivityFields)[number];
export type DsiActivityCounts = Record<DsiActivityField, number>;

export const dsiSelectFields = `
  id,
  member_id,
  activity_date,
  answered_calls,
  new_leads_contact,
  blasting,
  follow_up,
  appointment_made,
  turn_up_appt,
  presented,
  unit_closed,
  unit_sold,
  unit_converted,
  social_media_posting,
  recruitment,
  sign_up,
  submitted_at,
  created_at,
  updated_at
`;

export type DsiEntryRow = DsiActivityCounts & {
  id: string;
  member_id: string;
  activity_date: string;
  submitted_at: string;
  created_at: string;
  updated_at: string;
};

export function validateDsiActivityCounts(payload: unknown): DsiActivityCounts {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("DSI activity counts are required");
  }

  const source = payload as Record<string, unknown>;
  const counts = {} as DsiActivityCounts;

  for (const field of dsiActivityFields) {
    const value = source[field];

    if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
      throw new Error(`${field} must be a non-negative integer`);
    }

    counts[field] = value;
  }

  return counts;
}
