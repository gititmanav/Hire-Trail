/**
 * Typst PDF renderer for resumes with auto-fit-to-one-page.
 *
 *   renderResumePdf(profile) → { pdf: Buffer, pages: number, warnings: string[] }
 *
 * Strategy when the first compile overflows past one page:
 *   1. Re-render at "compact" density (tighter margins, slightly smaller body, leaner leading).
 *   2. If still over, iteratively drop the oldest experience/project bullet and retry until
 *      it fits (or we run out of bullets to drop).
 *
 * We always retain the user's actual content where possible. A warning describes what
 * (if anything) we trimmed so the user can decide whether to shorten further by hand.
 */
import path from "path";
import { NodeCompiler } from "@myriaddreamin/typst-ts-node-compiler";
import type { IMasterProfile, IExperience, IProject } from "../../models/MasterProfile.js";
import { buildResumeTypst, type Density } from "./template.js";

// Single process-wide compiler — NodeCompiler retains workspace + font cache.
let _compiler: NodeCompiler | null = null;
function getCompiler(): NodeCompiler {
  if (!_compiler) _compiler = NodeCompiler.create();
  return _compiler;
}

/** Absolute path inside the workspace root for the in-memory main file.
 *  Must live inside the workspace or Typst rejects it with "prefix not found".
 *  On Windows, a leading slash like "/main.typ" resolves to E:\main.typ — outside
 *  the workspace — so we explicitly join with cwd. */
const MAIN_FILE_PATH = path.join(process.cwd(), "hiretrail-main.typ");

function countPdfPages(buf: Buffer): number {
  const text = buf.toString("latin1");
  const matches = text.match(/\/Type\s*\/Page\b(?!s)/g);
  return matches ? matches.length : 1;
}

export interface RenderResult {
  pdf: Buffer;
  pages: number;
  warnings: string[];
}

const MAX_TRIM_ITERATIONS = 25;

function compile(profile: IMasterProfile, density: Density): { pdf: Buffer; pages: number } {
  const source = buildResumeTypst(profile, { density });
  const compiler = getCompiler();
  compiler.mapShadow(MAIN_FILE_PATH, Buffer.from(source, "utf8"));

  let pdf: Buffer;
  try {
    pdf = compiler.pdf({ mainFilePath: MAIN_FILE_PATH });
  } catch (err) {
    const e = err as { message?: string };
    throw new Error(`Typst compile failed: ${e.message || "unknown error"}`);
  } finally {
    compiler.unmapShadow(MAIN_FILE_PATH);
  }

  if (!pdf || pdf.length === 0) throw new Error("Typst compile returned no PDF data");

  return { pdf, pages: countPdfPages(pdf) };
}

/** Drop the last bullet from the entry that currently has the most bullets, preferring
 *  experience entries that are further back in time (i.e. lower in the list, which we
 *  treat as older — the parser emits chronological order with most recent first).
 *  Returns the dropped bullet text for the trim warning, or null if nothing left to trim. */
function dropOldestBullet(profile: IMasterProfile): string | null {
  // 1. Try experience: walk from oldest (end of list) to newest, drop one bullet from the
  //    first entry that has > 2 bullets. We don't strip an entry to zero bullets.
  for (let i = profile.experiences.length - 1; i >= 0; i--) {
    const exp = profile.experiences[i] as IExperience;
    if (exp.bullets.length > 2) {
      const dropped = exp.bullets.pop();
      return dropped ? `${exp.company || "experience"} bullet` : null;
    }
  }
  // 2. Try projects: same walk.
  for (let i = profile.projects.length - 1; i >= 0; i--) {
    const proj = profile.projects[i] as IProject;
    if (proj.bullets.length > 2) {
      const dropped = proj.bullets.pop();
      return dropped ? `${proj.name || "project"} bullet` : null;
    }
  }
  // 3. As a last resort, allow trimming down to 1 bullet (still leaves a signal of work done).
  for (let i = profile.experiences.length - 1; i >= 0; i--) {
    const exp = profile.experiences[i] as IExperience;
    if (exp.bullets.length > 1) {
      const dropped = exp.bullets.pop();
      return dropped ? `${exp.company || "experience"} bullet` : null;
    }
  }
  for (let i = profile.projects.length - 1; i >= 0; i--) {
    const proj = profile.projects[i] as IProject;
    if (proj.bullets.length > 1) {
      const dropped = proj.bullets.pop();
      return dropped ? `${proj.name || "project"} bullet` : null;
    }
  }
  return null;
}

function deepClone<T>(o: T): T {
  return JSON.parse(JSON.stringify(o));
}

export function renderResumePdf(profile: IMasterProfile): RenderResult {
  // Pass 1: normal density
  const first = compile(profile, "normal");
  if (first.pages === 1) return { pdf: first.pdf, pages: 1, warnings: [] };

  // Pass 2: compact density on the original profile
  const compactFirst = compile(profile, "compact");
  if (compactFirst.pages === 1) {
    return {
      pdf: compactFirst.pdf,
      pages: 1,
      warnings: ["Tightened margins and spacing to fit one page."],
    };
  }

  // Pass 3+: trim oldest bullets one at a time, in compact mode.
  const working = deepClone(profile);
  let droppedCount = 0;
  let lastRender = compactFirst;
  for (let i = 0; i < MAX_TRIM_ITERATIONS; i++) {
    const removed = dropOldestBullet(working);
    if (!removed) break;
    droppedCount++;
    lastRender = compile(working, "compact");
    if (lastRender.pages === 1) {
      return {
        pdf: lastRender.pdf,
        pages: 1,
        warnings: [
          `Tightened spacing and trimmed ${droppedCount} oldest bullet${droppedCount > 1 ? "s" : ""} to fit one page.`,
        ],
      };
    }
  }

  // Still over after exhausting trim options — return the best we have plus a directive warning.
  return {
    pdf: lastRender.pdf,
    pages: lastRender.pages,
    warnings: [
      `Could not shrink to one page after trimming ${droppedCount} bullets. Consider removing an experience entry or shortening your summary.`,
    ],
  };
}
