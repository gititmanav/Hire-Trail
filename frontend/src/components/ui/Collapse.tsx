/** Animated disclosure body — list groups, expandable sections.
 *
 *  Height eases between closed and open by transitioning grid-template-rows
 *  (0fr ↔ 1fr), so nothing is measured in JS. Content unmounts once closed, so
 *  a collapsed section costs nothing; while it closes, the last open content
 *  stays on screen, inert, until the motion ends. The first render never
 *  animates (a page load isn't a gesture). Honors prefers-reduced-motion. */
import { ReactNode, useLayoutEffect, useRef, useState } from "react";
import { COLLAPSE_MS, prefersReducedMotion } from "../../utils/motion.ts";

/** mount (0fr) → expanding (1fr, moving) → open (at rest) → closing (0fr, moving) → closed (unmounted) */
type Phase = "mount" | "expanding" | "open" | "closing" | "closed";

export default function Collapse({ open, children, id }: {
  open: boolean;
  children: ReactNode;
  id?: string;
}) {
  const [phase, setPhase] = useState<Phase>(open ? "open" : "closed");
  const ref = useRef<HTMLDivElement>(null);
  const last = useRef<ReactNode>(children);
  if (open) last.current = children;

  useLayoutEffect(() => {
    const reduced = prefersReducedMotion();
    if (open && (phase === "closing" || phase === "closed")) setPhase(reduced ? "open" : "mount");
    if (!open && (phase === "mount" || phase === "expanding" || phase === "open")) setPhase(reduced ? "closed" : "closing");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // "mount" renders at 0fr; force that style to apply, then switch to 1fr in
  // the same commit so the browser transitions between the two.
  useLayoutEffect(() => {
    if (phase !== "mount") return;
    void ref.current?.offsetHeight;
    setPhase("expanding");
  }, [phase]);

  // Settle after the motion. A timer (not transitionend) so an interrupted or
  // skipped transition can never leave a section half-mounted.
  useLayoutEffect(() => {
    if (phase !== "expanding" && phase !== "closing") return;
    const t = window.setTimeout(() => setPhase(phase === "closing" ? "closed" : "open"), COLLAPSE_MS + 40);
    return () => window.clearTimeout(t);
  }, [phase]);

  // Closing content is a leftover picture — it must not take focus or clicks.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (phase === "closing") el.setAttribute("inert", ""); else el.removeAttribute("inert");
  }, [phase]);

  if (phase === "closed") return null;
  const expanded = phase === "expanding" || phase === "open";
  return (
    <div
      ref={ref}
      id={id}
      className="grid transition-[grid-template-rows] duration-200 ease-smooth motion-reduce:transition-none"
      style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
    >
      {/* Clip only while moving, so focus rings and popover anchors behave normally at rest. */}
      <div className={`min-h-0 ${phase === "open" ? "" : "overflow-hidden"}`}>
        {open ? children : last.current}
      </div>
    </div>
  );
}
