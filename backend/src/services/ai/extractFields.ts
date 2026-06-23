/**
 * AI structured-field extraction + JD cleaning.
 *
 * The browser extension's site-specific scrapers are fragile; when they miss,
 * the fallback dumps an entire page's `<main>.innerText` (nav, cookie banners,
 * "related jobs", footers — up to 12k chars) into `jobDescription`. The legacy
 * regex extractor (`jdExtractor.ts`) can't recover structured fields from that
 * noise, so applications land showing "Unknown company" etc.
 *
 * This service runs a single cheap "fast"-capability LLM call that:
 *   1. decides whether the captured text is actually a job posting,
 *   2. extracts company / title / location / salary / employmentType (only when
 *      clearly stated — empty rather than guessed),
 *   3. returns a cleaned job description with site chrome stripped, so the
 *      downstream fit analysis scores against real posting text, not junk.
 *
 * Runs through the central runner (`runGenerateObject`, capability "fast"), so
 * model selection, caching, retry, metering, and the active-key/admin-default
 * resolution are all handled uniformly. No hardcoded provider.
 */
import { z } from "zod";
import mongoose from "mongoose";

import { runGenerateObject } from "./run.js";

const extractionSchema = z.object({
  /** Gate: false for login walls, error pages, search-result lists, or any
   *  page that isn't a single job posting. When false, callers skip write-back. */
  isJobPosting: z.boolean().describe("true only if the text is (or clearly contains) a single job posting; false for unrelated pages, login walls, error pages, or job-search result lists."),
  company: z.string().default("").describe("Hiring company name only (not the job board). Empty if not clearly determinable."),
  title: z.string().default("").describe("The job title / role. Empty if not clearly determinable."),
  location: z.string().default("").describe("Location as stated, e.g. 'San Francisco, CA · Hybrid' or 'Remote (US)'. Empty if not stated."),
  salary: z.string().default("").describe("Compensation exactly as stated, e.g. '$120k–$150k / year'. Empty if not stated. Never invent a range."),
  employmentType: z.string().default("").describe("One of: Full-time, Part-time, Contract, Internship, Co-op, Temporary, Freelance. Empty if unclear."),
  cleanedJobDescription: z.string().default("").describe("The posting with all navigation, cookie banners, footers, 'related jobs', and site chrome removed — keep only role overview, responsibilities, requirements, qualifications, and compensation/benefits text. Preserve meaningful line breaks. Do NOT summarize or invent. Empty if isJobPosting is false."),
});

export type ExtractedApplicationFields = z.infer<typeof extractionSchema>;

const SYSTEM_PROMPT = `You extract structured fields from a captured job posting.

The input may be a clean job description OR a raw dump of an entire web page (with navigation, cookie banners, "related jobs", footers, and other site chrome mixed in).

Your tasks:
1. Decide if this is actually a single job posting (isJobPosting). A list of many jobs, a login wall, or an error page is NOT a job posting.
2. Extract company, title, location, salary, employmentType — ONLY when clearly stated. Leave a field empty rather than guessing. Do not infer a salary that isn't written.
3. Produce cleanedJobDescription: the same posting with all site chrome / navigation / boilerplate removed, keeping only the role's overview, responsibilities, requirements, qualifications, and comp/benefits. Preserve meaningful structure. Never summarize, paraphrase, or invent content. If it is not a job posting, leave it empty.

A "User-entered" hint may be supplied; it can be wrong or empty — trust the page content over the hint, but you may use the hint to disambiguate.
Return JSON only.`;

export interface ExtractFieldsInput {
  url?: string;
  /** Raw captured job description (may be a full-page dump). */
  jobDescription: string;
  /** What the user/extension already put on the application — may be wrong/empty. */
  knownCompany?: string;
  knownTitle?: string;
}

export async function extractApplicationFields(
  userId: string | mongoose.Types.ObjectId,
  input: ExtractFieldsInput,
): Promise<{ fields: ExtractedApplicationFields; provider: string; modelId: string }> {
  // Generous cap — page dumps are larger than clean JDs, and we want the model
  // to see enough to locate the real posting inside the noise.
  const trimmed = input.jobDescription.slice(0, 14_000);

  const meta = [
    input.url ? `URL: ${input.url}` : "",
    input.knownCompany?.trim() ? `User-entered company (may be wrong/empty): ${input.knownCompany.trim()}` : "",
    input.knownTitle?.trim() ? `User-entered title (may be wrong/empty): ${input.knownTitle.trim()}` : "",
  ].filter(Boolean).join("\n");

  const prompt = ["=== CAPTURED PAGE ===", meta, "", trimmed].join("\n");
  const { object, provider, modelId } = await runGenerateObject({
    userId,
    capability: "fast",
    opType: "field_extract",
    schema: extractionSchema,
    system: SYSTEM_PROMPT,
    prompt,
    cacheInput: prompt,
  });

  return { fields: object, provider, modelId };
}
