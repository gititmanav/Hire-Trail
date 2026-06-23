/**
 * PDF text extraction for resume parsing (task 5).
 *
 * Uses unpdf (pdf.js under the hood). Returns the merged text plus the page
 * count so the parser can reason about density: a multi-page PDF that yields
 * almost no text is almost certainly scanned/image-only, which we surface as a
 * clear, actionable error rather than feeding the model an empty string.
 *
 * Whitespace is normalized (de-hyphenated line breaks, collapsed runs of blank
 * lines) so the LLM sees clean prose and the chunker can split on real
 * paragraph boundaries.
 */
import { extractText, getDocumentProxy } from "unpdf";

export interface ExtractedPdf {
  text: string;
  pages: number;
  /** True when the text is too sparse for the page count → likely scanned. */
  scanned: boolean;
}

/** Below this many characters per page we treat the PDF as image-only. A normal
 *  resume page is 1.5–3k chars; 40 is comfortably below even a sparse real page. */
const MIN_CHARS_PER_PAGE = 40;

function normalize(raw: string): string {
  return raw
    // join words split across a line break by a hyphen: "experi-\nence" → "experience"
    .replace(/(\w)-\n(\w)/g, "$1$2")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export async function extractPdfText(buffer: Buffer): Promise<ExtractedPdf> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const pages = pdf.numPages ?? 1;
  const { text } = await extractText(pdf, { mergePages: true });
  const merged = Array.isArray(text) ? text.join("\n") : text;
  const clean = normalize(merged || "");
  const scanned = clean.length < MIN_CHARS_PER_PAGE * Math.max(1, pages);
  return { text: clean, pages, scanned };
}
