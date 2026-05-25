/**
 * Weekly capacity meter: "X / Y applications this week" with a progress bar
 * and inline-editable goal. Goal is persisted to localStorage; the component
 * is a controlled "view + edit" pair.
 */
import { memo, useEffect, useState } from "react";
import type { WeeklyCapacityResult } from "../../../utils/dashboardSignals.ts";

/** Per-user key so two accounts on the same browser don't share goals. */
function storageKey(userId?: string): string {
  return `hiretrail-weekly-capacity-goal${userId ? `:${userId}` : ""}`;
}

function readStoredGoal(userId?: string): number {
  if (typeof window === "undefined") return 10;
  try {
    // Prefer the per-user key. Fall back to the legacy global key for users
    // upgrading from older builds — a one-time migration on first read.
    const userKey = storageKey(userId);
    const userRaw = window.localStorage.getItem(userKey);
    if (userRaw != null) {
      const n = parseInt(userRaw, 10);
      if (Number.isFinite(n) && n > 0) return n;
    }
    const legacy = window.localStorage.getItem("hiretrail-weekly-capacity-goal");
    if (legacy != null) {
      const n = parseInt(legacy, 10);
      if (Number.isFinite(n) && n > 0) {
        // Migrate forward.
        try { window.localStorage.setItem(userKey, String(n)); } catch { /* ignore */ }
        return n;
      }
    }
    return 10;
  } catch {
    return 10;
  }
}

interface Props {
  /** Counts in for the current week — computed by Dashboard, not by this card. */
  thisWeek: number;
  /** Logged-in user id. Used to namespace the localStorage goal key. */
  userId?: string;
}

/** Build the WeeklyCapacityResult locally given a goal — keeps the card the
 *  source of truth for the user's goal preference. */
function compute(thisWeek: number, goal: number): WeeklyCapacityResult {
  const progress = goal === 0 ? 0 : Math.min(1, thisWeek / goal);
  // daysLeft isn't used in the card, just pass 0 to satisfy the type.
  return { thisWeek, goal, progress, daysLeft: 0 };
}

function WeeklyCapacityCardImpl({ thisWeek, userId }: Props) {
  const [goal, setGoal] = useState<number>(() => readStoredGoal(userId));
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(goal));

  // Re-read when user switches (rare but possible during impersonation).
  useEffect(() => {
    setGoal(readStoredGoal(userId));
  }, [userId]);

  useEffect(() => {
    try { window.localStorage.setItem(storageKey(userId), String(goal)); } catch { /* ignore */ }
  }, [goal, userId]);

  const { progress } = compute(thisWeek, goal);
  const pct = Math.round(progress * 100);

  const commit = () => {
    const n = parseInt(draft, 10);
    if (Number.isFinite(n) && n > 0 && n <= 999) setGoal(n);
    else setDraft(String(goal));
    setEditing(false);
  };

  return (
    <div className="h-full w-full flex flex-col justify-center">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[11px] font-medium text-muted-foreground">This week</p>
        {editing ? (
          <span className="inline-flex items-center gap-1 text-[11px]">
            <span className="text-muted-foreground">Goal:</span>
            <input
              type="number"
              min={1}
              max={999}
              value={draft}
              autoFocus
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setDraft(String(goal)); setEditing(false); } }}
              className="w-12 px-1.5 py-0.5 rounded border border-border bg-card text-foreground text-[12px] tabular-nums text-right focus:outline-none focus:ring-1 focus:ring-ring/40"
              aria-label="Weekly applications goal"
            />
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-[11px] text-muted-foreground hover:text-foreground tabular-nums"
            title="Click to edit your weekly goal"
          >
            Goal: {goal}
          </button>
        )}
      </div>
      <p className="text-[18px] font-bold text-foreground tabular-nums tracking-tight mb-1.5">
        {thisWeek} <span className="text-muted-foreground font-medium text-[13px]">/ {goal} apps</span>
      </p>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={goal}
        aria-valuenow={thisWeek}
        className="h-1.5 rounded-full bg-muted overflow-hidden"
      >
        <div
          className={`h-full rounded-full transition-[width] duration-700 ${pct >= 100 ? "bg-emerald-500" : "bg-primary"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[11px] text-muted-foreground mt-1.5">
        {pct >= 100 ? "🎯 Goal hit — keep going" : `${pct}% to goal`}
      </p>
    </div>
  );
}

export default memo(WeeklyCapacityCardImpl);
