/** Text inked by a soft sweep of light — the hero's beams, carried through
 *  the page as one motif. A pale ghost of the words is there first; the ink
 *  arrives from the left, line after line in reading order (it's an inline
 *  span, so its background runs through the lines as one strip).
 *
 *  By default the sweep follows the text through the viewport on the
 *  browser's own scroll timeline (`animation-timeline: view()`); where that
 *  isn't supported, or under reduced motion, the text is simply inked. Text
 *  on a pinned stage doesn't travel through the viewport — pass `driven` and
 *  set `--lp-sweep` (0 → 1) from the scene instead. */
import { forwardRef, type ReactNode } from "react";

const Sweep = forwardRef<HTMLSpanElement, { children: ReactNode; tone: "light" | "dark"; driven?: boolean }>(
  function Sweep({ children, tone, driven }, ref) {
    return (
      <span ref={ref} className={`lp-sweep lp-sweep--${tone} ${driven ? "" : "lp-sweep-view"}`}>
        {children}
      </span>
    );
  },
);

export default Sweep;
