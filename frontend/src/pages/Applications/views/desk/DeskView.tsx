/** Desk — the list beside the application (List view, Personalize → Desk).
 *
 *  Your applications on the left, grouped by momentum (In motion · Waiting ·
 *  Drafts · Closed) or by stage; the one you're on fills the right — the
 *  whole application, not a summary. J/K walk the list and the pane follows.
 *  The Desk is the application page for Desk readers: the open application
 *  lives in the URL (?app=<id>), so a refresh, a shared link or Back lands on
 *  it; Expand (↵) lets the pane take the page (?full=1), Shrink (Esc) gives
 *  the list back — the list slides away and the pane grows, as a view
 *  transition (App.css "Desk"). Below 900px of width the Desk is one pane at
 *  a time: the list, or the application with a way back.
 *
 *  Owns its height (the shell's fill-height): each pane scrolls on its own. */
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { MotionConfig, motion } from "motion/react";
import CompanyLogo from "../../../../components/CompanyLogo/CompanyLogo.tsx";
import Collapse from "../../../../components/ui/Collapse.tsx";
import { usePageShortcuts } from "../../../../hooks/usePageShortcuts.ts";
import { usePersistentState } from "../../../../hooks/usePersistentState.ts";
import { prefersReducedMotion } from "../../../../utils/motion.ts";
import { STAGE_STRIPE_CLASS } from "../../../../utils/stageStyles.ts";
import { todayYmd } from "../../../../utils/dates.ts";
import EmptyState from "../../components/EmptyState.tsx";
import { TONE_CLASS } from "../../components/tone.ts";
import { useApplicationsShell } from "../../ApplicationsLayout.tsx";
import { useApplicationFilters, toListParams, activeFilterCount } from "../../data/filters.ts";
import { LIST_CAP, prefetchApplication, useAllApplications, useOpenDeadlines, useReplyWindow } from "../../data/queries.ts";
import {
  MOMENTUM_LABEL, MOMENTUM_ORDER, PROGRESS_ORDER, momentum, nextDeadlines, rowFocus, sortApplications, type ReplyWindow,
} from "../../data/focus.ts";
import { useCompanyResolver } from "../shared.tsx";
import DeskPane from "./DeskPane.tsx";
import type { Application, Company, Deadline } from "../../../../types";

/** Below this the Desk shows one pane at a time. */
const SPLIT_FROM = 900;

/** Run a layout change as a view transition — the list slides, the pane
 *  grows — or plainly where the browser can't (or the person prefers no motion). */
function deskTransition(update: () => void) {
  if (typeof document.startViewTransition !== "function" || prefersReducedMotion()) { update(); return; }
  const root = document.documentElement;
  root.classList.add("vt-desk");
  const t = document.startViewTransition(() => flushSync(update));
  // A newer transition supersedes this one ("skipped") — expected, not an error.
  t.ready.catch(() => undefined);
  void t.finished.finally(() => root.classList.remove("vt-desk"));
}

/* ─── List ─── */

const DeskItem = memo(function DeskItem({ app, company, next, rw, today, selected, onSelect }: {
  app: Application;
  company?: Company;
  next?: Deadline;
  rw: ReplyWindow;
  today: string;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const focus = rowFocus(app, next, rw, today);
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      tabIndex={selected ? 0 : -1}
      data-desk-id={app._id}
      onClick={() => onSelect(app._id)}
      className="desk-item relative w-full grid grid-cols-[24px_minmax(0,1fr)_auto] gap-x-2.5 gap-y-0.5 items-center pl-2.5 pr-3 py-2 rounded-lg text-left transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {/* The open application's tab — one shared element, so it glides from
          row to row as the selection moves (App.css "Desk"). */}
      {selected && <motion.span layoutId="desk-tab" className="desk-tab" aria-hidden />}
      <CompanyLogo name={app.company} logoUrl={company?.logoUrl} size="xs" className="row-span-2 self-start mt-px" />
      <span className="text-[13px] font-medium text-foreground truncate">{app.role}</span>
      <span className={`justify-self-end text-[12px] font-medium whitespace-nowrap ${TONE_CLASS[focus.tone]}`}>{focus.short}</span>
      <span className="min-w-0 flex items-center gap-1.5 text-[12px] text-muted-foreground">
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STAGE_STRIPE_CLASS[app.stage]}`} aria-hidden />
        <span className="truncate">{app.company}</span>
      </span>
      <span className="justify-self-end text-[11.5px] text-muted-foreground whitespace-nowrap">{app.stage}</span>
    </button>
  );
});

interface Section { key: string; label: string; stage?: (typeof PROGRESS_ORDER)[number]; apps: Application[] }

export default function DeskView() {
  const shell = useApplicationsShell();
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  const { filters, resetFilters } = useApplicationFilters();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get("app");
  const urlFull = searchParams.get("full") === "1";

  const params = useMemo(() => toListParams(filters), [filters]);
  const { data, isPending } = useAllApplications(params);
  const { data: deadlines = [] } = useOpenDeadlines();
  const rw = useReplyWindow();
  const today = todayYmd();
  const next = useMemo(() => nextDeadlines(deadlines, today), [deadlines, today]);
  const apps = useMemo(() => (data?.data ?? []).filter((a) => !filters.stage || a.stage === filters.stage), [data, filters.stage]);

  /* Sections + persisted collapse (Closed / Rejected start folded). */
  const [collapsedList, setCollapsedList] = usePersistentState<string[]>(
    "hiretrail-apps-desk-collapsed", ["momentum:closed", "stage:Rejected"],
    (v): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string"),
  );
  const collapsed = useMemo(() => new Set(collapsedList), [collapsedList]);
  const toggleSection = (key: string) => setCollapsedList(collapsed.has(key) ? collapsedList.filter((k) => k !== key) : [...collapsedList, key]);

  const sections = useMemo<Section[]>(() => {
    const sort = (list: Application[]) => sortApplications(list, "smart", next, today);
    if (shell.deskGrouping === "stage") {
      return PROGRESS_ORDER.map((s) => ({ key: `stage:${s}`, label: s, stage: s, apps: sort(apps.filter((a) => a.stage === s)) })).filter((g) => g.apps.length > 0);
    }
    return MOMENTUM_ORDER
      .map((m) => ({ key: `momentum:${m}`, label: MOMENTUM_LABEL[m], apps: sort(apps.filter((a) => momentum(a, next.get(a._id), today) === m)) }))
      .filter((g) => g.apps.length > 0);
  }, [apps, shell.deskGrouping, next, today]);
  const ordered = useMemo(() => sections.flatMap((s) => (collapsed.has(s.key) ? [] : s.apps)), [sections, collapsed]);
  const resolveCompany = useCompanyResolver(ordered);

  /* Split or single pane — by the Desk's own width (the sidebar decides it). */
  const rootRef = useRef<HTMLDivElement>(null);
  const [split, setSplit] = useState(true);
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    setSplit(el.clientWidth >= SPLIT_FROM);
    const ro = new ResizeObserver(([e]) => setSplit((prev) => (prev === e.contentRect.width >= SPLIT_FROM ? prev : !prev)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* Full page: React state is what draws (so a view transition can flush it);
   * the URL mirrors it — refresh-safe, and Back/Forward drive it too. */
  const [full, setFull] = useState(urlFull);
  useEffect(() => {
    if (full !== urlFull) deskTransition(() => setFull(urlFull));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlFull]);
  const paneShown = !!selectedId && (full || !split);

  const select = useCallback((id: string) => {
    setSearchParams((prev) => {
      const sp = new URLSearchParams(prev);
      sp.set("app", id);
      return sp;
    }, { replace: true });
  }, [setSearchParams]);

  // The state and the URL change together, inside the transition — so the
  // URL-follows-state effect above never sees them disagree and starts a second one.
  const expand = useCallback(() => {
    if (!selectedId) return;
    deskTransition(() => {
      setFull(true);
      setSearchParams((prev) => { const sp = new URLSearchParams(prev); sp.set("full", "1"); return sp; }, { state: { deskFull: true } });
    });
  }, [selectedId, setSearchParams]);

  /** Back to the list: from the full page (Shrink), or — single pane — from the application. */
  const shrink = useCallback(() => {
    if (!split) {
      deskTransition(() => setSearchParams((prev) => {
        const sp = new URLSearchParams(prev);
        sp.delete("app");
        sp.delete("full");
        return sp;
      }, { replace: true }));
      return;
    }
    // Expand pushed an entry, so Back is Shrink — leave history as it was.
    // Back lands a moment later; by then the state matches it, so it's quiet.
    const pushed = (location.state as { deskFull?: boolean } | null)?.deskFull;
    deskTransition(() => {
      setFull(false);
      if (pushed) navigate(-1);
      else setSearchParams((prev) => { const sp = new URLSearchParams(prev); sp.delete("full"); return sp; }, { replace: true });
    });
  }, [location.state, navigate, setSearchParams, split]);

  /** Single pane: a tap opens the application over the list. */
  const openSingle = useCallback((id: string) => deskTransition(() => select(id)), [select]);

  /* Wide and nothing chosen: open the first application, like a mail client. */
  useEffect(() => {
    if (!split || selectedId || isPending || ordered.length === 0) return;
    select(ordered[0]._id);
  }, [split, selectedId, isPending, ordered, select]);

  /* J/K move the selection; the pane follows, its neighbours already warm. */
  const index = selectedId ? ordered.findIndex((a) => a._id === selectedId) : -1;
  const step = (delta: 1 | -1) => {
    // Single pane, list showing: nothing is open to step through.
    if (ordered.length === 0 || (!split && !paneShown)) return false;
    const target = ordered[Math.max(0, Math.min(ordered.length - 1, (index < 0 ? (delta > 0 ? -1 : ordered.length) : index) + delta))];
    if (target._id === selectedId) return;
    select(target._id);
  };
  useEffect(() => {
    if (index < 0) return;
    for (const n of [ordered[index - 1], ordered[index + 1]]) if (n) prefetchApplication(qc, n._id);
    document.querySelector<HTMLElement>(`[data-desk-id="${ordered[index]._id}"]`)?.scrollIntoView({ block: "nearest" });
  }, [index, ordered, qc]);

  // The list comes back (Shrink, Back on a phone) at the application you were on.
  const listShownNow = split ? !full : !paneShown;
  useEffect(() => {
    if (!listShownNow || !selectedId) return;
    document.querySelector<HTMLElement>(`[data-desk-id="${selectedId}"]`)?.scrollIntoView({ block: "center" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listShownNow]);

  usePageShortcuts({
    j: () => step(1),
    ArrowDown: () => step(1),
    k: () => step(-1),
    ArrowUp: () => step(-1),
    Enter: () => {
      if (!selectedId) return false;
      if (!split) { if (!paneShown) openSingle(selectedId); return; }
      if (full) shrink(); else expand();
    },
    Escape: () => { if (!paneShown) return false; shrink(); },
  });

  const narrowing = activeFilterCount(filters) > 0 || !!filters.q;
  if (!isPending && apps.length === 0) {
    return (
      <EmptyState
        mode={filters.status === "archived" && !narrowing ? "archived" : narrowing || filters.status === "archived" ? "filtered" : "welcome"}
        onAddManually={shell.openCreate}
        onImport={shell.openImport}
        onClearFilters={resetFilters}
      />
    );
  }

  const listShown = listShownNow;
  const position = index >= 0 ? { n: index + 1, of: ordered.length } : null;

  return (
    <div ref={rootRef} className="desk -mt-5 -mx-4 md:-mx-6 -mb-4 md:-mb-6 flex-1 min-h-0 flex">
      {listShown && (
        <div className={`desk-list ${split ? "is-split w-[344px]" : "flex-1"} shrink-0 min-h-0 overflow-y-auto scroll-quiet`}>
          {isPending ? (
            <DeskListSkeleton />
          ) : (
            <MotionConfig reducedMotion="user" transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}>
            <div role="listbox" aria-label="Applications" className="desk-listbox relative isolate px-2 pb-6">
              {sections.map((s) => {
                const isCollapsed = collapsed.has(s.key);
                return (
                  <div key={s.key}>
                    <button
                      type="button"
                      onClick={() => toggleSection(s.key)}
                      aria-expanded={!isCollapsed}
                      className="desk-list-head sticky top-0 z-[1] w-full flex items-center gap-2 h-8 pt-1 px-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
                    >
                      <ChevronRight size={12} strokeWidth={2.4} className={`shrink-0 text-muted-foreground transition-transform duration-200 ease-smooth motion-reduce:transition-none ${isCollapsed ? "" : "rotate-90"}`} aria-hidden />
                      {s.stage && <span className={`w-1.5 h-1.5 rounded-full ${STAGE_STRIPE_CLASS[s.stage]}`} aria-hidden />}
                      <span className="text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">{s.label}</span>
                      <span className="ml-auto text-[11.5px] text-muted-foreground tabular-nums">{s.apps.length}</span>
                    </button>
                    <Collapse open={!isCollapsed}>
                      {/* 10px above and below: room for the tab's curves at a section's ends. */}
                      <div className="space-y-0.5 py-2.5">
                        {s.apps.map((a) => (
                          <DeskItem
                            key={a._id}
                            app={a}
                            company={resolveCompany(a)}
                            next={next.get(a._id)}
                            rw={rw}
                            today={today}
                            selected={a._id === selectedId}
                            onSelect={split ? select : openSingle}
                          />
                        ))}
                      </div>
                    </Collapse>
                  </div>
                );
              })}
              {data && data.data.length >= LIST_CAP && (
                <p className="px-2 pt-3 text-[12px] text-muted-foreground">Your {LIST_CAP.toLocaleString()} most recent applications. Narrow the filters to reach older ones.</p>
              )}
            </div>
            </MotionConfig>
          )}
        </div>
      )}
      {(split || paneShown) && (
        <DeskPane
          id={selectedId}
          full={full || !split}
          split={split}
          position={position}
          onExpand={expand}
          onShrink={shrink}
          onStep={step}
          onEdit={shell.openEdit}
          onDeleted={() => {
            const neighbour = ordered[index + 1] ?? ordered[index - 1];
            if (neighbour && neighbour._id !== selectedId) select(neighbour._id);
            else setSearchParams((prev) => { const sp = new URLSearchParams(prev); sp.delete("app"); sp.delete("full"); return sp; }, { replace: true });
          }}
        />
      )}
    </div>
  );
}

function DeskListSkeleton() {
  return (
    <div className="px-2 pt-3 space-y-1" aria-hidden>
      <span className="block h-2.5 w-20 mx-2 mb-3 rounded bg-muted animate-pulse" />
      {Array.from({ length: 9 }).map((_, i) => (
        <div key={i} className="grid grid-cols-[24px_1fr] gap-x-2.5 gap-y-1.5 px-2.5 py-2">
          <span className="w-6 h-6 rounded-md bg-muted animate-pulse row-span-2" />
          <span className="h-3 rounded bg-muted animate-pulse" style={{ width: `${55 + ((i * 13) % 35)}%` }} />
          <span className="h-2.5 w-1/3 rounded bg-muted/70 animate-pulse" />
        </div>
      ))}
    </div>
  );
}
