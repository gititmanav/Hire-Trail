/** Sweep — close out the applications that went quiet, one card at a time.
 *
 *  The queue is every open application past twice the person's reply window
 *  with nothing dated ahead (GET /applications/sweep), longest-silent first.
 *  Each card says why it's here — in the person's own numbers — and takes one
 *  key:
 *    F  Follow up     a follow-up reminder for tomorrow
 *    W  Keep waiting  a reminder in two weeks (it leaves the queue until then)
 *    G  Ghosted       archived as "no reply" — an outcome of its own
 *    R  Rejected      moved to Rejected
 *  ↓ / S skips, ⌘Z (or Undo) takes the last one back. Replaces the old amber
 *  "stuck in Applied → Archive all" banner: silence is an outcome to close,
 *  not an alarm. Lazy-loaded — `motion` lives in this chunk only. */
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Check, Ghost, Hourglass, MailPlus, Undo2, XCircle, type LucideIcon } from "lucide-react";
import toast from "../../../components/ui/toast.ts";
import { Modal, ModalHeader } from "../../../components/ui/Modal.tsx";
import Button from "../../../components/ui/Button.tsx";
import CompanyLogo from "../../../components/CompanyLogo/CompanyLogo.tsx";
import { applicationsAPI, deadlinesAPI } from "../../../utils/api.ts";
import { addDaysYmd, todayYmd } from "../../../utils/dates.ts";
import { prefersReducedMotion } from "../../../utils/motion.ts";
import TrailLine from "../components/TrailLine.tsx";
import { FitCell, shortDate } from "../components/RowBits.tsx";
import { appKeys, useInsights, useSweepQueue } from "../data/queries.ts";
import { refreshDeadlines } from "../data/deadlines.ts";
import { daysInStage, DEFAULT_REPLY_WINDOW, trailShape } from "../data/focus.ts";
import { useCompanyResolver } from "../views/shared.tsx";
import type { Application } from "../../../types";

type Outcome = "followup" | "waiting" | "ghosted" | "rejected";

const OUTCOMES: { key: string; outcome: Outcome; title: string; detail: string; Icon: LucideIcon }[] = [
  { key: "f", outcome: "followup", title: "Follow up", detail: "A reminder for tomorrow", Icon: MailPlus },
  { key: "w", outcome: "waiting", title: "Keep waiting", detail: "Ask me again in two weeks", Icon: CalendarClock },
  { key: "g", outcome: "ghosted", title: "Ghosted", detail: "Close it as no reply", Icon: Ghost },
  { key: "r", outcome: "rejected", title: "Rejected", detail: "They said no", Icon: XCircle },
];

interface Done { app: Application; outcome: Outcome | "skipped"; undo?: () => Promise<unknown> }

export default function SweepModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { data, isPending } = useSweepQueue(true);
  // The queue as it was when the sweep began — acting on a card mustn't reshuffle the rest.
  const [queue, setQueue] = useState<Application[] | null>(null);
  useEffect(() => { if (data && !queue) setQueue(data.data); }, [data, queue]);
  const rw = data?.replyWindow ?? DEFAULT_REPLY_WINDOW;
  const [done, setDone] = useState<Done[]>([]);
  const [direction, setDirection] = useState<1 | -1>(1);
  const changed = useRef(false);
  const today = todayYmd();
  const resolveCompany = useCompanyResolver(queue ?? []);

  const index = done.length;
  const app = queue?.[index];
  const total = queue?.length ?? 0;
  // The queue is capped (300 a sweep); say so when there are more.
  const allQuiet = useInsights().data?.sweepCount ?? total;
  const tally = useMemo(() => {
    const t: Record<Outcome, number> = { followup: 0, waiting: 0, ghosted: 0, rejected: 0 };
    for (const d of done) if (d.outcome !== "skipped") t[d.outcome]++;
    return t;
  }, [done]);

  const act = (outcome: Outcome | "skipped") => {
    if (!app) return;
    setDirection(1);
    const entry: Done = { app, outcome };
    setDone((d) => [...d, entry]);
    if (outcome === "skipped") return;
    changed.current = true;
    const run = async (): Promise<Done["undo"]> => {
      switch (outcome) {
        case "followup":
        case "waiting": {
          const created = await deadlinesAPI.create({
            applicationId: app._id,
            type: "Follow-up reminder",
            dueDate: addDaysYmd(today, outcome === "followup" ? 1 : 14),
            notes: outcome === "waiting" ? "Still waiting — check in again." : "",
          });
          return () => deadlinesAPI.delete(created._id);
        }
        case "ghosted":
          await applicationsAPI.archive(app._id, "ghosted");
          return () => applicationsAPI.unarchive(app._id);
        case "rejected":
          await applicationsAPI.batch([app._id], { action: "stage", stage: "Rejected" });
          return () => applicationsAPI.batch([app._id], { action: "undoStage" });
      }
    };
    // The card moves on at once; the save follows. A failure (the API layer
    // toasts it) takes the card's outcome back off the tally.
    run().then(
      (undo) => setDone((d) => d.map((x) => (x === entry ? { ...x, undo } : x))),
      () => setDone((d) => d.map((x) => (x === entry ? { ...x, outcome: "skipped" } : x))),
    );
  };

  const undo = () => {
    const last = done[done.length - 1];
    if (!last) return;
    setDirection(-1);
    setDone((d) => d.slice(0, -1));
    if (last.undo) void last.undo().catch(() => toast.error("Couldn't undo that one — check it in the list."));
  };

  // Close: everything the sweep touched refreshes once.
  const close = () => {
    if (changed.current) {
      void qc.invalidateQueries({ queryKey: appKeys.all });
      refreshDeadlines(qc);
    }
    onClose();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.metaKey || e.ctrlKey) {
      if (e.key.toLowerCase() === "z") { e.preventDefault(); undo(); }
      return;
    }
    if (e.altKey || (e.target as HTMLElement).closest("input, textarea")) return;
    const k = e.key.toLowerCase();
    const o = OUTCOMES.find((x) => x.key === k);
    if (o) { e.preventDefault(); act(o.outcome); }
    else if (k === "arrowdown" || k === "s") { e.preventDefault(); act("skipped"); }
  };

  const reduced = prefersReducedMotion();
  const silent = app ? daysInStage(app, today) : 0;

  return (
    <Modal onClose={close} size="md" ariaLabel="Sweep">
      <div data-autofocus tabIndex={-1} onKeyDown={onKeyDown} className="outline-none">
        <div className="h-0.5 bg-border" aria-hidden>
          <div className="h-full bg-foreground transition-[width] duration-300 ease-smooth" style={{ width: total ? `${(Math.min(index, total) / total) * 100}%` : "0%" }} />
        </div>
        <ModalHeader
          title="Sweep"
          description={total > 0 && app
            ? `Quiet past your reply window · ${index + 1} of ${total}${allQuiet > total ? ` (${allQuiet.toLocaleString()} in all)` : ""}`
            : total > 0 ? "All caught up" : undefined}
          onClose={close}
        />
        <div className="px-6 pb-6">
          {isPending || !queue ? (
            <div className="h-[296px] rounded-xl border border-border bg-muted/40 animate-pulse" aria-hidden />
          ) : total === 0 ? (
            <Finished title="Nothing to sweep" body={`Every open application has heard back within ${2 * rw.days} days or has a next step dated.`} onClose={close} />
          ) : (
            <div className="relative min-h-[296px]">
              <AnimatePresence initial={false} mode="popLayout" custom={direction}>
                {app ? (
                  <motion.div
                    key={app._id}
                    custom={direction}
                    initial={reduced ? false : { opacity: 0, y: direction * 14, scale: 0.985 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={reduced ? { opacity: 0 } : { opacity: 0, y: direction * -14, scale: 0.985 }}
                    transition={{ type: "spring", stiffness: 520, damping: 42, mass: 0.9 }}
                  >
                    <div className="rounded-xl border border-border bg-background px-4 pt-4 pb-3.5">
                      <div className="flex items-start gap-3">
                        <CompanyLogo name={app.company} logoUrl={resolveCompany(app)?.logoUrl} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[15px] font-semibold tracking-tight text-foreground truncate">{app.role}</p>
                          <p className="text-[13px] text-muted-foreground truncate">{[app.company, app.location?.trim()].filter(Boolean).join(" · ")}</p>
                        </div>
                        <FitCell fit={app.fit} bare />
                      </div>
                      <dl className="mt-4 grid grid-cols-3 gap-3">
                        <Fact label="Applied" value={shortDate(app.applicationDate)} />
                        <Fact label={`Quiet in ${app.stage}`} value={`${silent} day${silent === 1 ? "" : "s"}`} />
                        <Fact label="Your replies" value={`within ${rw.days} days`} />
                      </dl>
                      <TrailLine shape={trailShape(app, undefined, rw, today)} window={[-Math.max(70, silent + 14), 0]} className="mt-3.5" />
                      <p className="mt-3 text-[12.5px] leading-relaxed text-muted-foreground">
                        {rw.isDefault
                          ? `Most replies come within two weeks — this one has been quiet for ${silent} days.`
                          : `${rw.lateReplies === 0 ? "None" : rw.lateReplies} of your ${rw.sample} replies came after ${2 * rw.days} days. This one has been quiet for ${silent}.`}
                      </p>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {OUTCOMES.map((o) => (
                        <button
                          key={o.outcome}
                          type="button"
                          onClick={() => act(o.outcome)}
                          className="group grid grid-cols-[28px_minmax(0,1fr)] gap-x-2.5 items-center text-left px-3 py-2.5 rounded-xl border border-border hover:bg-control/70 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <kbd className="row-span-2 w-7 h-7 rounded-lg border border-border bg-background flex items-center justify-center text-[12px] font-mono text-foreground">{o.key.toUpperCase()}</kbd>
                          <span className="text-[13px] font-semibold text-foreground inline-flex items-center gap-1.5"><o.Icon size={13} strokeWidth={2} className="text-muted-foreground" aria-hidden />{o.title}</span>
                          <span className="text-[12px] text-muted-foreground truncate">{o.detail}</span>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                ) : (
                  <motion.div key="done" initial={reduced ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24 }}>
                    <Finished
                      title="All swept"
                      body={`${total} application${total === 1 ? "" : "s"} closed out or given a next step.`}
                      tally={tally}
                      onClose={close}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
          {total > 0 && (
            <div className="mt-3 flex items-center gap-3 text-[12px] text-muted-foreground">
              <Button size="xs" variant="ghost" onClick={undo} disabled={done.length === 0}><Undo2 size={13} strokeWidth={2} aria-hidden />Undo<kbd className="ml-1 text-[10.5px] font-mono opacity-70">⌘Z</kbd></Button>
              {app && <Button size="xs" variant="ghost" onClick={() => act("skipped")}>Skip<kbd className="ml-1 text-[10.5px] font-mono opacity-70">↓</kbd></Button>}
              <span className="ml-auto tabular-nums">{tally.followup + tally.waiting} next steps · {tally.ghosted} ghosted · {tally.rejected} rejected</span>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10.5px] font-medium uppercase tracking-[0.06em] text-muted-foreground truncate">{label}</dt>
      <dd className="mt-0.5 text-[13px] text-foreground tabular-nums truncate">{value}</dd>
    </div>
  );
}

function Finished({ title, body, tally, onClose }: { title: string; body: string; tally?: Record<Outcome, number>; onClose: () => void }) {
  return (
    <div className="min-h-[296px] flex flex-col items-center justify-center text-center px-6">
      <span className="w-11 h-11 rounded-full bg-control flex items-center justify-center text-foreground" aria-hidden>
        {tally ? <Check size={20} strokeWidth={2.2} /> : <Hourglass size={18} strokeWidth={2} />}
      </span>
      <h3 className="mt-3 text-[15px] font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-[13px] text-muted-foreground max-w-xs">{body}</p>
      {tally && (
        <div className="mt-5 grid grid-cols-4 gap-6">
          {([["followup", "follow-ups"], ["waiting", "waiting"], ["ghosted", "ghosted"], ["rejected", "rejected"]] as const).map(([k, label]) => (
            <div key={k}>
              <p className="text-[20px] font-semibold text-foreground tabular-nums">{tally[k]}</p>
              <p className="text-[12px] text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      )}
      <Button size="sm" variant="primary" className="mt-6" onClick={onClose}>Done</Button>
    </div>
  );
}
