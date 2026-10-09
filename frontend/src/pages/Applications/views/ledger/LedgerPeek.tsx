/** The Ledger's peek: one row opened in place — its next step (and the one
 *  click that acts on it), the fit, the people at the company, the notes —
 *  without leaving the list. The application page stays one click away.
 *  The row above already says what the step is, so the peek only offers
 *  the actions on it. It hangs from its row as one shape (App.css "The Ledger's peek"). */
import { ArrowRight, Pencil, Sparkles } from "lucide-react";
import Button from "../../../../components/ui/Button.tsx";
import NextStep from "../../components/NextStep.tsx";
import { FitLine, PeopleList, companyPeople } from "../../components/RowBits.tsx";
import { hasJobDescription } from "../../../../utils/applicationFields.ts";
import type { Focus, ReplyWindow } from "../../data/focus.ts";
import type { Application, Contact, Deadline } from "../../../../types";

const heading = "mb-2 text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground/80";

export default function LedgerPeek({ app, next, focus, rw, contacts, onOpen, onEdit, onTailor }: {
  app: Application;
  next: Deadline | undefined;
  focus: Focus;
  rw: ReplyWindow;
  contacts: Contact[];
  onOpen: () => void;
  onEdit: () => void;
  onTailor: () => void;
}) {
  return (
    <div className="ledger-peek">
      <div className="ledger-peek-in">
      <div className="ledger-peek-grid pl-12 pr-4 pt-3.5 pb-3">
        {app.stage !== "Rejected" && (
          <section className="min-w-0">
            <h3 className={heading}>Next step</h3>
            <NextStep app={app} next={next} focus={focus} rw={rw} size="sm" actionsOnly />
          </section>
        )}
        <section className="min-w-0">
          <h3 className={heading}>Fit</h3>
          <FitLine fit={app.fit} hasJd={hasJobDescription(app)} />
        </section>
        <section className="min-w-0">
          <h3 className={heading}>People at {app.company}</h3>
          <PeopleList people={companyPeople(app, contacts)} company={app.company} />
        </section>
      </div>
      <div className="flex items-center gap-3 ml-12 mr-4 py-2 border-t border-foreground/[0.07] min-w-0">
        <p className={`min-w-0 flex-1 truncate text-[12.5px] ${app.notes?.trim() ? "text-foreground/80" : "text-muted-foreground"}`}>
          {app.notes?.trim() || "No notes yet."}
        </p>
        <div className="shrink-0 flex items-center gap-1">
          <Button size="xs" variant="ghost" onClick={onEdit}><Pencil size={12.5} strokeWidth={2} aria-hidden />Edit</Button>
          <Button size="xs" variant="ghost" onClick={onTailor}><Sparkles size={12.5} strokeWidth={2} aria-hidden />Tailor</Button>
          <Button size="xs" variant="ghost" onClick={onOpen}>Open<ArrowRight size={12.5} strokeWidth={2} aria-hidden /></Button>
        </div>
      </div>
      </div>
    </div>
  );
}
