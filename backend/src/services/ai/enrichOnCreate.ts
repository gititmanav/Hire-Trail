/**
 * On-create enrichment orchestrator.
 *
 * Runs after POST /api/applications sends its 201, as a single fire-and-forget
 * pipeline so the two AI passes happen in the right order:
 *
 *   1. Instant, free company seed from an ATS URL slug (no LLM).
 *   2. Universal AI extraction + JD cleaning (cheap "fast" model). Runs for
 *      every user — no master-profile gate — so brand-new users stop seeing
 *      "Unknown company". Fills only empty fields; replaces a page-dump JD with
 *      the cleaned posting.
 *   3. Fit auto-analysis (existing, master-profile-gated) — kicked off LAST so
 *      it scores against the CLEANED job description, not the raw page dump.
 *
 * Never throws; each stage degrades independently.
 */
import mongoose from "mongoose";

import { Application } from "../../models/Application.js";
import { companyFromJobUrl } from "../jdExtractor.js";
import { extractApplicationFields } from "./extractFields.js";
import { autoAnalyzeOnApplicationCreate } from "./autoAnalyze.js";

/** Below this we don't bother with an LLM call — the JD is too thin to extract
 *  anything meaningful, and the URL-slug seed already covers company. */
const MIN_JD_FOR_AI = 200;
/** Only replace the stored JD when the cleaned posting is substantial — guards
 *  against an over-eager clean nuking a short-but-real description to nothing. */
const MIN_CLEANED_JD = 120;

function clip(s: string, n: number): string {
  return s.trim().slice(0, n);
}

/** Placeholder values the extension/`/init` write when a scrape misses — these
 *  should be treated as "empty" and overwritten by a confident AI value. */
const PLACEHOLDERS = new Set(["", "unknown", "unknown company", "untitled role", "n/a", "none"]);
function isBlankish(v: string | undefined | null): boolean {
  return PLACEHOLDERS.has((v ?? "").trim().toLowerCase());
}

export async function enrichAndAnalyzeOnCreate(
  appId: mongoose.Types.ObjectId,
  opts: { isDemoUser: boolean },
): Promise<void> {
  try {
    const app = await Application.findById(appId);
    if (!app) return;

    const jd = (app.jobDescription || "").trim();
    const willRunAI = !opts.isDemoUser && app.source !== "email" && jd.length >= MIN_JD_FOR_AI;

    if (willRunAI) {
      await Application.updateOne({ _id: app._id }, { $set: { aiExtractionStatus: "processing" } });
      try {
        const { fields } = await extractApplicationFields(app.userId, {
          url: app.jobUrl,
          jobDescription: jd,
          knownCompany: app.company,
          knownTitle: app.role,
        });

        const patch: Record<string, string> = {};
        if (fields.isJobPosting) {
          // Extension scrapes aren't user-authored — they're frequently the raw
          // page <title> ("Role | Company | LinkedIn") or the literal "Unknown".
          // For those, a confident AI value REPLACES the scrape. For manual
          // entries we only fill blanks (and treat "Unknown"/placeholder as blank)
          // so we never clobber something the user deliberately typed.
          const fromExtension = app.source === "extension";
          const canFill = (current: string | undefined) => fromExtension || isBlankish(current);

          if (fields.company && canFill(app.company)) patch.company = clip(fields.company, 200);
          if (fields.title && canFill(app.role)) patch.role = clip(fields.title, 200);
          if (fields.location && canFill(app.location)) patch.location = clip(fields.location, 200);
          if (fields.salary && canFill(app.salary)) patch.salary = clip(fields.salary, 200);
          if (fields.employmentType && canFill(app.jobType)) patch.jobType = clip(fields.employmentType, 200);

          // Only replace the stored JD for EXTENSION captures — those are the
          // ones at risk of being a full-page DOM dump. A manually pasted JD is
          // user-authored; extract fields from it but never overwrite it.
          if (fromExtension) {
            const cleaned = fields.cleanedJobDescription?.trim();
            if (cleaned && cleaned.length >= MIN_CLEANED_JD) {
              patch.jobDescription = cleaned.slice(0, 50_000);
            }
          }
        }
        patch.aiExtractionStatus = "done";
        await Application.updateOne({ _id: app._id }, { $set: patch });

        // Reflect the patch on our in-memory doc so the fit analysis below sees
        // the cleaned JD + filled company/role.
        if (patch.jobDescription) app.jobDescription = patch.jobDescription;
        if (patch.company) app.company = patch.company;
        if (patch.role) app.role = patch.role;
      } catch (err) {
        console.warn("[enrichAndAnalyzeOnCreate:extract]", err instanceof Error ? err.message : err);
        await Application.updateOne({ _id: app._id }, { $set: { aiExtractionStatus: "failed" } });
      }
    }

    // Company fallback: if it's STILL blank/placeholder (AI skipped, not a
    // posting, failed, or didn't find one), the deterministic ATS URL-slug is
    // our best signal.
    if (isBlankish(app.company)) {
      const slug = companyFromJobUrl(app.jobUrl);
      if (slug) {
        app.company = clip(slug, 200);
        await Application.updateOne({ _id: app._id }, { $set: { company: app.company } });
      }
    }

    // Fit auto-analysis last, on the (possibly cleaned) JD. Internally gated on
    // master profile + daily cap; skips the demo user implicitly via the guard
    // below.
    if (!opts.isDemoUser) {
      await autoAnalyzeOnApplicationCreate({
        application: {
          _id: app._id,
          userId: app.userId,
          jobDescription: app.jobDescription,
          role: app.role,
          company: app.company,
          jobUrl: app.jobUrl,
          tailorSessionId: app.tailorSessionId,
          source: app.source,
        },
      });
    }
  } catch (err) {
    console.warn("[enrichAndAnalyzeOnCreate]", err instanceof Error ? err.message : err);
  }
}
