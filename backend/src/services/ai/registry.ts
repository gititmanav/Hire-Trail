/**
 * The AI registry — the ONE list of what HireTrail uses AI for.
 *
 * Everything derives from it: the gateway (time budget, tier, output cap), the
 * admin policies and their defaults, both AI maps, the ledger, the usage
 * lens, MCP. A feature ships its entry in the SAME commit as the code that
 * calls it — an entry that maps to nothing is a lie on the map — and calling
 * runAiTask with an id that isn't here throws.
 *
 * Ids are stable (they're stored on routes, policies and ledger rows); bump
 * `promptVersion` whenever a prompt or schema changes — it keys the cache, so
 * an old answer can never be served for a new question.
 */
import type { AiLane } from "./providerIds.js";

export type AiTier = "fast" | "smart";
/** What kind of personal data the feature sends to a model. "email" is the
 *  strictest: it never goes to a free-tier key unless the admin allows it,
 *  and never to an assistant. */
export type AiDataClass = "posting" | "resume" | "email";

export interface AiFeatureDef {
  id: string;
  /** Plain words, shown everywhere: "Read job postings", not "JD extraction". */
  label: string;
  /** One word for a map node's face. */
  shortLabel: string;
  /** One sentence a non-technical person understands. */
  description: string;
  /** Lucide icon name; the frontend maps it. */
  icon: string;
  tier: AiTier;
  /** Wall-clock budget for one call, kept well under the host's 300 s. */
  budgetMs: number;
  /** Output cap. Generous: only produced tokens are billed. */
  maxOutputTokens: number;
  /** The lanes this feature can technically run in. Admin policy narrows it. */
  lanes: AiLane[];
  defaultLane: AiLane;
  /** Runs without the person waiting on it (on track, on upload, during a scan). */
  background: boolean;
  dataClass: AiDataClass;
  /** Default Included uses per user per month (0 = no count limit). */
  defaultIncludedMonthlyLimit: number;
  promptVersion: string;
  /** What Off means for this feature, in words — shown wherever Off is offered. */
  offMeans?: string;
}

export const AI_FEATURES: AiFeatureDef[] = [
  {
    id: "posting.read",
    label: "Read job postings",
    shortLabel: "Postings",
    description:
      "When you track a job, reads the posting for the company, role, location and pay, and trims away the page around it.",
    icon: "FileSearch",
    tier: "fast",
    budgetMs: 45_000,
    maxOutputTokens: 1_500,
    lanes: ["included", "byok", "assistant", "off"],
    defaultLane: "included",
    background: true,
    dataClass: "posting",
    defaultIncludedMonthlyLimit: 0,
    promptVersion: "posting.read@2",
    offMeans: "Postings are saved exactly as the extension captured them.",
  },
  {
    id: "fit.check",
    label: "Fit check",
    shortLabel: "Fit",
    description:
      "Reads a posting against your profile: what the role really asks for, what you already show, what's missing and what to change.",
    icon: "Target",
    tier: "smart",
    budgetMs: 60_000,
    maxOutputTokens: 3_000,
    lanes: ["included", "byok", "assistant", "off"],
    defaultLane: "included",
    background: true,
    dataClass: "resume",
    defaultIncludedMonthlyLimit: 0,
    promptVersion: "fit.check@2",
    offMeans: "Applications show your match score from keywords alone, without the AI's read.",
  },
  {
    id: "resume.import",
    label: "Import a resume",
    shortLabel: "Import",
    description:
      "Turns a resume PDF into your master profile: experience, projects, education and skills, in your own words.",
    icon: "FileUp",
    tier: "fast",
    budgetMs: 120_000,
    maxOutputTokens: 8_000,
    lanes: ["included", "byok", "assistant"],
    defaultLane: "included",
    background: true,
    dataClass: "resume",
    defaultIncludedMonthlyLimit: 2,
    promptVersion: "resume.import@2",
  },
  {
    id: "profile.merge",
    label: "Merge resumes",
    shortLabel: "Merge",
    description:
      "When you import another resume, combines it with your profile without dropping anything you already have.",
    icon: "GitMerge",
    tier: "smart",
    budgetMs: 150_000,
    maxOutputTokens: 12_000,
    // A step of an import, not something to ask an assistant for on its own:
    // an assistant-run import is merged by the deterministic rules.
    lanes: ["included", "byok", "off"],
    defaultLane: "included",
    background: true,
    dataClass: "resume",
    defaultIncludedMonthlyLimit: 0,
    promptVersion: "profile.merge@2",
    offMeans: "A newly imported resume is combined with your profile by simple rules — nothing is dropped, near-duplicates may remain.",
  },
  {
    id: "resume.tailor",
    label: "Tailor a resume",
    shortLabel: "Tailor",
    description:
      "Proposes rewrites of your bullets for one job, from your real experience. Nothing changes until you accept it.",
    icon: "Wand2",
    tier: "smart",
    budgetMs: 120_000,
    maxOutputTokens: 8_000,
    lanes: ["included", "byok", "assistant"],
    defaultLane: "included",
    background: false,
    dataClass: "resume",
    defaultIncludedMonthlyLimit: 5,
    promptVersion: "resume.tailor@1",
  },
  {
    id: "inbox.sort",
    label: "Sort inbox email",
    shortLabel: "Inbox",
    description:
      "During an inbox scan, reads application emails and works out which job each is about and what stage it shows.",
    icon: "Mail",
    tier: "fast",
    budgetMs: 45_000,
    maxOutputTokens: 4_000,
    lanes: ["included", "byok", "off"],
    defaultLane: "included",
    background: true,
    dataClass: "email",
    defaultIncludedMonthlyLimit: 0,
    promptVersion: "inbox.sort@2",
    offMeans: "Inbox scans are switched off.",
  },
];

const BY_ID = new Map(AI_FEATURES.map((f) => [f.id, f]));

export function aiFeature(id: string): AiFeatureDef {
  const f = BY_ID.get(id);
  // A caller naming an unregistered feature is a programming error, not a
  // user condition — fail loudly so it can never ship half-wired.
  if (!f) throw new Error(`[ai] unknown AI feature '${id}' — register it in services/ai/registry.ts`);
  return f;
}

export function isAiFeatureId(id: unknown): id is string {
  return typeof id === "string" && BY_ID.has(id);
}

/** The public registry (what the UI and MCP need). */
export function publicFeatures() {
  return AI_FEATURES.map((f) => ({
    id: f.id,
    label: f.label,
    shortLabel: f.shortLabel,
    description: f.description,
    icon: f.icon,
    tier: f.tier,
    lanes: f.lanes,
    defaultLane: f.defaultLane,
    background: f.background,
    dataClass: f.dataClass,
    offMeans: f.offMeans ?? null,
  }));
}
