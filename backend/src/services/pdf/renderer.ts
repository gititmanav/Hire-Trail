/**
 * Typst PDF renderer for resumes.
 *
 *   renderResumePdf(profile) → { pdf: Buffer, pages: number, warnings: string[] }
 *
 * Multi-page is allowed. We NEVER force content onto one page by deleting the
 * user's bullets/experience — silently dropping work history was the old
 * behaviour and it surprised users (task 7). We compile once at normal density
 * and return however many pages the content needs.
 */
import path from "path";
import { NodeCompiler } from "@myriaddreamin/typst-ts-node-compiler";
import type { IMasterProfile } from "../../models/MasterProfile.js";
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

export function renderResumePdf(profile: IMasterProfile): RenderResult {
  // Compile once at normal density. Content that runs long flows to additional
  // pages — we do NOT trim or delete the user's bullets/experience to force one
  // page. The page count is returned so callers can surface it if they wish.
  const { pdf, pages } = compile(profile, "normal");
  return { pdf, pages, warnings: [] };
}
