/**
 * Section-scoped resume rewriting (task 8) — powers the "AI Rewrite" tab.
 *
 * Rewrites ONLY the text inside the requested scope (a section, an entry, or the
 * whole doc), and only the *prose* fields — bullets and the summary. Facts
 * (employer, title, dates, school) are never sent for rewriting, so the model
 * cannot fabricate them. The system prompt forbids inventing experience,
 * metrics, or skills the candidate doesn't have.
 *
 * Returns the updated document plus a field-level diff: `changes` (human-readable
 * + before/after) and `changedPaths` (the stable element ids that changed) so the
 * editor can highlight exactly what moved.
 */
import { z } from "zod";
import mongoose from "mongoose";

import { runGenerateObject } from "./run.js";
import type { ResumeDocument, RewriteScope } from "../resume/types.js";

export interface RewriteChange {
  /** Stable element id of the changed field (= the path the editor addresses). */
  path: string;
  summary: string;
  before: string;
  after: string;
}

export interface RewriteResult {
  document: ResumeDocument;
  changes: RewriteChange[];
  changedPaths: string[];
}

interface RewriteTarget {
  id: string;
  kind: "bullet" | "summary";
  text: string;
  /** Setter that writes new text back into the (cloned) document. */
  set: (doc: ResumeDocument, text: string) => void;
  context: string;
}

const PRESETS: Record<string, string> = {
  concise: "Tighten every targeted bullet to one high-signal line; remove filler words.",
  quantify: "Surface concrete numbers (%, $, scale, time) the candidate's results already imply — never invent figures.",
  keywords: "Naturally weave in the target keywords the candidate genuinely has experience with.",
  "strong-verbs": "Start each bullet with a strong, specific action verb; drop weak openers like 'worked on' or 'helped'.",
  impact: "Reframe each bullet around outcome and impact rather than responsibilities.",
};

const SYSTEM_PROMPT = `You are an expert resume editor. You rewrite ONLY the text snippets you are given, returning an improved version of each by its id.

HOW TO REWRITE A BULLET (STAR, compressed to one line):
- Lead with a strong, specific ACTION verb; fold in just enough Situation/Task for context; end on the RESULT or impact.
- Do NOT print the literal words "Situation/Task/Action/Result" — STAR is the shape, not labels. One tight line, not a paragraph.
- QUANTIFY only where the candidate's existing text already implies a number, scale, %, $, time, or volume. Surface that implied figure; do NOT invent, estimate, inflate, or stuff metrics. A bullet with no real number stays unquantified rather than fabricated.

SUMMARIES: 2–3 crisp sentences aimed at the target role; tighten and de-fluff — do not force STAR.

HARD RULES — never break these:
- NEVER invent experience, employers, job titles, dates, schools, certifications, or metrics. If a number isn't already implied by the text, do not add one.
- Only improve wording: tighten, clarify, lead with strong action verbs, and weave in the provided target keywords WHERE the candidate clearly already has that experience.
- Keep each rewritten snippet roughly the same length or shorter. Bullets stay to one line where possible.
- Preserve the candidate's real meaning. If a snippet is already strong, return it unchanged.
- Return one item per input id, using the SAME id. Do not add, drop, or merge ids.`;

const rewriteSchema = z.object({
  items: z.array(z.object({ id: z.string(), text: z.string() })),
});

function clone(doc: ResumeDocument): ResumeDocument {
  return JSON.parse(JSON.stringify(doc));
}

/** True if the entry/section is in scope. */
function inScope(scope: RewriteScope | "all", sectionId: string, entryId?: string): boolean {
  if (scope === "all") return true;
  if (scope.entryId) return entryId === scope.entryId;
  if (scope.sectionId) return sectionId === scope.sectionId;
  return true;
}

/** Collect rewritable prose targets within scope. */
function collectTargets(doc: ResumeDocument, scope: RewriteScope | "all"): RewriteTarget[] {
  const targets: RewriteTarget[] = [];
  for (const section of doc.sections) {
    for (const entry of section.entries) {
      if (!inScope(scope, section.id, entry.id)) continue;

      if (section.type === "summary") {
        const text = (entry.extra as { text?: string } | undefined)?.text ?? "";
        if (text.trim()) {
          const eid = entry.id;
          targets.push({
            id: eid,
            kind: "summary",
            text,
            context: "Professional summary",
            set: (d, t) => {
              const e = findEntry(d, eid);
              if (e) (e.extra ??= {}).text = t;
            },
          });
        }
        continue;
      }

      for (const bullet of entry.bullets) {
        if (!bullet.text.trim()) continue;
        const bid = bullet.id;
        targets.push({
          id: bid,
          kind: "bullet",
          text: bullet.text,
          context: [entry.title, entry.org].filter(Boolean).join(" @ "),
          set: (d, t) => {
            const b = findBullet(d, bid);
            if (b) b.text = t;
          },
        });
      }
    }
  }
  return targets;
}

function findEntry(doc: ResumeDocument, id: string) {
  for (const s of doc.sections) for (const e of s.entries) if (e.id === id) return e;
  return undefined;
}
function findBullet(doc: ResumeDocument, id: string) {
  for (const s of doc.sections) for (const e of s.entries) for (const b of e.bullets) if (b.id === id) return b;
  return undefined;
}

export interface RewriteInput {
  userId: string | mongoose.Types.ObjectId;
  document: ResumeDocument;
  scope: RewriteScope | "all";
  instruction?: string;
  preset?: string;
  /** JD keywords to weave in where genuinely applicable. */
  jdKeywords?: string[];
  targetRole?: string;
}

export async function rewriteDocument(input: RewriteInput): Promise<RewriteResult> {
  const targets = collectTargets(input.document, input.scope);
  if (targets.length === 0) {
    return { document: input.document, changes: [], changedPaths: [] };
  }

  const directives = [
    input.preset && PRESETS[input.preset] ? PRESETS[input.preset] : "",
    input.instruction?.trim() || "",
  ].filter(Boolean);
  const keywordLine = input.jdKeywords?.length
    ? `Target keywords (use ONLY where the candidate genuinely has the experience): ${input.jdKeywords.slice(0, 25).join(", ")}.`
    : "";

  const prompt = [
    input.targetRole ? `Target role: ${input.targetRole}` : "",
    keywordLine,
    directives.length ? `Instruction: ${directives.join(" ")}` : "Instruction: Improve clarity and impact.",
    "",
    "Rewrite each snippet. Return one item per id with the same id:",
    ...targets.map((t) => `- id ${t.id}${t.context ? ` (${t.context})` : ""}: ${t.text}`),
  ]
    .filter(Boolean)
    .join("\n");

  const { object } = await runGenerateObject({
    userId: input.userId,
    capability: "smart",
    opType: "resume_rewrite",
    schema: rewriteSchema,
    system: SYSTEM_PROMPT,
    prompt,
  });

  // Apply only ids we actually asked about; ignore anything the model invented.
  const byId = new Map(targets.map((t) => [t.id, t]));
  const out = clone(input.document);
  const changes: RewriteChange[] = [];

  for (const item of object.items) {
    const target = byId.get(item.id);
    if (!target) continue;
    const after = item.text.trim();
    const before = target.text.trim();
    if (!after || after === before) continue;
    target.set(out, after);
    changes.push({
      path: target.id,
      summary: target.kind === "summary" ? "Rewrote summary" : `Rewrote bullet in ${target.context || "experience"}`,
      before,
      after,
    });
  }

  return { document: out, changes, changedPaths: changes.map((c) => c.path) };
}
