import type { DsiActivityCounts } from "@/lib/dsi";

export const teamDsiAttentionThresholds = {
  leadsWithoutAppointment: {
    newLeadsContact: 10,
    appointmentMade: 0,
  },
  appointmentTurnUpGap: {
    appointmentMade: 3,
    turnUpAppt: 0,
  },
  presentationClosingGap: {
    presented: 3,
    unitClosed: 0,
  },
} as const;

export type TeamDsiAttentionSignalType =
  | "not_submitted_today"
  | "leads_without_appointment"
  | "appointment_turn_up_gap"
  | "presentation_closing_gap";

export type TeamDsiAttentionSignal = {
  type: TeamDsiAttentionSignalType;
  label: string;
  reason: string;
};

export function getTeamDsiAttentionSignals({
  totals,
  hasSubmittedToday,
  includesToday,
}: {
  totals: DsiActivityCounts;
  hasSubmittedToday: boolean;
  includesToday: boolean;
}) {
  const signals: TeamDsiAttentionSignal[] = [];

  if (includesToday && !hasSubmittedToday) {
    signals.push({
      type: "not_submitted_today",
      label: "Not Submitted Today",
      reason: "Not Submitted Today",
    });
  }

  if (
    totals.new_leads_contact >=
      teamDsiAttentionThresholds.leadsWithoutAppointment.newLeadsContact &&
    totals.appointment_made ===
      teamDsiAttentionThresholds.leadsWithoutAppointment.appointmentMade
  ) {
    signals.push({
      type: "leads_without_appointment",
      label: "Leads Without Appointment",
      reason: `${totals.new_leads_contact} new leads · 0 appointments`,
    });
  }

  if (
    totals.appointment_made >=
      teamDsiAttentionThresholds.appointmentTurnUpGap.appointmentMade &&
    totals.turn_up_appt === teamDsiAttentionThresholds.appointmentTurnUpGap.turnUpAppt
  ) {
    signals.push({
      type: "appointment_turn_up_gap",
      label: "Appointment Turn-Up Gap",
      reason: `${totals.appointment_made} appointments · 0 turn ups`,
    });
  }

  if (
    totals.presented >= teamDsiAttentionThresholds.presentationClosingGap.presented &&
    totals.unit_closed === teamDsiAttentionThresholds.presentationClosingGap.unitClosed
  ) {
    signals.push({
      type: "presentation_closing_gap",
      label: "Presentation Closing Gap",
      reason: `${totals.presented} presented · 0 closed`,
    });
  }

  return signals;
}
