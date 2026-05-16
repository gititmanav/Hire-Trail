/**
 * Typst PDF renderer for resumes.
 *
 *   renderResumePdf(profile) → { pdf: Buffer, pages: number, warnings: string[] }
 *
 * If the result exceeds one page, we still return the PDF but include a warning so
 * the caller can surface it to the user (we don't auto-trim — content loss without
 * consent is a worse failure mode than asking the user to shorten).
 */
import { NodeCompiler } from "@myriaddreamin/typst-ts-node-compiler";
import type { IMasterProfile } from "../../models/MasterProfile.js";
import { buildResumeTypst } from "./template.js";

// NOTE: NodeCompiler instances retain a workspace + cache, so we keep a single
// process-wide compiler. The mapShadow API lets us swap the main.typ content per call.
let _compiler: NodeCompiler | null = null;
function getCompiler(): NodeCompiler {
  if (!_compiler) _compiler = NodeCompiler.create();
  return _compiler;
}

function countPdfPages(buf: Buffer): number {
  // Cheap regex over PDF body. Typst's output uses `/Type /Page` (not `/Pages`).
  // Bounded scan to keep this fast on big PDFs.
  const text = buf.toString("latin1");
  const matches = text.match(/\/Type\s*\/Page\b(?!s)/g);
  return matches ? matches.length : 1;
}

export interface RenderResult {
  pdf: Buffer;
  pages: number;
  warnings: string[];
}

export function renderResumePdf(profile: IMasterProfile): RenderResult {
  const source = buildResumeTypst(profile);
  const compiler = getCompiler();

  // Provide source via the in-memory shadow filesystem so we don't touch disk.
  const mainPath = "/main.typ";
  compiler.mapShadow(mainPath, Buffer.from(source, "utf8"));

  let pdf: Buffer;
  try {
    pdf = compiler.pdf({ mainFilePath: mainPath });
  } catch (err) {
    const e = err as { message?: string };
    throw new Error(`Typst compile failed: ${e.message || "unknown error"}`);
  } finally {
    compiler.unmapShadow(mainPath);
  }

  if (!pdf || pdf.length === 0) {
    throw new Error("Typst compile returned no PDF data");
  }

  const pages = countPdfPages(pdf);
  const warnings: string[] = [];
  if (pages > 1) {
    warnings.push(
      `Resume rendered to ${pages} pages. ATS readers prefer 1 page — trim a bullet or two and re-export.`
    );
  }

  return { pdf, pages, warnings };
}
