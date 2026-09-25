/** Motion constants shared by the ui/ primitives. Keep in step with the CSS
 *  motion classes in App.css (float-in/out, modal-in/out, collapse). */

/** Exit animations are quicker than entrances — leaving should never feel slow. */
export const EXIT_MS = 140;
export const COLLAPSE_MS = 200;

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}
