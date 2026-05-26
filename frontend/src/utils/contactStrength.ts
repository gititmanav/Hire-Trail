/**
 * Contact strength score (0–100). Phase-4 differentiator — surfaces "which
 * contacts in my network are warm right now?" without making the user think.
 *
 * Scoring factors (designed to roughly sum to 100 for a perfectly-active
 * connection):
 *   - Recency           up to 40 points (today=40 → decays linearly → 0 at 180d)
 *   - Outreach status   responded/meeting=+30, reached_out=+10, gone_cold=-10
 *   - LinkedIn linked   +10
 *   - Introductions     +5 per linked application, capped at +20
 *
 * The score never goes negative — a gone-cold contact still gets credit for
 * its other signals — and is rounded to the nearest integer for display.
 */
import type { Contact, ContactOutreachStatus } from "../types";

const DAY_MS = 86_400_000;

export type ContactStrengthTier = "weak" | "warm" | "strong";

export interface ContactStrength {
  score: number;
  tier: ContactStrengthTier;
  /** Decomposed contributions for tooltip/debug. */
  factors: {
    recency: number;
    outreach: number;
    linkedin: number;
    introductions: number;
  };
}

function recencyPoints(lastContactDate: string | null | undefined, now: Date): number {
  if (!lastContactDate) return 0;
  const days = Math.max(0, (now.getTime() - new Date(lastContactDate).getTime()) / DAY_MS);
  if (days >= 180) return 0;
  // Linear decay 40 → 0 over 180 days
  return Math.round(40 * (1 - days / 180));
}

function outreachPoints(status: ContactOutreachStatus | undefined): number {
  switch (status) {
    case "responded":
    case "meeting_scheduled": return 30;
    case "reached_out":       return 10;
    case "follow_up_needed":  return 5;
    case "gone_cold":         return -10;
    default:                  return 0;
  }
}

export function contactStrength(c: Contact, now: Date = new Date()): ContactStrength {
  const recency = recencyPoints(c.lastContactDate, now);
  const outreach = outreachPoints(c.outreachStatus);
  const linkedin = c.linkedinUrl ? 10 : 0;
  const introductions = Math.min((c.applicationIds?.length ?? 0) * 5, 20);

  const raw = recency + outreach + linkedin + introductions;
  const score = Math.max(0, Math.min(100, Math.round(raw)));
  const tier: ContactStrengthTier = score >= 70 ? "strong" : score >= 40 ? "warm" : "weak";

  return { score, tier, factors: { recency, outreach, linkedin, introductions } };
}
