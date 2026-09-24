/** Field helpers that work on both payload shapes an Application arrives in:
 *  the full document, and the list "summary" (no jobDescription text, but a
 *  server-computed hasJobDescription flag). */
import type { Application } from "../types";

export function hasJobDescription(app: Application): boolean {
  return app.jobDescription != null ? app.jobDescription.trim().length > 0 : !!app.hasJobDescription;
}
