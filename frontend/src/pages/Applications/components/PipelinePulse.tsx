/**
 * "Pipeline Pulse" — the right-hand mini-dashboard rendered inside every
 * ApplicationRow. Same frame on every card so the column reads as a uniform
 * rail; only the inner content adapts to the application's state.
 *
 * Visual hierarchy (top → bottom):
 *   1. A horizontal stage track (dots + connectors) — the user's position in
 *      the funnel at a glance.
 *   2. The current-stage line: "Day X in {stage}" with the color-coded health
 *      dot from applicationHealth.
 *   3. A subtle "next" text link — never a button — so the column never has
 *      mismatched blue rectangles.
 *
 * Rationale for the text-link vs button change: the previous design used
 * `urgent ? primary : ghost` buttons which created a visually broken rhythm
 * (random blue rectangles down the column). A uniform text affordance keeps
 * the column calm; urgency now lives on the row's left-edge stripe instead.
 */
import { memo, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { HEALTH_DOT_CLASS } from "../../../utils/applicationHealth.ts";
import type { AppHealth, NextAction } from "../../../utils/applicationHealth.ts";
import type { Application, Stage } from "../../../types";
import { STAGES } from "../../../utils/stageStyles.ts";

interface Props {
  app: Application;
  health: AppHealth;
  action: NextAction;
  onOpen: () => void;
}

const STAGE_DOT_COLOR: Record<Stage, string> = {
  Drafting: "bg-slate-400",
  Applied: "bg-blue-500",
  OA: "bg-amber-500",
  Interview: "bg-purple-500",
  Offer: "bg-emerald-500",
  Rejected: "bg-red-500",
};
const STAGE_DOT_RING: Record<Stage, string> = {
  Drafting: "ring-slate-300",
  Applied: "ring-blue-300",
  OA: "ring-amber-300",
  Interview: "ring-purple-300",
  Offer: "ring-emerald-300",
  Rejected: "ring-red-300",
};

const STAGE_ABBR: Record<Stage, string> = {
  Drafting: "Dr",
  Applied: "Ap",
  OA: "OA",
  Interview: "Iv",
  Offer: "Of",
  Rejected: "Rj",
};

/** Indexes of stages on the linear funnel. Drafting < Applied < OA < Interview < (Offer | Rejected). */
const STAGE_INDEX: Record<Stage, number> = {
  Drafting: 0,
  Applied: 1,
  OA: 2,
  Interview: 3,
  Offer: 4,
  Rejected: 4,
};

function PipelinePulseImpl({ app, health, action, onOpen }: Props) {
  const navigate = useNavigate();
  const currentIdx = STAGE_INDEX[app.stage];
  const stageList = useMemo<Stage[]>(
    () => (app.stage === "Rejected"
      ? ["Drafting", "Applied", "OA", "Interview", "Rejected"]
      : ["Drafting", "Applied", "OA", "Interview", "Offer"]),
    [app.stage]
  );
  /** Stages this app actually visited (set lookup for fast checks). The track
   *  only fills dots the user reached — skipped stages stay hollow. */
  const visited = useMemo(() => {
    const set = new Set<Stage>();
    for (const entry of app.stageHistory ?? []) set.add(entry.stage);
    set.add(app.stage); // ensure current is always counted
    return set;
  }, [app.stageHistory, app.stage]);

  /** Sparkline: proportional time-in-stage segments derived from stageHistory.
   *  Each segment knows how many days the app sat in that stage; the bar gives
   *  the user a one-glance story of "where did most of my time go".
   *  Hidden when there's nothing to show (≤1 stage entry).  */
  const sparkSegments = useMemo(() => {
    const history = app.stageHistory ?? [];
    if (history.length < 2) return null;
    const sorted = [...history].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const now = Date.now();
    const totalMs = Math.max(1, now - new Date(sorted[0].date).getTime());
    const segs: Array<{ stage: Stage; pct: number; days: number }> = [];
    for (let i = 0; i < sorted.length; i += 1) {
      const startMs = new Date(sorted[i].date).getTime();
      const endMs = i + 1 < sorted.length ? new Date(sorted[i + 1].date).getTime() : now;
      const durMs = Math.max(0, endMs - startMs);
      segs.push({ stage: sorted[i].stage, pct: (durMs / totalMs) * 100, days: Math.max(0, Math.round(durMs / 86_400_000)) });
    }
    return segs;
  }, [app.stageHistory]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (action.kind === "tailor" && app.tailorSessionId) {
      navigate(`/applications?tailor=${app._id}`);
      return;
    }
    onOpen();
  };

  return (
    <div
      className="w-[220px] shrink-0 flex flex-col gap-2.5 px-3.5 py-3 border-l border-border bg-gradient-to-br from-muted/20 to-transparent"
      role="group"
      aria-label={`Pipeline — ${app.stage}, ${health.longLabel}`}
    >
      {/* Stage track — dots + connectors. A dot fills only for stages the
       *  app actually visited (stageHistory); skipped stages stay hollow even
       *  if past the current position, which keeps the picture honest. */}
      <div className="flex items-center justify-between gap-0.5">
        {stageList.map((s, i) => {
          const wasVisited = visited.has(s);
          const isCurrent = s === app.stage;
          const dotBg = wasVisited ? STAGE_DOT_COLOR[s] : "bg-border";
          const ringCls = isCurrent ? `ring-2 ring-offset-1 ring-offset-card ${STAGE_DOT_RING[s]}` : "";
          const nextStage = stageList[i + 1];
          const connectorReached = wasVisited && nextStage && STAGE_INDEX[nextStage] <= currentIdx && visited.has(nextStage);
          return (
            <div key={s} className="flex items-center flex-1 last:flex-none min-w-0">
              <div className="flex flex-col items-center gap-0.5 shrink-0">
                <span
                  className={`w-2 h-2 rounded-full ${dotBg} ${ringCls} ${isCurrent ? "animate-[pulse_2.4s_ease-in-out_infinite] motion-reduce:animate-none" : ""}`}
                  aria-hidden
                  title={`${s}${wasVisited ? "" : " (skipped)"}`}
                />
                <span className={`text-[9px] font-medium leading-none tabular-nums tracking-tight ${wasVisited ? "text-foreground" : "text-muted-foreground/50"}`}>
                  {STAGE_ABBR[s]}
                </span>
              </div>
              {i < stageList.length - 1 && (
                <div className={`flex-1 h-px mx-1 ${connectorReached ? "bg-foreground/30" : "bg-border"}`} aria-hidden />
              )}
            </div>
          );
        })}
      </div>

      {/* Time-in-stage sparkline: only render when multi-stage history exists. */}
      {sparkSegments && (
        <div
          className="flex h-1 rounded-full overflow-hidden bg-border/40"
          role="img"
          aria-label={sparkSegments.map((s) => `${s.stage}: ${s.days}d`).join(", ")}
          title={sparkSegments.map((s) => `${s.stage}: ${s.days}d`).join(" · ")}
        >
          {sparkSegments.map((seg, i) => (
            <span
              key={`${seg.stage}-${i}`}
              className={STAGE_DOT_COLOR[seg.stage]}
              style={{ width: `${Math.max(2, seg.pct)}%` }}
            />
          ))}
        </div>
      )}

      {/* Health line */}
      <div className="flex items-center gap-1.5 min-w-0">
        <span className={`w-1.5 h-1.5 rounded-full ${HEALTH_DOT_CLASS[health.tone]} shrink-0`} aria-hidden />
        <span className="text-[11px] text-muted-foreground truncate" title={health.longLabel}>
          {health.longLabel}
        </span>
      </div>

      {/* Next action — text link, never a button. Keeps the column visually
       *  uniform across all rows. Hint becomes a tooltip. */}
      <button
        type="button"
        onClick={handleClick}
        className="mt-auto text-left text-[12px] font-medium text-foreground hover:text-primary transition-colors group/cta inline-flex items-center gap-1"
        title={action.hint || action.label}
        aria-label={action.hint ? `${action.label} — ${action.hint}` : action.label}
      >
        <span className="truncate">{action.label}</span>
        <svg
          className="opacity-60 group-hover/cta:opacity-100 group-hover/cta:translate-x-0.5 transition-all shrink-0"
          width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden
        >
          <line x1="5" y1="12" x2="19" y2="12" />
          <polyline points="12 5 19 12 12 19" />
        </svg>
      </button>
    </div>
  );
}

export default memo(PipelinePulseImpl);
