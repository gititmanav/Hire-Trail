/**
 * LLM-assisted merge of two structured resume profiles.
 *
 * When a user uploads a second/third resume, instead of overwriting their master profile
 * we hand both to the model and ask it to:
 *   - Combine experiences/projects/education without duplicating the same job/project/school
 *   - Merge bullets across duplicate entries, preferring the more specific/quantitative version
 *   - Union skills, dedupe case-insensitively, keep the existing category grouping
 *   - Keep the existing contact info unless the field is empty in the master
 *   - Keep the existing summary unless empty (incoming summary is usually role-specific —
 *     master should stay general)
 *
 * The output is validated against the same Zod schema the parser uses, so the merged result
 * drops cleanly into MasterProfile via $set.
 */
import { generateObject } from "ai";
import mongoose from "mongoose";

import { getModelForUser } from "./index.js";
import { resumeProfileSchema, type ParsedResumeProfile } from "./resumeParser.js";
import type { IMasterProfile } from "../../models/MasterProfile.js";

const SYSTEM_PROMPT = `You merge two structured resume profiles into one canonical career history.

Rules:
- NEVER drop information that exists in the master profile. The master is the source of truth.
- For each experience: if the incoming has the same company+role (case-insensitive contains is OK), merge bullets — keep all unique bullets, dedupe near-duplicates (>=80% similar), prefer the more specific/quantified version when phrasing differs.
- For each project: same rule — merge by name match, dedupe bullets.
- For education: merge by school name. Combine highlights.
- For skills: union all skills, dedupe case-insensitive. Keep the master's category grouping; new skills go into matching categories when obvious, otherwise add to a "General" group.
- For contact fields: keep the master's value if non-empty. Fill from incoming only when master is empty.
- For summary: keep the master's summary unless it's empty. (The incoming resume is often tailored to a role, so it would narrow the master inappropriately.)
- For certifications: union, dedupe by name+issuer.
- Preserve per-bullet "tags" arrays — when merging two bullets into one, take the union of their tags.
- Do not invent any new content. If a field is unclear, leave it as-is from the master.

Output: a single structured profile in the same shape, with everything merged.`;

export async function mergeProfilesAI(
  userId: string | mongoose.Types.ObjectId,
  master: IMasterProfile,
  incoming: ParsedResumeProfile,
): Promise<{ merged: ParsedResumeProfile; provider: string; modelId: string }> {
  const { model, provider, modelId } = await getModelForUser(userId, "smart");

  const masterJson = JSON.stringify(
    {
      contact: master.contact,
      summary: master.summary,
      experiences: master.experiences,
      projects: master.projects,
      education: master.education,
      skills: master.skills,
      certifications: master.certifications,
    },
    null,
    2,
  );
  const incomingJson = JSON.stringify(incoming, null, 2);

  const { object } = await generateObject({
    model,
    schema: resumeProfileSchema,
    system: SYSTEM_PROMPT,
    prompt: [
      "=== MASTER PROFILE (source of truth) ===",
      masterJson,
      "",
      "=== INCOMING PROFILE (newly parsed resume) ===",
      incomingJson,
      "",
      "Return the merged profile as JSON.",
    ].join("\n"),
  });

  return { merged: object, provider, modelId };
}
