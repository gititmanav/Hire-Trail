/** Act 3 — the Applications Board, rebuilt from BoardView's column and card
 *  markup, plus the inbox review card (EmailScanReview's CandidateCard): an
 *  interview invite matched to a tracked application, "Merge with existing",
 *  and the card moving from Applied to Interview. */
import { ArrowRight, CalendarDays, Check, Columns3, FileText, LayoutList, Mail, MapPin, Search, SlidersHorizontal, SquarePen } from "lucide-react";
import { AppShell } from "./shell.tsx";
import { STAGE_STRIPE_CLASS } from "../../../utils/stageStyles.ts";
import { HEALTH_DOT_CLASS } from "../../../utils/applicationHealth.ts";
import type { Stage } from "../../../types";

interface Card {
  company: string;
  role: string;
  location: string;
  resume?: string;
  date: string;
  age: string;
  health: keyof typeof HEALTH_DOT_CLASS;
}

/** BoardView's column surfaces, light and dark. */
const COLUMN_TINT: Record<Stage, { head: string; border: string; body: string }> = {
  Drafting: { head: "bg-slate-50 dark:bg-slate-800/30", border: "border-slate-200/60 dark:border-slate-700/50", body: "bg-slate-50/40 dark:bg-slate-900/20" },
  Applied: { head: "bg-blue-50 dark:bg-blue-900/20", border: "border-blue-200/60 dark:border-blue-800/40", body: "bg-blue-50/30 dark:bg-blue-950/20" },
  OA: { head: "bg-amber-50 dark:bg-amber-900/20", border: "border-amber-200/60 dark:border-amber-800/40", body: "bg-amber-50/30 dark:bg-amber-950/20" },
  Interview: { head: "bg-purple-50 dark:bg-purple-900/20", border: "border-purple-200/60 dark:border-purple-800/40", body: "bg-purple-50/30 dark:bg-purple-950/20" },
  Offer: { head: "bg-emerald-50 dark:bg-emerald-900/20", border: "border-emerald-200/60 dark:border-emerald-800/40", body: "bg-emerald-50/30 dark:bg-emerald-950/20" },
  Rejected: { head: "bg-red-50 dark:bg-red-900/20", border: "border-red-200/60 dark:border-red-800/40", body: "bg-red-50/30 dark:bg-red-950/20" },
};

const STRIPE: Card = { company: "Stripe", role: "Senior Frontend Engineer", location: "Remote", resume: "Frontend", date: "Sep 24", age: "Today", health: "fresh" };

const COLUMNS: { stage: Stage; count: number; avg: string; cards: Card[] }[] = [
  {
    stage: "Drafting", count: 2, avg: "Avg 3d in Drafting",
    cards: [
      { company: "Figma", role: "Product Engineer", location: "San Francisco", resume: "Product", date: "Sep 23", age: "1d", health: "fresh" },
      { company: "Notion", role: "Frontend Engineer", location: "New York", date: "Sep 22", age: "2d", health: "fresh" },
    ],
  },
  {
    stage: "Applied", count: 8, avg: "Avg 9d in Applied",
    cards: [
      { company: "Linear", role: "Software Engineer, Web", location: "Remote", resume: "Frontend", date: "Sep 18", age: "6d", health: "fresh" },
      { company: "Vercel", role: "Frontend Engineer", location: "Remote", date: "Sep 12", age: "12d", health: "warm" },
    ],
  },
  {
    stage: "OA", count: 3, avg: "Avg 5d in OA",
    cards: [
      { company: "Airbnb", role: "Software Engineer", location: "Seattle", resume: "General", date: "Sep 10", age: "4d", health: "fresh" },
      { company: "Datadog", role: "Frontend Engineer", location: "New York", date: "Sep 8", age: "9d", health: "warm" },
    ],
  },
  {
    stage: "Interview", count: 2, avg: "Avg 11d in Interview",
    cards: [
      { company: "Shopify", role: "Senior Developer", location: "Remote", resume: "Frontend", date: "Sep 3", age: "3d", health: "fresh" },
      { company: "Duolingo", role: "Software Engineer", location: "Pittsburgh", date: "Aug 30", age: "8d", health: "warm" },
    ],
  },
  {
    stage: "Offer", count: 1, avg: "Avg 6d in Offer",
    cards: [{ company: "Ramp", role: "Frontend Engineer", location: "New York", resume: "Frontend", date: "Aug 21", age: "2d", health: "fresh" }],
  },
];

function BoardCardView({ card, stripe }: { card: Card; stripe: Stage }) {
  return (
    <div className="card-premium p-3 min-w-0 overflow-hidden relative">
      <div aria-hidden className={`absolute left-0 top-0 bottom-0 w-[3px] ${STAGE_STRIPE_CLASS[stripe]}`} />
      <div className="flex items-start justify-between gap-2 mb-0.5">
        <h4 className="text-[13px] font-semibold text-foreground truncate min-w-0">{card.company}</h4>
        <span className="inline-flex items-center gap-1 shrink-0 text-[10px] text-muted-foreground tabular-nums">
          <span className={`w-1.5 h-1.5 rounded-full ${HEALTH_DOT_CLASS[card.health]}`} />
          {card.age}
        </span>
      </div>
      <p className="text-xs text-muted-foreground mb-1.5 truncate">{card.role}</p>
      <div className="flex flex-wrap gap-1 mb-1.5 min-w-0">
        <span className="inline-flex items-center gap-0.5 max-w-full text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-muted/80 text-secondary-foreground border border-border/60 truncate">
          <MapPin size={9} strokeWidth={2} className="shrink-0 opacity-70" />
          <span className="truncate">{card.location}</span>
        </span>
        {card.resume && (
          <span className="inline-flex items-center gap-0.5 max-w-full text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-muted text-foreground border border-border truncate">
            <FileText size={9} strokeWidth={1.5} className="shrink-0" />
            <span className="truncate">{card.resume}</span>
          </span>
        )}
      </div>
      <span className="text-[11px] text-muted-foreground">{card.date}</span>
    </div>
  );
}

/** `still`: the board at rest (the theme preview) — Stripe already in Applied,
 *  none of the story's moving parts. */
export default function BoardScreen({ still = false }: { still?: boolean }) {
  return (
    <AppShell active="Applications">
      {/* PageHeader + HeaderControls */}
      <div className="h-14 px-5 flex items-center gap-3 border-b border-border">
        <div className="flex items-baseline gap-2">
          <span className="text-base font-semibold text-foreground">Applications</span>
          <span className="text-[13px] text-muted-foreground tabular-nums">23 active</span>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="relative flex items-center h-8 w-52 pl-8 pr-7 text-[13px] bg-background border border-border rounded-lg text-muted-foreground/70">
            <Search size={14} strokeWidth={2} className="absolute left-2.5 text-muted-foreground" />
            Search company or role
            <kbd className="absolute right-2 text-[10.5px] font-mono text-muted-foreground/70">/</kbd>
          </span>
          <span className="inline-flex items-center gap-0.5 p-0.5 rounded-lg border border-border bg-background">
            {[LayoutList, Columns3, CalendarDays].map((Icon, i) => (
              <span key={i} className={`w-7 h-7 inline-flex items-center justify-center rounded-md ${i === 1 ? "bg-control text-foreground" : "text-muted-foreground"}`}>
                <Icon size={15} strokeWidth={1.8} />
              </span>
            ))}
          </span>
          <span className="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-border text-muted-foreground">
            <SlidersHorizontal size={15} strokeWidth={1.8} />
          </span>
          <span className="w-8 h-8 inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <SquarePen size={15} strokeWidth={1.8} />
          </span>
        </div>
      </div>

      <div data-lp="board" className="absolute inset-x-0 bottom-0 top-14 p-4 grid grid-cols-5 gap-3 items-start">
        {COLUMNS.map((col) => {
          const tint = COLUMN_TINT[col.stage];
          return (
            <div key={col.stage} className="flex flex-col min-w-0">
              <div className={`flex flex-col gap-0.5 px-3 py-2 rounded-t-xl ${tint.head}`}>
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-2.5 h-2.5 rounded-full ${STAGE_STRIPE_CLASS[col.stage]} shrink-0`} />
                  {col.stage === "Offer" ? (
                    <span className="inline-flex items-center rounded-lg border border-border bg-card/80 overflow-hidden shrink-0">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[12px] font-semibold bg-muted text-foreground">
                        <span className={`w-1.5 h-1.5 rounded-full ${STAGE_STRIPE_CLASS.Offer}`} /> Offer <span className="text-[10px] tabular-nums opacity-70">1</span>
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[12px] font-semibold text-muted-foreground">
                        <span className={`w-1.5 h-1.5 rounded-full ${STAGE_STRIPE_CLASS.Rejected}`} /> Rejected <span className="text-[10px] tabular-nums opacity-70">5</span>
                      </span>
                    </span>
                  ) : (
                    <>
                      <span className="text-[13px] font-semibold text-foreground truncate">{col.stage}</span>
                      <span data-lp={`count-${col.stage}`} className="text-[11px] text-muted-foreground ml-auto bg-paper/70 dark:bg-scrim/25 px-2 py-0.5 rounded-full font-semibold tabular-nums shrink-0">{col.count}</span>
                    </>
                  )}
                </div>
                <p className="text-[10.5px] text-muted-foreground/80 tabular-nums truncate ml-[18px]">{col.avg}</p>
              </div>
              <div className={`p-2 rounded-b-xl border-2 border-dashed ${tint.border} ${tint.body} min-h-[120px] flex flex-col`}>
                {/* Where the moving card sits: collapses in Applied, opens in Interview. */}
                {!still && (col.stage === "Applied" || col.stage === "Interview") && (
                  <div data-lp={`slot-${col.stage}`} className="shrink-0 overflow-hidden" style={{ height: col.stage === "Applied" ? undefined : 0 }}>
                    <div className="invisible pb-2"><BoardCardView card={STRIPE} stripe="Applied" /></div>
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  {still && col.stage === "Applied" && <BoardCardView card={STRIPE} stripe="Applied" />}
                  {col.cards.map((card) => <BoardCardView key={card.company} card={card} stripe={col.stage} />)}
                </div>
              </div>
            </div>
          );
        })}

        {/* The Stripe card itself, lifted above the board so it can travel. */}
        {!still && <div data-lp="flyer" className="absolute" style={{ left: 0, top: 0, width: 0 }}>
          <div data-lp="flyer-card" className="relative rounded-xl">
            <div className="card-premium p-3 min-w-0 overflow-hidden relative">
              <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${STAGE_STRIPE_CLASS.Applied}`} />
              <div data-lp="flyer-stripe" className={`absolute left-0 top-0 bottom-0 w-[3px] ${STAGE_STRIPE_CLASS.Interview}`} style={{ opacity: 0 }} />
              <div className="flex items-start justify-between gap-2 mb-0.5">
                <h4 className="text-[13px] font-semibold text-foreground truncate">{STRIPE.company}</h4>
                <span className="inline-flex items-center gap-1 shrink-0 text-[10px] text-muted-foreground tabular-nums">
                  <span className={`w-1.5 h-1.5 rounded-full ${HEALTH_DOT_CLASS.fresh}`} />Today
                </span>
              </div>
              <p className="text-xs text-muted-foreground mb-1.5 truncate">{STRIPE.role}</p>
              <div className="flex flex-wrap gap-1 mb-1.5">
                <span className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-muted/80 text-secondary-foreground border border-border/60">
                  <MapPin size={9} strokeWidth={2} className="opacity-70" /> Remote
                </span>
                <span className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-muted text-foreground border border-border">
                  <FileText size={9} strokeWidth={1.5} /> Frontend
                </span>
              </div>
              <span className="text-[11px] text-muted-foreground">Sep 24</span>
            </div>
          </div>
        </div>}
      </div>

      {/* The inbox review card */}
      {!still && <div data-lp="review" className="absolute right-4 bottom-4 w-[388px]" style={{ opacity: 0 }}>
        <p className="mb-2 flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground">
          <Mail size={13} strokeWidth={2} /> From your inbox · 1 update
        </p>
        <div className="rounded-xl border border-border bg-card p-5 shadow-floating">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-semibold text-foreground">Stripe</h3>
                <span className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold uppercase tracking-wider border bg-purple-50 text-purple-700 border-purple-200">Interview</span>
                <span className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold uppercase tracking-wider border border-amber-300 bg-amber-50 text-amber-700">Already tracked</span>
                <span className="text-[10.5px] text-muted-foreground">●●●</span>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">Senior Frontend Engineer</p>
            </div>
            <div className="text-[11px] text-muted-foreground shrink-0">Sep 26</div>
          </div>
          <div className="mt-3 rounded-lg border border-border bg-background/60 px-3 py-2.5 text-[12.5px]">
            <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-bold mb-1">Latest email</div>
            <div className="text-foreground font-medium truncate">Interview invitation — Senior Frontend Engineer</div>
            <div className="text-muted-foreground truncate text-[11.5px] mt-0.5">Stripe Recruiting &lt;recruiting@stripe.com&gt;</div>
            <p className="text-muted-foreground/90 mt-1.5 text-[12px] leading-relaxed">Hi Alex — thanks for applying. We&rsquo;d love to set up a 30-minute call with the team next week…</p>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <span className="px-3 py-1.5 text-xs font-medium text-primary-foreground bg-primary rounded-lg inline-flex items-center gap-1.5">
              Import <ArrowRight size={11} strokeWidth={2.5} />
            </span>
            <span data-lp="merge-btn" className="px-3 py-1.5 text-xs font-medium border border-amber-400 text-amber-700 bg-amber-50/50 rounded-lg">Merge with existing</span>
            <span className="px-3 py-1.5 text-xs font-medium border border-border rounded-lg text-secondary-foreground">Skip</span>
          </div>
        </div>
      </div>}

      {/* The toast the app shows after a merge */}
      {!still && <div data-lp="toast" className="absolute left-1/2 top-3 -translate-x-1/2 flex items-center gap-2.5 px-3.5 py-2.5 rounded-[10px] bg-card border border-border shadow-floating text-[13.5px] font-medium text-foreground" style={{ opacity: 0, borderLeft: "3px solid hsl(var(--success))" }}>
        <span className="w-4 h-4 rounded-full bg-success text-white flex items-center justify-center"><Check size={10} strokeWidth={3.5} /></span>
        Merged into existing Stripe.
      </div>}
    </AppShell>
  );
}
