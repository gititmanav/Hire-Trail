/** Small pieces the Ledger, the Trail, the Desk list and Board cards share,
 *  so an application reads the same on every surface. */
import { memo } from "react";
import { Link } from "react-router-dom";
import AiPulse from "../../../components/AiIndicator/AiPulse.tsx";
import ScoreChip from "../../../components/MatchScore/ScoreChip.tsx";
import { SCORE_BAND_LABEL, scoreBand } from "../../../utils/matchScore.ts";
import { dayOf, formatDay } from "../../../utils/dates.ts";
import type { Application, Contact, OutreachStatus } from "../../../types";

/** The one fit number (0–10), or what the check is doing. `bare` (a card)
 *  shows only a number or the work in flight — no placeholder for nothing. */
export const FitCell = memo(function FitCell({ fit, bare = false }: { fit: Application["fit"]; bare?: boolean }) {
  if (fit?.status === "processing") return <AiPulse size={13} tone="subtle" />;
  // typeof, not !== null: fit summaries written before the 0–10 score have no field at all.
  if (fit?.status === "succeeded" && typeof fit.score === "number") return <ScoreChip score={fit.score} />;
  if (fit?.status === "succeeded") return bare ? null : <span className="text-[12px] text-muted-foreground">Checked</span>;
  if (fit?.status === "waiting_assistant") return <span className="text-[12px] text-muted-foreground truncate">Assistant</span>;
  return bare ? null : <span className="text-muted-foreground/60">—</span>;
});

/** "Strong fit · React, TypeScript +3 · 2 gaps" — the peek's and the Desk's fit line. */
export function FitLine({ fit, hasJd }: { fit: Application["fit"]; hasJd: boolean }) {
  if (fit?.status === "processing") return <AiPulse size={13} label="Checking your fit…" labelSize={12.5} />;
  if (fit?.status === "waiting_assistant") return <p className="text-[12.5px] text-muted-foreground">Waiting for your assistant.</p>;
  if (fit?.status === "succeeded" && typeof fit.score === "number") {
    const top = fit.topMatched ?? [];
    return (
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <ScoreChip score={fit.score} />
          <span className="text-[12.5px] text-muted-foreground">{SCORE_BAND_LABEL[scoreBand(fit.score)]}</span>
        </div>
        {top.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {top.map((s) => <span key={s} className="text-[11.5px] leading-5 px-1.5 rounded-md bg-control text-foreground/85">{s}</span>)}
            {fit.matchedCount > top.length && <span className="text-[11.5px] leading-5 text-muted-foreground">+{fit.matchedCount - top.length}</span>}
          </div>
        )}
        {fit.missingCount > 0 && <p className="mt-1.5 text-[12px] text-muted-foreground">{fit.missingCount} skill{fit.missingCount === 1 ? "" : "s"} to cover</p>}
      </div>
    );
  }
  // A check from before the 0–10 score: no number, but it ran.
  if (fit?.status === "succeeded") return <p className="text-[12.5px] text-muted-foreground">Checked · {fit.matchedCount} matched · {fit.missingCount} to cover</p>;
  if (fit?.status === "failed") return <p className="text-[12.5px] text-muted-foreground line-clamp-2">{fit.errorMessage || "The fit check didn't finish."}</p>;
  return <p className="text-[12.5px] text-muted-foreground">{hasJd ? "Not checked yet." : "Add the job description to check your fit."}</p>;
}

const OUTREACH_TAG: Partial<Record<OutreachStatus, string>> = { referred: "Referred", reached_out: "Reached out", response_received: "Replied" };

/** A quiet tag for the people side of an application. */
export function OutreachTag({ status }: { status?: OutreachStatus }) {
  const label = status ? OUTREACH_TAG[status] : undefined;
  if (!label) return null;
  return <span className="shrink-0 text-[11px] font-medium leading-[18px] px-1.5 rounded-full border border-border text-muted-foreground">{label}</span>;
}

/** People saved at the application's company (or linked to it), first three. */
export function companyPeople(app: Application, contacts: readonly Contact[]): Contact[] {
  const name = app.company.trim().toLowerCase();
  return contacts.filter((c) =>
    c.applicationIds?.includes(app._id)
    || (app.companyId && c.companyId === app.companyId)
    || (name && c.company.trim().toLowerCase() === name));
}

export function PeopleList({ people, company, limit = 3 }: { people: Contact[]; company: string; limit?: number }) {
  if (people.length === 0) return <p className="text-[12.5px] text-muted-foreground">No one saved at {company} yet.</p>;
  // -my-1 / -mx-1.5 take back the rows' hover padding, so the list's first
  // line sits level with its neighbours' and its avatars on the heading's edge.
  return (
    <ul className="-my-1 space-y-1">
      {people.slice(0, limit).map((c) => (
        <li key={c._id}>
          <Link to={`/contacts?focus=${c._id}`} className="-mx-1.5 px-1.5 py-1 flex items-center gap-2 rounded-md hover:bg-control/70 transition-colors min-w-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className="w-6 h-6 rounded-full bg-control flex items-center justify-center text-[10px] font-semibold text-muted-foreground shrink-0" aria-hidden>
              {c.name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
            </span>
            <span className="min-w-0 truncate text-[12.5px]">
              <span className="text-foreground font-medium">{c.name}</span>
              {c.role && <span className="text-muted-foreground"> · {c.role}</span>}
            </span>
          </Link>
        </li>
      ))}
      {people.length > limit && <li className="text-[12px] text-muted-foreground pl-0.5">+{people.length - limit} more</li>}
    </ul>
  );
}

const thisYear = new Date().getFullYear();
/** "Aug 8", or "Aug 8, 2025" outside this year. */
export function shortDate(value: string | null | undefined): string {
  const day = dayOf(value);
  if (!day) return "—";
  return formatDay(day, Number(day.slice(0, 4)) === thisYear ? { month: "short", day: "numeric" } : { month: "short", day: "numeric", year: "numeric" });
}
