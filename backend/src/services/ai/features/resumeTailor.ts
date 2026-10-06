/**
 * resume.tailor — propose rewrites of the person's own bullets; they accept.
 *
 * Grounded by construction:
 *   - only prose is sent (bullets and the summary, each with its element id);
 *     employers, titles, dates and schools never are, so they can't change;
 *   - an answer must name an id we sent, and differ from the original;
 *   - every number in a rewrite must already be in the bullet it rewrites
 *     (a figure may be surfaced, never invented) — otherwise it's dropped;
 *   - a rewrite that balloons past the original is dropped.
 * Proposals are stored on the document and change nothing until accepted;
 * accepting re-checks that the bullet still reads as it did when proposed.
 *
 * The same path serves the user's assistant (MCP): `tailoringBrief` hands it
 * the bullets, `proposeRewrites` takes its answer through the same checks.
 */
import crypto from "crypto";
import { z } from "zod";

import type { IResumeDocument, IResumeProposal } from "../../../models/ResumeDocument.js";
import type { ResumeDocument, RewriteScope } from "../../resume/types.js";
import { computeScore } from "../../resume/score.js";
import { snapshot } from "../../resume/store.js";
import { runAiObject, type AiUser } from "../gateway.js";
import { DATA_RULE, fence, numbersAreGrounded } from "./prompt.js";

export const RESUME_TAILOR = "resume.tailor";
const MAX_TARGETS = 60;

export const PRESETS: Record<string, string> = {
  concise: "Tighten each bullet to one high-signal line; cut filler.",
  quantify: "Surface numbers the bullet already states or clearly implies (%, $, scale, time). Never add a figure that isn't there.",
  keywords: "Work in the target keywords where the candidate's bullet already shows that experience.",
  "strong-verbs": "Open each bullet with a strong, specific action verb instead of 'worked on' or 'helped'.",
  impact: "Lead with the outcome and impact rather than the responsibility.",
};

const SYSTEM = `You edit resume bullets for one candidate. You are given their bullets (and maybe their summary), each with an id.

Return only the snippets you would change, each with its id, the new text and a short reason.

How to rewrite a bullet: one line; a strong action verb; just enough context; end on the result. Use numbers only when the original states or clearly implies them — never invent, estimate or inflate a figure. Summaries: 2–3 crisp sentences aimed at the target role.

Never invent experience, tools, employers, titles, dates or credentials. Use a target keyword only where the bullet already shows that experience. Keep each rewrite about as long as the original or shorter. If a snippet is already strong, leave it out.

${DATA_RULE}`;

export const proposalAnswerSchema = z.object({
  items: z
    .array(z.object({
      id: z.string().describe("The id of the snippet, exactly as given."),
      text: z.string().describe("The rewritten snippet."),
      reason: z.string().describe("Why, in ≤ 12 words (e.g. 'leads with the outcome')."),
    }))
    .max(MAX_TARGETS),
});
export type ProposalAnswer = z.infer<typeof proposalAnswerSchema>;

interface Target {
  id: string;
  kind: "bullet" | "summary";
  text: string;
  context: string;
}

function inScope(scope: RewriteScope | "all", sectionId: string, entryId: string): boolean {
  if (scope === "all") return true;
  if (scope.entryId) return entryId === scope.entryId;
  if (scope.sectionId) return sectionId === scope.sectionId;
  return true;
}

function collectTargets(doc: ResumeDocument, scope: RewriteScope | "all"): Target[] {
  const out: Target[] = [];
  for (const section of doc.sections) {
    // A section hidden in the editor isn't on the resume — don't spend a call on it.
    if ((section as { hidden?: boolean }).hidden) continue;
    for (const entry of section.entries) {
      if (!inScope(scope, section.id, entry.id)) continue;
      if (section.type === "summary") {
        const text = ((entry.extra as { text?: string } | undefined)?.text ?? "").trim();
        if (text) out.push({ id: entry.id, kind: "summary", text, context: "Summary" });
        continue;
      }
      for (const b of entry.bullets) {
        if (b.text.trim()) out.push({ id: b.id, kind: "bullet", text: b.text.trim(), context: [entry.title, entry.org].filter(Boolean).join(" @ ") });
      }
    }
  }
  return out.slice(0, MAX_TARGETS);
}

function textAt(doc: ResumeDocument, path: string): { kind: "bullet" | "summary"; text: string } | null {
  for (const s of doc.sections) {
    for (const e of s.entries) {
      if (s.type === "summary" && e.id === path) return { kind: "summary", text: ((e.extra as { text?: string } | undefined)?.text ?? "").trim() };
      for (const b of e.bullets) if (b.id === path) return { kind: "bullet", text: b.text.trim() };
    }
  }
  return null;
}

function setTextAt(doc: ResumeDocument, path: string, text: string): boolean {
  for (const s of doc.sections) {
    for (const e of s.entries) {
      if (s.type === "summary" && e.id === path) {
        (e.extra ??= {}).text = text;
        return true;
      }
      for (const b of e.bullets) if (b.id === path) { b.text = text; return true; }
    }
  }
  return false;
}

export interface TailorRequest {
  scope: RewriteScope | "all";
  instruction?: string;
  preset?: string;
  targetRole?: string;
}

function buildPrompt(doc: IResumeDocument, req: TailorRequest, targets: Target[]): string {
  const directive = [req.preset && PRESETS[req.preset] ? PRESETS[req.preset] : "", req.instruction?.trim() ?? ""].filter(Boolean).join(" ");
  return [
    req.targetRole ? `Target role: ${req.targetRole}` : "",
    doc.jdKeywords?.length ? `Target keywords (only where the bullet already shows the experience): ${doc.jdKeywords.slice(0, 25).join(", ")}` : "",
    `Instruction: ${directive || "Improve clarity and impact."}`,
    "",
    fence("bullets", targets.map((t) => `[${t.id}]${t.context ? ` (${t.context})` : ""} ${t.text}`).join("\n")),
  ].filter(Boolean).join("\n");
}

/** The checks every proposal passes, whoever wrote it. */
function vet(targets: Target[], answer: ProposalAnswer, source: IResumeProposal["source"]) {
  const byId = new Map(targets.map((t) => [t.id, t]));
  const kept: IResumeProposal[] = [];
  let dropped = 0;
  const seen = new Set<string>();
  for (const item of answer.items) {
    const t = byId.get(item.id);
    const after = item.text.trim();
    if (!t || seen.has(t.id) || !after || after === t.text) continue;
    if (!numbersAreGrounded(after, t.text) || after.length > t.text.length * 1.6 + 40) {
      dropped += 1;
      continue;
    }
    seen.add(t.id);
    kept.push({
      id: crypto.randomUUID(),
      path: t.id,
      kind: t.kind,
      before: t.text,
      after,
      reason: item.reason.trim().slice(0, 140),
      source,
      createdAt: new Date(),
    });
  }
  return { kept, dropped };
}

/** Store proposals, replacing any still pending for the same snippets. */
function store(docModel: IResumeDocument, proposals: IResumeProposal[]) {
  const paths = new Set(proposals.map((p) => p.path));
  docModel.proposals = [...(docModel.proposals ?? []).filter((p) => !paths.has(p.path)), ...proposals];
}

/** Ask HireTrail's AI for proposals (the person waits). */
export async function proposeRewrites(user: AiUser, docModel: IResumeDocument, req: TailorRequest) {
  const targets = collectTargets(docModel.document, req.scope);
  if (!targets.length) return { proposals: [] as IResumeProposal[], dropped: 0 };
  const { data } = await runAiObject(user, RESUME_TAILOR, {
    system: SYSTEM,
    prompt: buildPrompt(docModel, req, targets),
    schema: proposalAnswerSchema,
    cache: false, // the same request should be able to give a fresh take
  });
  const { kept, dropped } = vet(targets, data, "ai");
  store(docModel, kept);
  await docModel.save();
  return { proposals: kept, dropped };
}

/** What an assistant needs to propose for this document (MCP). */
export function tailoringBrief(docModel: IResumeDocument, req: TailorRequest) {
  const targets = collectTargets(docModel.document, req.scope);
  return {
    instructions: SYSTEM,
    targetKeywords: docModel.jdKeywords ?? [],
    snippets: targets.map((t) => ({ id: t.id, kind: t.kind, context: t.context, text: t.text })),
  };
}

/** Take an assistant's proposals through the same checks. */
export async function proposeFromAssistant(docModel: IResumeDocument, answer: ProposalAnswer) {
  const targets = collectTargets(docModel.document, "all");
  const { kept, dropped } = vet(targets, answer, "assistant");
  store(docModel, kept);
  await docModel.save();
  return { proposals: kept, dropped };
}

/**
 * Accept proposals: each is applied only if its snippet still reads as it did
 * when proposed. One undo snapshot covers the whole acceptance.
 */
export async function acceptProposals(docModel: IResumeDocument, ids: string[] | "all") {
  const want = (docModel.proposals ?? []).filter((p) => ids === "all" || ids.includes(p.id));
  if (!want.length) return { applied: [] as string[], stale: [] as string[], score: null };
  const before = computeScore(docModel.document, docModel.jdKeywords);
  const next: ResumeDocument = JSON.parse(JSON.stringify(docModel.document));
  const applied: string[] = [];
  const stale: string[] = [];
  for (const p of want) {
    const current = textAt(next, p.path);
    if (current && current.text === p.before && setTextAt(next, p.path, p.after)) applied.push(p.id);
    else stale.push(p.id);
  }
  const settled = new Set([...applied, ...stale]);
  if (applied.length) {
    snapshot(docModel, applied.length === 1 ? "Before accepting a rewrite" : `Before accepting ${applied.length} rewrites`);
    docModel.document = next;
    docModel.version += 1;
    docModel.markModified("document");
  }
  docModel.proposals = (docModel.proposals ?? []).filter((p) => !settled.has(p.id));
  await docModel.save();
  return { applied, stale, score: { before, after: computeScore(docModel.document, docModel.jdKeywords) } };
}

export async function rejectProposals(docModel: IResumeDocument, ids: string[] | "all") {
  docModel.proposals = ids === "all" ? [] : (docModel.proposals ?? []).filter((p) => !ids.includes(p.id));
  await docModel.save();
}
