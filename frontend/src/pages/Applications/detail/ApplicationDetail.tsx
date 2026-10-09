/** One application, in full — the same view on its own page (Ledger, Trail,
 *  Board, Calendar readers) and in the Desk's pane.
 *
 *  Hero (role and company — everything else is in the rail), then the next step (and the one click that
 *  acts on it), the fit check, the job description, notes and tailoring
 *  history, with a properties rail (details, deadlines, timeline, people).
 *  It lays out by its own width (App.css "Application detail"): the rail sits
 *  beside the main column when there's room and under it when there isn't —
 *  a pane and a page read the same. */
import { useMemo } from "react";
import CompanyLogo from "../../../components/CompanyLogo/CompanyLogo.tsx";
import { todayYmd } from "../../../utils/dates.ts";
import StageMenu from "../components/StageMenu.tsx";
import NextStep from "../components/NextStep.tsx";
import FitSection from "./FitSection.tsx";
import DetailRail from "./DetailRail.tsx";
import { JobDescriptionSection, NotesSection, TailoringHistorySection } from "./ContentSections.tsx";
import { useCompanies, useOpenDeadlines, useReanalyzeMutation, useReplyWindow } from "../data/queries.ts";
import { useMoveStage } from "../data/useMoveStage.ts";
import { daysInStage, nextDeadlines, rowFocus } from "../data/focus.ts";
import type { Application, Resume } from "../../../types";

export function ApplicationDetailSkeleton() {
  return (
    <div className="app-detail" aria-busy="true" aria-label="Loading application">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-xl bg-muted animate-pulse" />
        <div className="flex-1 space-y-2.5">
          <div className="h-6 w-1/3 rounded bg-muted animate-pulse" />
          <div className="h-4 w-1/4 rounded bg-muted animate-pulse" />
        </div>
      </div>
      <div className="app-detail-grid mt-8">
        <div className="space-y-4">{[96, 180, 320].map((h) => <div key={h} className="rounded-xl border border-border bg-card animate-pulse" style={{ height: h }} />)}</div>
        <div className="space-y-4">{[300, 140].map((h) => <div key={h} className="rounded-xl border border-border bg-card animate-pulse" style={{ height: h }} />)}</div>
      </div>
    </div>
  );
}

export default function ApplicationDetail({ app, jdLoading, onEdit, onTailor, onPreviewResume, compact = false }: {
  app: Application;
  /** The cached list row is on screen and the full document (the JD) is on its way. */
  jdLoading: boolean;
  onEdit: () => void;
  onTailor: () => void;
  onPreviewResume: (r: Resume) => void;
  /** The Desk pane: a slightly smaller title. */
  compact?: boolean;
}) {
  const { data: companies = [] } = useCompanies();
  const { data: deadlines = [] } = useOpenDeadlines();
  const rw = useReplyWindow();
  const moveStage = useMoveStage();
  const reanalyze = useReanalyzeMutation();
  const today = todayYmd();

  const company = companies.find((c) => c._id === app.companyId) ?? companies.find((c) => c.name.toLowerCase() === app.company.toLowerCase());
  const next = useMemo(() => nextDeadlines(deadlines, today).get(app._id), [deadlines, today, app._id]);
  const focus = rowFocus(app, next, rw, today);
  const days = daysInStage(app, today);

  return (
    <div className="app-detail">
      <div className="flex items-center gap-4">
        <CompanyLogo name={app.company} logoUrl={company?.logoUrl} size={compact ? "md" : "lg"} />
        <div className="min-w-0 flex-1">
          <h1 className={`${compact ? "text-[20px]" : "text-[22px]"} leading-tight font-semibold tracking-tight text-foreground`}>{app.role}</h1>
          <p className="mt-1 text-[14px] text-foreground/90 font-medium">{app.company}</p>
        </div>
      </div>
      {/* Stage, dates and the rest live in the rail. Only when the rail drops
          below the main column does the stage come up here, so the one
          control that moves the application stays in reach. */}
      <div className="app-detail-stage mt-4 items-center gap-2.5 flex-wrap">
        <StageMenu app={app} onMove={moveStage} size="md" />
        <span className="text-[13px] text-muted-foreground">{days === 0 ? `In ${app.stage} since today` : `${days} day${days === 1 ? "" : "s"} in ${app.stage}`}</span>
      </div>

      <div className="app-detail-grid mt-7">
        <div className="space-y-4 min-w-0">
          {app.stage !== "Rejected" && (
            <section aria-label="Next step" className="rounded-xl border border-border bg-card px-5 py-4">
              <NextStep app={app} next={next} focus={focus} rw={rw} />
            </section>
          )}
          <FitSection app={app} analyzing={reanalyze.isPending} onAnalyze={() => reanalyze.mutate(app._id)} onTailor={onTailor} />
          {/* The list's cached row has no JD (summary payload) — show the
              skeleton until the full document lands, never "No description". */}
          <JobDescriptionSection text={app.jobDescription} loading={jdLoading && app.jobDescription == null} onAdd={onEdit} />
          <NotesSection notes={app.notes ?? ""} onEdit={onEdit} />
          <TailoringHistorySection applicationId={app._id} onOpen={onTailor} />
        </div>
        <DetailRail app={app} onMove={moveStage} onPreviewResume={onPreviewResume} />
      </div>
    </div>
  );
}
