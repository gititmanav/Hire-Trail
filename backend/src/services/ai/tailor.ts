/**
 * JD analysis + tailoring.
 *
 * Given a job description and the user's master profile, produce:
 *   - A fit score (1–5, A–F-style grade)
 *   - Matched vs missing skills
 *   - A short list of actionable, structured suggestions the user can accept/reject
 *
 * The output is fully structured (Zod schema) so the frontend can render a clean
 * diff view and persist accepted suggestions onto a per-application tailored variant.
 */
import { generateObject } from "ai";
import { z } from "zod";
import mongoose from "mongoose";

import { getModelForUser } from "./index.js";
import { withAiRetry } from "./withAiRetry.js";
import { MasterProfile } from "../../models/MasterProfile.js";
import type { IMasterProfile } from "../../models/MasterProfile.js";

/* -------------------- output schema -------------------- */

const suggestionSchema = z.object({
  section: z.enum(["summary", "experience", "project", "skills"]),
  kind: z.enum(["rewrite", "add", "reorder", "emphasize"])
    .describe("rewrite = replace existing text; add = new bullet/skill/project; reorder = move existing forward; emphasize = keep but bring up"),
  /** When the change targets an existing entry, identifies it by company+role for exp/project name for projects. */
  targetCompanyOrName: z.string().default("").describe("Company name (experience), project name (project), or empty for summary/skills."),
  /** Optional existing bullet text the suggestion modifies (for rewrite/emphasize). */
  targetBullet: z.string().default(""),
  /** The new text — bullet copy for experience/project; the new summary for summary; comma-separated skills for skills. */
  suggested: z.string(),
  /** One-sentence justification ≤ 25 words. */
  rationale: z.string(),
  /** Lowercase, hyphenated keywords this evidences (e.g. "system-design", "kafka"). */
  tags: z.array(z.string()).default([]),
});

export type Suggestion = z.infer<typeof suggestionSchema>;

const analysisSchema = z.object({
  /** Integer 1..5; we display as A–F too. */
  fitScore: z.number().int().min(1).max(5),
  fitGrade: z.enum(["A", "B", "C", "D", "F"]),
  /** ≤ 3 sentences. */
  summary: z.string(),
  /** Skills from the user's profile that the JD explicitly asks for. */
  matchedSkills: z.array(z.string()).default([]),
  /** Skills the JD asks for that the user does NOT yet have. */
  missingSkills: z.array(z.string()).default([]),
  /** ≤ 6 ordered suggestions, most impactful first. */
  suggestions: z.array(suggestionSchema).max(8).default([]),
});

export type JDAnalysis = z.infer<typeof analysisSchema>;

/* -------------------- prompt -------------------- */

const SYSTEM_PROMPT = `You analyze a job description against a candidate's master career profile.
Return JSON only.

Scoring (fitScore, fitGrade):
- 5 / A — strong match in primary skills + role-level alignment.
- 4 / B — solid match with 1–2 gaps.
- 3 / C — mixed match; meaningful skill gaps.
- 2 / D — weak match; major reskilling required.
- 1 / F — wrong track entirely.

Suggestions:
- Be specific. Reference the candidate's actual companies, projects, and bullets.
- Prefer rewriting existing bullets to better mirror JD keywords over inventing new content.
- Never fabricate experience, skills, or credentials the candidate doesn't have.
- Order by impact: the change that most lifts the application's fit comes first.
- Keep each "suggested" string concise (≤ 30 words for bullets, ≤ 50 for summary).
- "tags": 1–4 lowercase hyphenated keywords each suggestion evidences (e.g. "distributed-systems", "kafka").

If the candidate clearly isn't qualified, set fitScore appropriately (do not inflate). It's OK to return a short suggestions list.`;

function buildProfileContext(profile: IMasterProfile): string {
  const parts: string[] = [];
  if (profile.summary) parts.push(`SUMMARY: ${profile.summary}`);
  if (profile.experiences.length) {
    parts.push("EXPERIENCE:");
    for (const exp of profile.experiences) {
      const dates = exp.current ? `${exp.startDate}–present` : `${exp.startDate}–${exp.endDate}`;
      parts.push(`- ${exp.role} @ ${exp.company} (${dates})`);
      for (const b of exp.bullets) parts.push(`  • ${b.text}${b.tags.length ? ` [${b.tags.join(", ")}]` : ""}`);
    }
  }
  if (profile.projects.length) {
    parts.push("PROJECTS:");
    for (const p of profile.projects) {
      parts.push(`- ${p.name}${p.url ? ` (${p.url})` : ""}${p.technologies.length ? ` — ${p.technologies.join(", ")}` : ""}`);
      if (p.description) parts.push(`  ${p.description}`);
      for (const b of p.bullets) parts.push(`  • ${b.text}`);
    }
  }
  if (profile.skills.length) {
    parts.push("SKILLS:");
    for (const g of profile.skills) parts.push(`- ${g.category}: ${g.items.join(", ")}`);
  }
  if (profile.education.length) {
    parts.push("EDUCATION:");
    for (const e of profile.education) {
      parts.push(`- ${[e.degree, e.field].filter(Boolean).join(" ")} @ ${e.school}${e.gpa ? ` (GPA ${e.gpa})` : ""}`);
    }
  }
  return parts.join("\n");
}

/* -------------------- main entrypoint -------------------- */

export interface JDInput {
  jobTitle?: string;
  company?: string;
  url?: string;
  /** Raw job description text. Truncated to ~12k chars to keep cost bounded. */
  jobDescription: string;
}

export async function analyzeJD(userId: string | mongoose.Types.ObjectId, jd: JDInput): Promise<{ analysis: JDAnalysis; provider: string; modelId: string }> {
  const profile = await MasterProfile.findOne({ userId });
  if (!profile) throw new Error("No master profile yet. Upload a resume on the Profile page first.");

  const trimmedJD = jd.jobDescription.slice(0, 12_000);
  const { model, provider, modelId, byok } = await getModelForUser(userId, "smart");

  const profileContext = buildProfileContext(profile);
  const meta = [
    jd.company ? `Company: ${jd.company}` : "",
    jd.jobTitle ? `Title: ${jd.jobTitle}` : "",
    jd.url ? `URL: ${jd.url}` : "",
  ].filter(Boolean).join("\n");

  const { object } = await withAiRetry({ provider, byok }, () =>
    generateObject({
      model,
      schema: analysisSchema,
      system: SYSTEM_PROMPT,
      prompt: [
        "=== JOB ===",
        meta,
        "",
        trimmedJD,
        "",
        "=== CANDIDATE PROFILE ===",
        profileContext,
      ].join("\n"),
    }),
  );

  return { analysis: object, provider, modelId };
}
