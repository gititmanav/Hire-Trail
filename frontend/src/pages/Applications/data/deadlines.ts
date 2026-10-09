/** Deadline writes made from the Applications surfaces (a row's next step,
 *  Sweep). Every one refreshes what reads deadlines: the open-deadline list
 *  (each row's next step), the calendar, the application's own list, and the
 *  insights (Sweep's count depends on what's scheduled). */
import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import toast, { toastWithUndo } from "../../../components/ui/toast.ts";
import { deadlinesAPI } from "../../../utils/api.ts";
import { appKeys } from "./queries.ts";
import type { Deadline, DeadlineFormData } from "../../../types";

const OPEN_KEY = ["deadlines", "active"] as const;

export function refreshDeadlines(qc: QueryClient) {
  void qc.invalidateQueries({ queryKey: ["deadlines"] });
  void qc.invalidateQueries({ queryKey: ["calendar"] });
  void qc.invalidateQueries({ queryKey: appKeys.insights() });
}

/** Mark a deadline done — it leaves the row at once; Undo reopens it (and
 *  removes the repeat the server spawned for a recurring one). */
export function useCompleteDeadline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (d: Deadline) => deadlinesAPI.update(d._id, { completed: true }),
    onMutate: async (d) => {
      await qc.cancelQueries({ queryKey: OPEN_KEY });
      const prev = qc.getQueryData<Deadline[]>(OPEN_KEY);
      qc.setQueryData<Deadline[]>(OPEN_KEY, (old) => old?.filter((x) => x._id !== d._id));
      return { prev };
    },
    onError: (_e, _d, ctx) => { if (ctx?.prev) qc.setQueryData(OPEN_KEY, ctx.prev); },
    onSuccess: (res, d) => {
      toastWithUndo(`${d.type} done`, async () => {
        try {
          await deadlinesAPI.update(d._id, { completed: false });
          if (res.nextOccurrenceId) await deadlinesAPI.delete(res.nextOccurrenceId);
        } finally {
          refreshDeadlines(qc);
        }
      });
    },
    onSettled: () => refreshDeadlines(qc),
  });
}

/** Create or edit a deadline from the shared deadline dialog. */
export function useSaveDeadline() {
  const qc = useQueryClient();
  return async (id: string | null, data: DeadlineFormData) => {
    if (id) await deadlinesAPI.update(id, data);
    else await deadlinesAPI.create(data);
    toast.success(id ? "Deadline updated" : "Deadline added");
    refreshDeadlines(qc);
  };
}
