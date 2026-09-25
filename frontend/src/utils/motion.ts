/** Motion constants shared by the ui/ primitives. Keep in step with the CSS
 *  motion classes in App.css (float-in/out, modal-in/out, collapse). */

/** Exit animations are quicker than entrances — leaving should never feel slow. */
export const EXIT_MS = 140;
/** The soft dialog (ui/Modal `motion="soft"` — the sign-in sheet): a slower,
 *  gentler arrival and departure. Keep in step with App.css `.modal-soft-*`. */
export const SOFT_EXIT_MS = 260;
export const COLLAPSE_MS = 200;

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}
