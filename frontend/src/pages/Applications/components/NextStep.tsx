/** An application's next step, and the one-click ways to act on it — the
 *  Ledger's peek, the application page and the Desk pane all show this.
 *
 *    a dated step      → Mark done (Undo) · Reschedule
 *    nothing dated     → Add the stage's usual date (follow-up, OA due, prep…)
 *    a draft           → Mark as applied
 *    quiet past window → Mark ghosted (archived as no reply, Undo)
 *
 *  `actionsOnly` (the Ledger's peek): the row it hangs from already says
 *  what the step is, so the peek shows only what you can do about it. */
import { useState } from "react";
import { CalendarPlus, Check, Ghost, Send } from "lucide-react";
import { toastWithUndo } from "../../../components/ui/toast.ts";
import Button from "../../../components/ui/Button.tsx";
import DeadlineFormModal, { DeadlineTypeIcon } from "../../../components/DeadlineFormModal/DeadlineFormModal.tsx";
import { addDaysYmd, todayYmd } from "../../../utils/dates.ts";
import { useCompleteDeadline, useSaveDeadline } from "../data/deadlines.ts";
import { useArchiveMutation } from "../data/queries.ts";
import { useMoveStage } from "../data/useMoveStage.ts";
import { daysInStage, type Focus, type ReplyWindow } from "../data/focus.ts";
import { TONE_CLASS } from "./tone.ts";
import type { Application, Deadline, Stage } from "../../../types";

const STAGE_DATE: Partial<Record<Stage, string>> = {
  Applied: "Follow-up reminder", OA: "OA due date", Interview: "Interview prep", Offer: "Offer decision", Drafting: "Other",
};
/** The add button names the date it adds. */
const ADD_LABEL: Partial<Record<Stage, string>> = {
  Applied: "Add a follow-up", OA: "Add the OA due date", Interview: "Add a prep date", Offer: "Add the decision date", Drafting: "Add a date",
};

export default function NextStep({ app, next, focus, rw, size = "md", actionsOnly = false }: {
  app: Application;
  next: Deadline | undefined;
  focus: Focus;
  rw: ReplyWindow;
  /** "sm" — the Ledger's peek (tighter type, small buttons). */
  size?: "sm" | "md";
  actionsOnly?: boolean;
}) {
  const complete = useCompleteDeadline();
  const saveDeadline = useSaveDeadline();
  const archive = useArchiveMutation();
  const moveStage = useMoveStage();
  const [dialog, setDialog] = useState<"add" | "edit" | null>(null);

  const today = todayYmd();
  const quiet = !next && (app.stage === "Applied" || app.stage === "OA" || app.stage === "Interview") && daysInStage(app, today) > rw.days;
  const addType = STAGE_DATE[app.stage];
  const ghost = () => archive.mutate({ ids: [app._id], archived: true, reason: "ghosted" }, {
    onSuccess: () => toastWithUndo(`${app.company} closed as no reply`, () => archive.mutate({ ids: [app._id], archived: false })),
  });

  const sm = size === "sm";
  return (
    <div className="min-w-0">
      {!actionsOnly && <div className="flex items-start gap-2.5 min-w-0">
        <span className={`shrink-0 inline-flex items-center justify-center rounded-lg bg-control text-foreground/80 ${sm ? "w-7 h-7" : "w-8 h-8"}`} aria-hidden>
          {next ? <DeadlineTypeIcon type={next.type} size={sm ? 14 : 15} /> : app.stage === "Drafting" ? <Send size={sm ? 14 : 15} strokeWidth={1.8} /> : <CalendarPlus size={sm ? 14 : 15} strokeWidth={1.8} />}
        </span>
        <div className="min-w-0">
          <p className={`${sm ? "text-[13px]" : "text-[14px]"} font-semibold leading-snug truncate ${TONE_CLASS[focus.tone]}`}>{focus.text}</p>
          {focus.detail && <p className={`${sm ? "text-[12px]" : "text-[12.5px]"} text-muted-foreground leading-snug truncate`}>{focus.detail}</p>}
        </div>
      </div>}
      <div className={`flex flex-wrap gap-1.5 ${actionsOnly ? "" : sm ? "mt-2.5" : "mt-3"}`}>
        {next && (
          <>
            <Button size="xs" variant="primary" onClick={() => complete.mutate(next)}>
              <Check size={13} strokeWidth={2.2} aria-hidden />Mark done
            </Button>
            <Button size="xs" onClick={() => setDialog("edit")}>Reschedule</Button>
          </>
        )}
        {!next && app.stage === "Drafting" && (
          <Button size="xs" variant="primary" onClick={() => moveStage(app, "Applied")}>
            <Send size={13} strokeWidth={2} aria-hidden />Mark as applied
          </Button>
        )}
        {!next && addType && (
          <Button size="xs" variant={app.stage === "Drafting" ? "secondary" : "primary"} onClick={() => setDialog("add")}>
            <CalendarPlus size={13} strokeWidth={2} aria-hidden />{ADD_LABEL[app.stage]}
          </Button>
        )}
        {quiet && (
          <Button size="xs" onClick={ghost}>
            <Ghost size={13} strokeWidth={2} aria-hidden />Mark ghosted
          </Button>
        )}
      </div>

      {dialog && (
        <DeadlineFormModal
          deadline={dialog === "edit" ? next ?? null : null}
          applications={[app]}
          initialApplicationId={app._id}
          initialType={addType && addType !== "Other" ? addType : ""}
          initialDueDate={addDaysYmd(today, 1)}
          onSave={(data) => saveDeadline(dialog === "edit" && next ? next._id : null, data)}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}
