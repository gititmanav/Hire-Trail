/**
 * Source-agnostic email intake pipeline.
 *
 * Gmail and Outlook clients both call `processIncomingEmail` with a normalized
 * email envelope. The pipeline:
 *   1. Pre-filter via cheap regex — skip LLM call on obviously non-job emails.
 *   2. Dedupe by (userId, sourceEmailId).
 *   3. Classify with the user's preferred LLM (Gemini Flash by default — free tier).
 *   4. Match the email to one of the user's active applications.
 *   5. Auto-apply the stage change and create a notification with an Undo handle.
 *
 * Cost target: ~95% of inbox messages get filtered out before the LLM is called.
 */
import { generateObject } from "ai";
import { z } from "zod";
import mongoose from "mongoose";

import { Application } from "../../models/Application.js";
import type { IApplication, Stage } from "../../models/Application.js";
import { Notification } from "../../models/Notification.js";
import type { NotificationType } from "../../models/Notification.js";
import type { IUser } from "../../models/User.js";
import { getModelForUser } from "../ai/index.js";

/* -------------------------- types -------------------------- */

export type MailSource = "gmail" | "outlook";

export interface NormalizedEmail {
  /** Provider-side stable message id. Used for dedupe. */
  id: string;
  source: MailSource;
  from: string;
  fromDomain: string;
  fromName: string;
  subject: string;
  bodyText: string;
}

export type EmailSignal =
  | "interview_invite"
  | "rejection"
  | "offer"
  | "follow_up"
  | "no_signal";

export interface ClassificationResult {
  signal: EmailSignal;
  confidence: "low" | "medium" | "high";
  matchedCompany: string;
  reasoning: string;
}

export type ProcessOutcome =
  | { skipped: "prefilter" | "duplicate" | "no_match" | "no_signal" }
  | { applied: true; signal: EmailSignal; applicationId: string; previousStage: Stage; newStage: Stage };

/* -------------------------- pre-filter -------------------------- */

/** Cheap regex that decides whether an email is worth sending to the LLM.
 *  If none of these keywords appear we save a network round-trip + tokens. */
const JOB_KEYWORDS_RE = new RegExp(
  [
    "interview",
    "application",
    "position",
    "role at",
    "opportunity",
    "offer",
    "hiring",
    "recruit",
    "candidacy",
    "moving forward",
    "unfortunately",
    "congratulations",
    "we'd like to",
    "next steps",
    "thank you for applying",
    "your application",
    "regret to inform",
    "decided to move forward",
    "decided not to",
    "schedule a",
  ].join("|"),
  "i"
);

function looksLikeJobEmail(subject: string, body: string): boolean {
  return JOB_KEYWORDS_RE.test(`${subject}\n${body.slice(0, 1500)}`);
}

/* -------------------------- classifier -------------------------- */

const classificationSchema = z.object({
  signal: z.enum(["interview_invite", "rejection", "offer", "follow_up", "no_signal"]),
  confidence: z.enum(["low", "medium", "high"]),
  matchedCompany: z.string().describe("Company name detected, or empty string if none."),
  reasoning: z.string().describe("One sentence reason."),
});

const SYSTEM_PROMPT = `You classify a single email about a job application.

Output JSON only.

Signal meanings:
- interview_invite: a recruiter or hiring team is inviting the candidate to interview, schedule a call, or proceed to a next round.
- rejection: the application has been declined.
- offer: an offer or compensation package is being extended.
- follow_up: a status update from a recruiter that does not change the outcome (e.g. "we are still reviewing").
- no_signal: not relevant to a job application (newsletter, marketing, generic auto-reply).

Confidence:
- high: explicit phrasing leaves no doubt.
- medium: clear signal but some hedging.
- low: ambiguous wording, you are inferring.

matchedCompany: the actual employer named in the email (not a recruiting agency, not a job-board domain). Empty string if unclear.

reasoning: one short sentence (<= 20 words).`;

export async function classifyEmail(userId: string | mongoose.Types.ObjectId, email: NormalizedEmail, trackedCompanies: string[]): Promise<ClassificationResult> {
  const { model } = await getModelForUser(userId, "fast");
  const body = email.bodyText.slice(0, 2500);
  const { object } = await generateObject({
    model,
    schema: classificationSchema,
    system: SYSTEM_PROMPT,
    prompt: [
      `From: ${email.from}`,
      `Subject: ${email.subject}`,
      "",
      "Body:",
      body,
      "",
      `User is tracking applications at: ${trackedCompanies.join(", ") || "(none)"}`,
    ].join("\n"),
  });
  return object;
}

/* -------------------------- matching -------------------------- */

/** Map signal → new stage. Returns null if no stage change is appropriate. */
function stageFor(signal: EmailSignal): Stage | null {
  switch (signal) {
    case "interview_invite": return "Interview";
    case "rejection": return "Rejected";
    case "offer": return "Offer";
    case "follow_up":
    case "no_signal":
      return null;
  }
}

function notificationTypeFor(signal: EmailSignal): NotificationType | null {
  switch (signal) {
    case "interview_invite": return "interview_detected";
    case "rejection": return "rejection_detected";
    case "offer": return "offer_detected";
    case "follow_up": return "follow_up_detected";
    case "no_signal": return null;
  }
}

/** Score how confidently this email matches an application. Higher = better. */
function scoreMatch(email: NormalizedEmail, app: IApplication, classifierCompany: string): number {
  const company = app.company.toLowerCase();
  const classifier = classifierCompany.toLowerCase();
  let s = 0;
  if (classifier && (classifier === company || classifier.includes(company) || company.includes(classifier))) s += 50;
  if (email.fromDomain && company.includes(email.fromDomain.split(".")[0])) s += 25;
  if (email.fromName && email.fromName.toLowerCase().includes(company)) s += 15;
  if (email.subject.toLowerCase().includes(company)) s += 15;
  if (email.bodyText.slice(0, 600).toLowerCase().includes(company)) s += 5;
  return s;
}

function matchApplication(email: NormalizedEmail, apps: IApplication[], classifierCompany: string): IApplication | null {
  let best: { app: IApplication; score: number } | null = null;
  for (const app of apps) {
    const score = scoreMatch(email, app, classifierCompany);
    if (score >= 30 && (!best || score > best.score)) best = { app, score };
  }
  return best?.app ?? null;
}

/* -------------------------- main pipeline -------------------------- */

const titleFor = (signal: EmailSignal, company: string): string => {
  switch (signal) {
    case "interview_invite": return `Interview invite: ${company}`;
    case "rejection": return `Rejection: ${company}`;
    case "offer": return `Offer: ${company}`;
    case "follow_up": return `Follow-up from ${company}`;
    case "no_signal": return "";
  }
};

export async function processIncomingEmail(user: IUser, email: NormalizedEmail, openApplications: IApplication[]): Promise<ProcessOutcome> {
  // 1. Pre-filter
  if (!looksLikeJobEmail(email.subject, email.bodyText)) return { skipped: "prefilter" };

  // 2. Dedupe
  const dup = await Notification.findOne({ userId: user._id, sourceEmailId: email.id });
  if (dup) return { skipped: "duplicate" };

  if (openApplications.length === 0) return { skipped: "no_match" };

  // 3. Classify
  const trackedCompanies = Array.from(new Set(openApplications.map((a) => a.company)));
  const classification = await classifyEmail(user._id, email, trackedCompanies);

  if (classification.signal === "no_signal") return { skipped: "no_signal" };

  // 4. Match
  const app = matchApplication(email, openApplications, classification.matchedCompany);
  if (!app) return { skipped: "no_match" };

  // 5. Apply stage change + notify
  const newStage = stageFor(classification.signal);
  const notifType = notificationTypeFor(classification.signal);
  if (!newStage || !notifType) return { skipped: "no_signal" };

  const previousStage = app.stage;
  // Don't downgrade — only apply if it's a forward move (or rejection/offer terminal).
  const forwardOk = previousStage === newStage ? false
    : newStage === "Rejected" || newStage === "Offer" ? true
    : stageRank(newStage) > stageRank(previousStage);

  if (forwardOk) {
    await Application.findByIdAndUpdate(app._id, {
      stage: newStage,
      $push: { stageHistory: { stage: newStage, date: new Date() } },
    });
  }

  await Notification.create({
    userId: user._id,
    type: notifType,
    title: titleFor(classification.signal, app.company),
    message: forwardOk
      ? `Detected ${classification.signal.replace("_", " ")} for "${app.role}" at ${app.company}. Stage updated to ${newStage}.`
      : `Detected ${classification.signal.replace("_", " ")} for "${app.role}" at ${app.company}.`,
    applicationId: app._id,
    source: email.source,
    sourceEmailId: email.id,
    previousStage: forwardOk ? previousStage : null,
  });

  return forwardOk
    ? { applied: true, signal: classification.signal, applicationId: app._id.toString(), previousStage, newStage }
    : { skipped: "no_signal" };
}

// Drafting ranks 0 — emails should never *downgrade* a real submission back to Drafting.
const STAGE_RANK: Record<Stage, number> = { Drafting: 0, Applied: 1, OA: 2, Interview: 3, Offer: 4, Rejected: 5 };
function stageRank(s: Stage): number { return STAGE_RANK[s] ?? 0; }
