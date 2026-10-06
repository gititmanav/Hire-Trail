/** Motion constants shared by the ui/ primitives. Keep in step with the CSS
 *  motion classes in App.css (float-in/out, modal-in/out, collapse). */

/** Exit animations are quicker than entrances — leaving should never feel slow. */
export const EXIT_MS = 140;
/** A dialog leaves a touch slower than a menu, so it fades away rather than
 *  blinking out. Keep in step with App.css `.modal-exit`. */
export const MODAL_EXIT_MS = 200;
/** The soft dialog (ui/Modal `motion="soft"` — the sign-in sheet): a slower,
 *  gentler arrival and departure. Keep in step with App.css `.modal-soft-*`. */
export const SOFT_EXIT_MS = 260;
/** A side panel (ui/Drawer) slides back out to the edge. Keep in step with
 *  App.css `.drawer-exit`. */
export const DRAWER_EXIT_MS = 240;
export const COLLAPSE_MS = 200;

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}
