/** The one way to move an application to another stage — Table stage menu,
 *  Board drag, and the detail page all call this. Optimistic (see
 *  useStageMutation), and once the server confirms it offers to close the
 *  application's now-irrelevant deadlines. */
import { useCallback } from "react";
import { useDeadlineFollowups } from "../../../hooks/useDeadlineFollowups.tsx";
import { useStageMutation } from "./queries.ts";
import type { Application, Stage } from "../../../types";

export function useMoveStage() {
  const { promptAfterStageChange } = useDeadlineFollowups();
  const { mutate } = useStageMutation({
    onMoved: (app, from, to) => {
      void promptAfterStageChange({ applicationId: app._id, companyName: app.company, fromStage: from, toStage: to });
    },
  });
  return useCallback((app: Application, stage: Stage) => {
    if (app.stage === stage) return; // dropping a card back where it was is not a move
    mutate({ id: app._id, stage, from: app.stage, app });
  }, [mutate]);
}
