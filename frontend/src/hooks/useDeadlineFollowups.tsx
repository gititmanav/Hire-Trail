/**
 * useDeadlineFollowups — shared hook for "auto-complete on stage change."
 *
 * When an application's stage changes (from any surface: Applications row,
 * Kanban drag-drop, Tailor mark-as-applied, etc.), this hook prompts the user
 * to mark any related open deadlines complete. Phase-3 spec:
 *
 *   "When a linked app advances stage, prompt 'Mark related deadline
 *    complete?' — non-intrusive toast with action."
 *
 * Single source of truth so each call site doesn't have to re-derive the
 * "which deadlines to close" logic.
 */
import { useCallback } from "react";
import toast from "react-hot-toast";
import { deadlinesAPI } from "../utils/api.ts";
import type { Deadline, Stage } from "../types";

interface PromptArgs {
  applicationId: string;
  /** Display name of the company — shown in the toast copy. */
  companyName: string;
  fromStage: Stage;
  toStage: Stage;
}

/** Map a stage transition to deadline types it logically closes out.
 *  Returns null when there's no canonical match — in that case we still
 *  surface ANY open deadline for the app so the user can decide. */
function relevantTypeMatcher(toStage: Stage): ((type: string) => boolean) | null {
  const t = toStage;
  if (t === "OA")        return (type) => /oa|assessment/i.test(type);
  if (t === "Interview") return (type) => /oa|assessment|interview/i.test(type);
  if (t === "Offer")     return (type) => /interview|offer|decision/i.test(type);
  if (t === "Rejected")  return () => true;            // any open deadline is now moot
  if (t === "Applied")   return (type) => /follow.?up/i.test(type);
  return null;
}

export function useDeadlineFollowups() {
  /** Returns the toast id (or null when no prompt was shown). Caller can
   *  dismiss the toast manually if needed but typically just lets the user act. */
  const promptAfterStageChange = useCallback(async ({ applicationId, companyName, fromStage, toStage }: PromptArgs): Promise<string | null> => {
    if (!applicationId) return null;
    try {
      const { data } = await deadlinesAPI.getAll({ applicationId, status: "upcoming", limit: 50 });
      const open = data.filter((d) => !d.completed);
      if (open.length === 0) return null;

      const matcher = relevantTypeMatcher(toStage);
      const matched = matcher ? open.filter((d) => matcher(d.type)) : open;
      const targets = matched.length > 0 ? matched : open;
      if (targets.length === 0) return null;

      const ids = targets.map((d) => d._id);
      const summary = targets.length === 1
        ? targets[0].type
        : `${targets.length} deadlines`;

      const toastId = toast(
        (t) => (
          <div className="flex items-center gap-3 min-w-0">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground truncate">
                {companyName} moved {fromStage} → {toStage}
              </p>
              <p className="text-xs text-muted-foreground truncate">Mark {summary} complete?</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={async () => {
                  try {
                    await Promise.all(ids.map((id) => deadlinesAPI.update(id, { completed: true })));
                    toast.success(`Marked ${ids.length} deadline${ids.length === 1 ? "" : "s"} complete`);
                  } catch {
                    toast.error("Couldn't update deadlines — try the Deadlines page.");
                  } finally {
                    toast.dismiss(t.id);
                  }
                }}
                className="px-2.5 py-1 text-xs font-medium text-white bg-primary hover:bg-primary/90 rounded-md"
              >
                Mark done
              </button>
              <button
                type="button"
                onClick={() => toast.dismiss(t.id)}
                className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
              >
                Dismiss
              </button>
            </div>
          </div>
        ),
        { duration: 10_000 },
      );
      return toastId;
    } catch {
      return null;
    }
  }, []);

  return { promptAfterStageChange };
}
