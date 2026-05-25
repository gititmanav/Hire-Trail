/**
 * "Activity streak" widget body. Rendered INSIDE the dashboard's grid wrapper,
 * which provides the card chrome + header — this component owns only the
 * inner content (icon + numbers + best). Flex-fills the grid cell so it looks
 * right at any size.
 */
import { memo } from "react";
import type { StreakResult } from "../../../utils/dashboardSignals.ts";

interface Props {
  streak: StreakResult;
}

function StreakCardImpl({ streak }: Props) {
  const active = streak.activeToday;
  return (
    <div className="h-full w-full flex items-center gap-3">
      <div
        className={`w-12 h-12 rounded-lg flex items-center justify-center text-xl shrink-0 ${
          active
            ? "bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-300"
            : "bg-muted text-muted-foreground"
        }`}
        aria-hidden
      >
        {active ? "🔥" : "💤"}
      </div>
      <div className="min-w-0">
        <p className="text-[18px] font-bold text-foreground tracking-tight tabular-nums leading-tight">
          {active ? `${streak.current}-day streak` : "Get back on track"}
        </p>
        {streak.best > 0 && (
          <p className="text-[11px] text-muted-foreground tabular-nums mt-0.5">
            Best: {streak.best}d {active && streak.current >= streak.best ? "🏆" : ""}
          </p>
        )}
      </div>
    </div>
  );
}

export default memo(StreakCardImpl);
