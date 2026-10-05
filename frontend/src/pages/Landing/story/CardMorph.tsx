/** "The card becomes the page": the end of both stories. The Dark theme
 *  card in Personalize lifts out of the product window and grows to fill the
 *  screen — first as the app's dark shell (sidebar, the main panel, the
 *  accent dot), then settling into the page's own black, where the next
 *  chapter begins.
 *
 *  It's drawn, not zoomed: a box sized by layout each frame, so its edges
 *  stay sharp at every size (scaling the window up to the card's size
 *  magnified the UI into blur). It starts exactly over the card's preview —
 *  ShellPreview's geometry, in design px × the window's scale — so the
 *  hand-over is invisible. Decorative. */
import { forwardRef } from "react";
import { css, lerpBox, round, type Box } from "../engine/dom.ts";
import { clamp01, easeInOut, range } from "../engine/scroll.ts";

/** The Dark card's preview frame and ShellPreview's parts, in design px
 *  (SettingsScreen / the phone screens): the frame's rounded-lg, the main
 *  panel's my/mr-1.5 (+ the frame's 1px border), rounded-md, the dot. */
const PREVIEW = { radius: 8, inset: 7, panelRadius: 6, dot: 8, sidebar: 0.26 } as const;

const CardMorph = forwardRef<HTMLDivElement>(function CardMorph(_, ref) {
  return (
    <div ref={ref} className="lp-morph theme-dark" aria-hidden style={{ visibility: "hidden" }}>
      <div className="lp-morph-panel">
        <span className="lp-morph-dot" />
      </div>
    </div>
  );
});

export default CardMorph;

/** Paint the morph `t` (0…1) of the way from the card (`from`, on screen; it
 *  is drawn at `scale` × design px) to `to` (the stage). Before it grows it
 *  `lift`s (0…1): a touch larger, casting a shadow — picked up. */
export function paintMorph(el: HTMLElement | null, from: Box, to: Box, scale: number, t: number, lift = 0) {
  if (!el) return;
  if (t <= 0 && lift <= 0) {
    css(el, { visibility: "hidden" });
    return;
  }
  const e = easeInOut(clamp01(t));
  // The lift settles as it grows: full at the start, gone at full size.
  const l = clamp01(lift) * (1 - e);
  const r = lerpBox(from, to, e);
  // How much the card has grown; its parts grow with it, within reason.
  const grow = r.w / Math.max(1, from.w);
  const unit = scale * grow;
  css(el, {
    visibility: "visible",
    transform: `translate3d(${round(r.x, 1)}px, ${round(r.y, 1)}px, 0) scale(${round(1 + 0.08 * l, 4)})`,
    "--lp-morph-shadow": round(l),
    width: `${round(r.w, 1)}px`,
    height: `${round(r.h, 1)}px`,
    borderRadius: `${round(PREVIEW.radius * scale * (1 - e), 2)}px`,
    "--lp-morph-sidebar": `${PREVIEW.sidebar * 100}%`,
    "--lp-morph-inset": `${round(Math.min(PREVIEW.inset * unit, 48), 1)}px`,
    "--lp-morph-r": `${round(Math.min(PREVIEW.panelRadius * unit, 22), 1)}px`,
    "--lp-morph-dot": `${round(Math.min(PREVIEW.dot * unit, 14), 1)}px`,
    // The shell's parts melt away last, and the page's black comes up under them.
    "--lp-morph-parts": round(1 - range(e, 0.62, 0.92)),
    "--lp-morph-night": round(range(e, 0.7, 1)),
  });
}
