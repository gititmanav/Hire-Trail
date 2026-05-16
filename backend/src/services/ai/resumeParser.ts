/**
 * PDF resume → structured ResumeProfile via LLM.
 *
 * Two-step: (1) extract text via unpdf, (2) generateObject with a Zod schema
 * matching the ResumeProfile shape so we get validated typed output regardless
 * of provider.
 */
import { generateObject } from "ai";
import { z } from "zod";
import { extractText, getDocumentProxy } from "unpdf";

import { getModelForUser } from "./index.js";
import type mongoose from "mongoose";

const bulletSchema = z.object({
  text: z.string(),
  tags: z.array(z.string()).default([]),
});

const experienceSchema = z.object({
  company: z.string(),
  role: z.string(),
  location: z.string().default(""),
  startDate: z.string().default(""),
  endDate: z.string().default(""),
  current: z.boolean().default(false),
  bullets: z.array(bulletSchema).default([]),
});

const projectSchema = z.object({
  name: z.string(),
  url: z.string().default(""),
  description: z.string().default(""),
  bullets: z.array(bulletSchema).default([]),
  technologies: z.array(z.string()).default([]),
});

const educationSchema = z.object({
  school: z.string(),
  degree: z.string().default(""),
  field: z.string().default(""),
  location: z.string().default(""),
  startDate: z.string().default(""),
  endDate: z.string().default(""),
  gpa: z.string().default(""),
  highlights: z.array(z.string()).default([]),
});

const skillGroupSchema = z.object({
  category: z.string(),
  items: z.array(z.string()).default([]),
});

const certificationSchema = z.object({
  name: z.string(),
  issuer: z.string().default(""),
  date: z.string().default(""),
  url: z.string().default(""),
});

const contactSchema = z.object({
  fullName: z.string().default(""),
  email: z.string().default(""),
  phone: z.string().default(""),
  location: z.string().default(""),
  linkedin: z.string().default(""),
  github: z.string().default(""),
  portfolio: z.string().default(""),
});

export const resumeProfileSchema = z.object({
  contact: contactSchema,
  summary: z.string().default(""),
  experiences: z.array(experienceSchema).default([]),
  projects: z.array(projectSchema).default([]),
  education: z.array(educationSchema).default([]),
  skills: z.array(skillGroupSchema).default([]),
  certifications: z.array(certificationSchema).default([]),
});

export type ParsedResumeProfile = z.infer<typeof resumeProfileSchema>;

const SYSTEM_PROMPT = `You extract structured resume data from raw text.

Rules:
- Preserve the user's wording in bullets verbatim where possible — do not paraphrase.
- For each work bullet, infer up to 4 relevant skill/keyword tags (lowercase, hyphenated multi-word like "system-design").
- Dates: use the format printed in the resume; leave blank if absent.
- If a section is missing, return an empty array for it.
- Group skills by category as printed (e.g. "Languages", "Frameworks"); if uncategorized, use category "General".
- Never invent experience, projects, or credentials. If unclear, leave blank.`;

export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true });
  return Array.isArray(text) ? text.join("\n") : text;
}

export async function parseResumePdf(buffer: Buffer, userId: string | mongoose.Types.ObjectId): Promise<{ profile: ParsedResumeProfile; provider: string; modelId: string }> {
  const text = await extractTextFromPdf(buffer);
  if (!text.trim()) throw new Error("Could not extract text from PDF — file may be scanned/image-only.");

  const { model, provider, modelId } = await getModelForUser(userId, "fast");

  const { object } = await generateObject({
    model,
    schema: resumeProfileSchema,
    system: SYSTEM_PROMPT,
    prompt: `Extract the structured profile from this resume:\n\n${text}`,
  });

  return { profile: object, provider, modelId };
}
