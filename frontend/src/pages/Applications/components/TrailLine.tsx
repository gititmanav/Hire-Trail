/** One application's trail: a line through its stages on a time axis.
 *
 *  Drawn as plain boxes positioned by two custom properties — `--t0` (the
 *  window's first day, relative to today) and `--span` (its length in days) —
 *  so a parent can move or zoom every trail at once by changing two numbers.
 *  The Trail view registers them (App.css "Trails") and transitions them,
 *  which glides every line on the compositor-light path of one style change;
 *  small trails (Ledger, Board, Desk) pass a fixed window.
 *
 *  Live trails end in a dot at today; past the reply window the current
 *  stage fades; a rejection ends the line with a cross; the next dated step
 *  is a diamond ahead of today (behind it, red, when overdue). */
import { memo, type CSSProperties } from "react";
import { STAGE_FAMILY } from "../../../utils/stageStyles.ts";
import { cssPalette } from "../../../utils/palette.ts";
import type { TrailShape } from "../data/focus.ts";
import type { Stage } from "../../../types";

const color = (stage: Stage, alpha?: number) => cssPalette(`${STAGE_FAMILY[stage]}-500`, alpha);
const pct = (x: number) => `${Math.round(Math.min(100, Math.max(0, x)) * 10) / 10}%`;

type Vars = CSSProperties & Record<`--${string}`, string | number>;

export default memo(function TrailLine({ shape, window: win, size = "sm", labels = false, className = "" }: {
  shape: TrailShape;
  /** [first day, last day] relative to today. Omit to inherit the parent's --t0/--span (the Trail view). */
  window?: [number, number];
  size?: "sm" | "lg";
  /** Name the next step beside its diamond. */
  labels?: boolean;
  className?: string;
}) {
  const style: Vars = win ? { "--t0": win[0], "--span": win[1] - win[0] } : {};
  // A small trail is history only — the next step is the focus line's job.
  const next = size === "lg" ? shape.next : null;
  return (
    <div className={`trail trail-${size} ${className}`} style={style} aria-hidden>
      {size === "sm" && <span className="trail-base" />}
      <div className="trail-track">
        {shape.segments.map((s, i) => {
          const len = s.to - s.from;
          let background = color(s.stage);
          if (s.current && shape.fade && len > 0) {
            const a = ((shape.fade.from - s.from) / len) * 100, b = ((shape.fade.to - s.from) / len) * 100;
            background = `linear-gradient(90deg, ${color(s.stage)} ${pct(a)}, ${color(s.stage, 0.16)} ${pct(Math.max(b, a + 0.1))}, ${color(s.stage, 0.16)})`;
          }
          return <span key={i} className="trail-seg" style={{ "--a": s.from, "--b": s.to, background } as Vars} />;
        })}
        {shape.nodes.map((n, i) => (
          <span
            key={i}
            className={`trail-dot ${n.stage === "Drafting" ? "trail-dot-hollow" : ""}`}
            style={{ "--at": n.at, "--c": color(n.stage) } as Vars}
          />
        ))}
        {shape.live && shape.segments.length > 0 && !(next?.overdue) && (
          <span className="trail-dot trail-dot-end" style={{ "--at": 0, "--c": color(shape.segments[shape.segments.length - 1].stage) } as Vars} />
        )}
        {shape.closedAt !== null && <span className="trail-cross" style={{ "--at": shape.closedAt, "--c": color("Rejected") } as Vars} />}
        {next && (
          <>
            {!next.overdue && <span className="trail-link" style={{ "--a": 0, "--b": next.at } as Vars} />}
            {/* Overdue: it's due now — the red diamond sits at today and its
                label reads ahead, never over the line it's late on. */}
            <span className={`trail-diamond ${next.overdue ? "is-overdue" : ""}`} style={{ "--at": next.overdue ? 0 : next.at } as Vars} />
            {labels && (
              <span className={`trail-label ${next.overdue ? "is-overdue" : ""}`} style={{ "--at": next.overdue ? 0 : next.at } as Vars}>
                {next.label}
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
});
