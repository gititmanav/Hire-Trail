/**
 * ResumeDocument persistence helpers shared by the resume routes.
 *
 *   loadOrBuildDocument — fetch the stored doc, or derive one from the master
 *                         profile (+ the resume's tailor session's accepted
 *                         suggestions) and persist it.
 *   withDerived        — attach the deterministic score + contextual chips to a
 *                         document for the API response.
 *   snapshot           — push the current doc onto the bounded undo history.
 */
import type { IResume } from "../../models/Resume.js";
import { ResumeDocument, MAX_DOC_HISTORY, type IResumeDocument } from "../../models/ResumeDocument.js";
import { MasterProfile } from "../../models/MasterProfile.js";
import { TailorSession } from "../../models/TailorSession.js";
import { AppError } from "../../errors/AppError.js";
import { buildResumeDocument } from "./document.js";
import { computeScore } from "./score.js";
import { buildSuggestionChips } from "./suggestions.js";
import { keywordCoverage, extractDocText } from "./keywords.js";
import type { ResumeDocument as ResumeDocShape } from "./types.js";

export async function loadOrBuildDocument(
  userId: string,
  resume: IResume,
): Promise<IResumeDocument> {
  const existing = await ResumeDocument.findOne({ resumeId: resume._id, userId });
  if (existing) return existing;

  const master = await MasterProfile.findOne({ userId });
  if (!master) {
    throw new AppError("No master profile yet. Upload a resume on the Profile page first.", 400);
  }

  let suggestions: typeof TailorSession.prototype.suggestions = [];
  let jdKeywords: string[] = [];
  const tailorSessionId = resume.tailorSessionId ?? null;
  if (tailorSessionId) {
    const session = await TailorSession.findOne({ _id: tailorSessionId, userId });
    if (session) {
      suggestions = session.suggestions;
      // Prefer the cleaned, candidate-independent JD keyword set; fall back to
      // matched+missing skills for pre-existing sessions that predate it.
      jdKeywords = session.jdKeywords?.length
        ? [...session.jdKeywords]
        : [...session.matchedSkills, ...session.missingSkills];
    }
  }

  const doc = buildResumeDocument(master, { suggestions, jdKeywords });
  return ResumeDocument.create({
    resumeId: resume._id,
    userId,
    document: doc,
    version: 1,
    jdKeywords,
    tailorSessionId,
    history: [],
  });
}

/** Attach score + suggestion chips (+ editor metadata) for an API response. */
export function withDerived(docModel: IResumeDocument): ResumeDocShape & {
  version: number;
  availableVersions: number[];
} {
  const doc = docModel.document;
  const gap = keywordCoverage(docModel.jdKeywords, extractDocText(doc));
  return {
    ...doc,
    score: computeScore(doc, docModel.jdKeywords),
    suggestions: buildSuggestionChips(doc, gap),
    version: docModel.version,
    availableVersions: docModel.history.map((h) => h.version),
  };
}

/** Push the current document onto the bounded undo history (newest last). */
export function snapshot(docModel: IResumeDocument, label: string): void {
  docModel.history.push({
    version: docModel.version,
    document: JSON.parse(JSON.stringify(docModel.document)),
    score: computeScore(docModel.document, docModel.jdKeywords),
    label,
    createdAt: new Date(),
  });
  if (docModel.history.length > MAX_DOC_HISTORY) {
    docModel.history = docModel.history.slice(-MAX_DOC_HISTORY);
  }
}
