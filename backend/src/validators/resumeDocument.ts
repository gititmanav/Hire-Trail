/**
 * Zod schema for PUT /api/resumes/:id/document. Mirrors services/resume/types.ts
 * (ResumeDocument). Permissive on `extra` (free-form per section type) but strict
 * on structure so the editor can't persist a malformed document.
 */
import { z } from "zod";

const linkSchema = z.object({ label: z.string().default(""), url: z.string().default("") });

const contactSchema = z.object({
  email: z.string().default(""),
  phone: z.string().default(""),
  location: z.string().default(""),
  links: z.array(linkSchema).default([]),
});

const bulletSchema = z.object({
  id: z.string(),
  text: z.string().default(""),
  order: z.number().default(0),
});

const entrySchema = z.object({
  id: z.string(),
  org: z.string().default(""),
  title: z.string().default(""),
  location: z.string().default(""),
  startDate: z.string().default(""),
  endDate: z.string().default(""),
  current: z.boolean().default(false),
  order: z.number().default(0),
  bullets: z.array(bulletSchema).default([]),
  extra: z.record(z.unknown()).optional(),
});

const sectionSchema = z.object({
  id: z.string(),
  type: z.enum(["summary", "experience", "education", "skills", "projects", "custom"]),
  title: z.string().default(""),
  order: z.number().default(0),
  entries: z.array(entrySchema).default([]),
});

const styleSchema = z.object({
  template: z.enum(["standard", "compact", "centered"]).default("standard"),
  accentColor: z.string().default("#1a1a1a"),
  fontFamily: z.string().default("Helvetica, Arial, sans-serif"),
  fontSizes: z.object({
    name: z.number(),
    sectionHeader: z.number(),
    subHeader: z.number(),
    body: z.number(),
  }),
  spacing: z.object({ section: z.number(), entry: z.number(), line: z.number() }),
  margins: z.object({ topBottom: z.number(), sides: z.number() }),
  headerAlignment: z.enum(["left", "center", "right"]).default("center"),
  dateFormat: z.string().default("MMM YYYY"),
  bulletIcon: z.string().default("•"),
  educationOrder: z.enum(["degree", "institution"]).default("degree"),
  skillsLayout: z.enum(["inline", "grouped", "columns"]).default("grouped"),
  justifyText: z.boolean().default(false),
});

export const resumeDocumentSchema = z.object({
  meta: z.object({ name: z.string().default(""), contact: contactSchema }),
  sections: z.array(sectionSchema).default([]),
  style: styleSchema,
  // score/suggestions are derived server-side; ignore any client-sent values.
  score: z.number().optional(),
  suggestions: z.array(z.unknown()).optional(),
});

export type ResumeDocumentInput = z.infer<typeof resumeDocumentSchema>;
