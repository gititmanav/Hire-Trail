/** Deadlines filtered server-side by status tab; linked to applications when set. */
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertTriangle, Check, Clock, MoreHorizontal, Pencil, RefreshCw, Trash2 } from "lucide-react";
import toast from "../../components/ui/toast.ts";
import { deadlinesAPI, applicationsAPI } from "../../utils/api.ts";
import { SkeletonTable } from "../../components/Skeleton/Skeleton.tsx";
import EmptyState from "../../components/EmptyState/EmptyState.tsx";
import Menu from "../../components/ui/Menu.tsx";
import ConfirmModal from "../../components/ConfirmModal/ConfirmModal.tsx";
import DeadlineFormModal, { DeadlineTypeIcon } from "../../components/DeadlineFormModal/DeadlineFormModal.tsx";
import { useConfirm } from "../../hooks/useConfirm.ts";
import { groupDeadlines, BUCKET_LABEL, BUCKET_ORDER } from "../../utils/deadlineGroups.ts";
import CompanyLogo from "../../components/CompanyLogo/CompanyLogo.tsx";
import PageHeader, { CreateButton, PageBody } from "../../components/ui/PageHeader.tsx";
import SegmentedControl from "../../components/ui/SegmentedControl.tsx";
import Pagination from "../../components/ui/Pagination.tsx";
import { usePageShortcuts } from "../../hooks/usePageShortcuts.ts";
import { addDaysYmd, dayOf, diffDaysYmd, formatDay, parseYmd, todayYmd } from "../../utils/dates.ts";
import type { Deadline, Application, DeadlineFormData, Pagination as PageInfo } from "../../types";

/** Tile background tint per deadline type. Matches the Applications page
 *  fieldIcons palette so the two pages feel like one design system. */
function tileToneClass(type: string): string {
  const t = type.toLowerCase();
  if (t.includes("oa") || t.includes("assessment")) return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200";
  if (t.includes("follow"))                          return "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-200";
  if (t.includes("interview"))                       return "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-200";
  if (t.includes("offer") || t.includes("decision")) return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200";
  if (t.includes("thank"))                           return "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200";
  return "bg-muted text-muted-foreground";
}

const fmt = (d: string) => formatDay(dayOf(d), { weekday: "short", month: "short", day: "numeric" }, "en-US");
/** Whole calendar days from today to the due day (negative = overdue). */
const daysN = (d: string) => diffDaysYmd(todayYmd(), dayOf(d) || todayYmd());
const dueLabel = (d: string) => { const n = daysN(d); return n < 0 ? "Overdue" : n === 0 ? "Today" : n === 1 ? "Tomorrow" : `${n} days`; };
const dueCls = (d: string, done: boolean) => {
  if (done) return "bg-success-light text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";
  const n = daysN(d);
  if (n < 0) return "bg-danger-light text-red-700 dark:bg-red-900/30 dark:text-red-300";
  if (n <= 2) return "bg-warning-light text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";
  if (n <= 7) return "bg-primary/10 text-primary bg-primary/10 text-primary";
  return "bg-muted text-muted-foreground";
};
const btnIcon = "w-9 h-9 flex items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted";


type DeadlineTab = "upcoming" | "overdue" | "completed" | "all";
const TABS: DeadlineTab[] = ["upcoming", "overdue", "completed", "all"];

export default function Deadlines() {
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Deadline | null>(null);
  const [filter, setFilter] = useState<DeadlineTab>("upcoming");
  const [page, setPage] = useState(1);
  const [pag, setPag] = useState<PageInfo>({ page: 1, limit: 20, total: 0, pages: 0 });
  const [tabCounts, setTabCounts] = useState({ upcoming: 0, overdue: 0, completed: 0 });
  const { confirm: confirmDelete, confirmState, handleConfirm: onConfirm, handleCancel: onCancel } = useConfirm();

  const fetchData = useCallback(async () => {
    try {
      const [d, a] = await Promise.all([
        deadlinesAPI.getAll({ page, limit: 20, status: filter }),
        applicationsAPI.getAll({ limit: 999 }),
      ]);
      setDeadlines(d.data);
      setPag(d.pagination);
      setApps(a.data);
      if (d.counts) setTabCounts(d.counts);
    } catch {} finally { setLoading(false); }
  }, [page, filter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ─── Shortcut deep-link: `?new=1` opens the create modal and strips the
   *  param so a hard reload doesn't reopen it. */
  const handledNewRef = useRef(false);
  useEffect(() => {
    if (handledNewRef.current) return;
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("new") === "1") {
      handledNewRef.current = true;
      setEditing(null);
      setModal(true);
      sp.delete("new");
      const q = sp.toString();
      window.history.replaceState({}, "", `${window.location.pathname}${q ? `?${q}` : ""}`);
    }
  }, []);

  /* ─── Global search deep-link: open the edit modal for `?focus=ID`. Falls
   *  back to a single-record fetch when the deadline isn't in the current page. */
  const [searchParams, setSearchParams] = useSearchParams();
  const focusedRef = useRef<string | null>(null);
  useEffect(() => {
    const focusId = searchParams.get("focus");
    if (!focusId) { focusedRef.current = null; return; }
    if (focusedRef.current === focusId) return;
    if (deadlines.length === 0) return;
    const target = deadlines.find((d) => d._id === focusId);
    const open = (deadline: Deadline) => {
      focusedRef.current = focusId;
      setEditing(deadline);
      setModal(true);
      const next = new URLSearchParams(searchParams);
      next.delete("focus");
      setSearchParams(next, { replace: true });
    };
    if (target) { open(target); return; }
    let cancelled = false;
    void deadlinesAPI.getOne(focusId).then((fetched) => {
      if (cancelled || !fetched) return;
      open(fetched);
    }).catch(() => { /* swallow */ });
    return () => { cancelled = true; };
  }, [deadlines, searchParams, setSearchParams]);

  const save = async (d: DeadlineFormData) => {
    if (editing) { await deadlinesAPI.update(editing._id, d); toast.success("Updated"); }
    else { await deadlinesAPI.create(d); toast.success("Added"); }
    setModal(false); setEditing(null); await fetchData();
  };
  const toggle = async (d: Deadline) => { await deadlinesAPI.update(d._id, { completed: !d.completed }); toast.success(d.completed ? "Marked incomplete" : "Marked complete"); await fetchData(); };

  /* Snooze helpers. The three quick options come straight from the user spec
   * (Phase 3): "1 day / 3 days / next Monday". Future = add a custom-date
   * picker. The new dueDate is computed from the *current* dueDate so chains
   * of snoozes don't collapse onto a single day. */
  const computeSnoozeDate = useCallback((d: Deadline, kind: "1d" | "3d" | "nextMon"): string => {
    const base = dayOf(d.dueDate) || todayYmd();
    if (kind === "1d") return addDaysYmd(base, 1);
    if (kind === "3d") return addDaysYmd(base, 3);
    // Next Monday — if base is already Monday, advance to the following one.
    const day = parseYmd(base)!.getDay(); // 0=Sun..6=Sat
    return addDaysYmd(base, day === 1 ? 7 : (8 - day) % 7 || 7);
  }, []);

  const snooze = useCallback(async (d: Deadline, kind: "1d" | "3d" | "nextMon") => {
    const next = computeSnoozeDate(d, kind);
    const label = kind === "1d" ? "1 day" : kind === "3d" ? "3 days" : "next Monday";
    try {
      await deadlinesAPI.update(d._id, { dueDate: next } as Partial<DeadlineFormData>);
      toast.success(`Snoozed until ${label}`);
      await fetchData();
    } catch {
      toast.error("Couldn't snooze — try again.");
    }
  }, [computeSnoozeDate, fetchData]);
  const handleDelete = async (id: string) => {
    const ok = await confirmDelete("This deadline will be permanently deleted.", { title: "Delete deadline?", confirmLabel: "Delete" });
    if (!ok) return;
    await deadlinesAPI.delete(id);
    toast.success("Deleted");
    await fetchData();
  };
  const appLabel = (id: string | null) => { if (!id) return null; const a = apps.find((x) => x._id === id); return a ? `${a.company} — ${a.role}` : null; };

  const uc = tabCounts.upcoming;
  const oc = tabCounts.overdue;
  const cc = tabCounts.completed;

  const create = () => { setEditing(null); setModal(true); };
  const showTab = (t: DeadlineTab) => { setPage(1); setFilter(t); };
  usePageShortcuts({
    c: create,
    ...Object.fromEntries(TABS.map((t, i) => [String(i + 1), () => showTab(t)])),
  });

  /* Smart grouping: bucket the visible page of deadlines by urgency so the
   * user can scan "what's blowing up today" without scrolling. The "all"
   * and "upcoming" tabs benefit most. Single-status tabs (overdue, completed)
   * still get one consistent section header so the layout doesn't shift
   * between tabs. */
  const grouped = useMemo(() => groupDeadlines(deadlines, new Date()), [deadlines]);
  const visibleBuckets = useMemo(
    () => BUCKET_ORDER.filter((b) => grouped[b].length > 0),
    [grouped],
  );

  const header = (
    <PageHeader
      title="Deadlines"
      meta={
        oc > 0
          ? <><span className="text-red-600 dark:text-red-400">{oc} overdue</span>{uc > 0 && ` · ${uc} upcoming`}</>
          : uc > 0 ? `${uc} upcoming` : undefined
      }
      actions={
        <>
          <SegmentedControl<DeadlineTab>
            ariaLabel="Show deadlines"
            countsFromSm
            value={filter}
            onChange={showTab}
            segments={[
              { value: "upcoming", label: "Upcoming", count: uc || undefined },
              { value: "overdue", label: "Overdue", count: oc || undefined },
              { value: "completed", label: "Completed", count: cc || undefined },
              { value: "all", label: "All" },
            ]}
          />
          <CreateButton onClick={create} label="New deadline" />
        </>
      }
    />
  );

  if (loading) return <div>{header}<PageBody><SkeletonTable rows={6} /></PageBody></div>;

  return (
    <div>
      {header}
      <PageBody>
        {deadlines.length === 0 ? (
          filter === "all" ? (
            <EmptyState
              intent="welcome"
              title="Stay ahead of deadlines"
              description="Track OA due dates, interview prep blocks, follow-up reminders, and offer decision deadlines so nothing slips."
              actions={[
                { label: "Add deadline", variant: "primary", onClick: create },
              ]}
            />
          ) : (
            <EmptyState
              intent="filtered"
              title={
                filter === "upcoming" ? "You're all caught up!" :
                filter === "overdue" ? "No overdue deadlines — well done" :
                "No completed deadlines yet"
              }
              description={filter === "upcoming" ? "No deadlines are due soon. Switch tabs to see other states." : undefined}
              actions={filter !== "upcoming" ? [{ label: "Show all", variant: "secondary", onClick: () => showTab("all") }] : undefined}
            />
          )
        ) : (
          // No `overflow-hidden` here — it creates a scroll context that
          // breaks `position: sticky` on the per-bucket section headers,
          // causing them to render below their rows instead of pinning above.
          // Rows lay out by this list's width (App.css "Deadline rows").
          <div className="deadline-rows bg-card border border-border rounded-xl">
            {visibleBuckets.map((bucket) => (
              <div key={bucket} className="divide-y divide-border">
                {/* Pins under the page header. */}
                <div
                  className="sticky z-[5] px-5 py-2 bg-card/95 backdrop-blur-sm border-b border-border flex items-center justify-between"
                  style={{ top: "var(--page-header-h, 0px)" }}
                >
                  <span className={`text-[11px] font-semibold uppercase tracking-wider ${bucket === "overdue" ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground"}`}>
                    {BUCKET_LABEL[bucket]}
                  </span>
                  <span className="text-[11px] tabular-nums text-muted-foreground">{grouped[bucket].length}</span>
                </div>
                {grouped[bucket].map((d) => {
                  const linkedApp = d.applicationId ? apps.find((a) => a._id === d.applicationId) : null;
                  const overdue = !d.completed && daysN(d.dueDate) < 0;
                  return (
                    <div key={d._id} className={`deadline-row px-5 py-3 group ${d.completed ? "opacity-50" : ""} ${overdue ? "bg-red-50/40 dark:bg-red-950/15" : ""}`}>
                      {/* Complete-toggle. On hover, the circle previews its
                       *  completed state (green fill + tick) so the affordance
                       *  is obvious and removes the need for a separate "Mark
                       *  done" text CTA on each row. */}
                      <button
                        onClick={() => toggle(d)}
                        className={`deadline-row-check group/check w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                          d.completed
                            ? "bg-success border-success text-white"
                            : "border-border hover:bg-success hover:border-success"
                        }`}
                        aria-label={d.completed ? "Mark incomplete" : "Mark complete"}
                      >
                        <Check
                          size={12} strokeWidth={2.5} aria-hidden
                          className={`text-white transition-opacity ${d.completed ? "opacity-100" : "opacity-0 group-hover/check:opacity-100"}`}
                        />
                      </button>
                      {/* Type tile — icon + colored background. Matches the
                       *  Applications page's leading logo tile visually. */}
                      <div className={`deadline-row-tile w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${tileToneClass(d.type)}`} aria-hidden>
                        <DeadlineTypeIcon type={d.type} />
                      </div>
                      {/* Linked-application monogram so the row immediately tells
                       *  the user which job this deadline belongs to. Skipped for
                       *  unlinked deadlines so we don't render a stray "?" tile. */}
                      {linkedApp && (
                        <span className="deadline-row-logo shrink-0">
                          <CompanyLogo name={linkedApp.company} logoUrl={undefined} size="sm" />
                        </span>
                      )}
                      <div className="deadline-row-body min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {overdue && (
                            <AlertTriangle size={14} strokeWidth={2} className="text-red-500 shrink-0" aria-hidden />
                          )}
                          <span className="text-sm font-medium text-foreground truncate">{d.type}</span>
                          {(d.recurrenceDays ?? 0) > 0 && (
                            <span
                              className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-primary/10 text-primary shrink-0"
                              title={`Repeats every ${d.recurrenceDays} day${d.recurrenceDays === 1 ? "" : "s"}`}
                            >
                              <RefreshCw size={9} strokeWidth={2} aria-hidden />
                              {d.recurrenceDays}d
                            </span>
                          )}
                        </div>
                        {linkedApp && (
                          <span className="block text-xs text-muted-foreground truncate">{linkedApp.company} — {linkedApp.role}</span>
                        )}
                        {d.notes && <span className="block text-[11px] text-muted-foreground/85 truncate italic">{d.notes}</span>}
                      </div>
                      <div className="deadline-row-due shrink-0">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${dueCls(d.dueDate, d.completed)}`}>{d.completed ? "Done" : dueLabel(d.dueDate)}</span>
                        <span className="text-[11px] text-muted-foreground tabular-nums">{fmt(d.dueDate)}</span>
                      </div>
                      {/* Hover-revealed action toolbar. "Mark done" is no longer
                       *  rendered here — the radio toggle on the left handles it
                       *  with a hover preview, so duplicating the action as text
                       *  was redundant. */}
                      <div className="deadline-row-tools items-center gap-2 shrink-0">
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 has-[[aria-expanded=true]]:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity">
                          {!d.completed && (
                            <Menu
                              ariaLabel="Snooze deadline"
                              align="end"
                              width={208}
                              trigger={
                                <button type="button" className={btnIcon} title="Snooze deadline" aria-label="Snooze">
                                  <Clock size={14} strokeWidth={1.6} aria-hidden />
                                </button>
                              }
                              items={[
                                { label: "Snooze 1 day", onSelect: () => snooze(d, "1d") },
                                { label: "Snooze 3 days", onSelect: () => snooze(d, "3d") },
                                { label: "Snooze until next Monday", onSelect: () => snooze(d, "nextMon") },
                              ]}
                            />
                          )}
                          <button className={btnIcon} onClick={() => { setEditing(d); setModal(true); }} aria-label="Edit deadline">
                            <Pencil size={14} strokeWidth={1.5} aria-hidden />
                          </button>
                          <button className={`${btnIcon} !text-danger`} onClick={() => handleDelete(d._id)} aria-label="Delete deadline">
                            <Trash2 size={14} strokeWidth={1.5} aria-hidden />
                          </button>
                        </div>
                      </div>
                      {/* The same tools in one menu, for a narrow list. */}
                      <span className="deadline-row-more">
                        <Menu
                          ariaLabel={`Actions for ${d.type}`}
                          align="end"
                          width={220}
                          trigger={
                            <button type="button" className={btnIcon} aria-label={`Actions for ${d.type}`}>
                              <MoreHorizontal size={15} strokeWidth={1.8} aria-hidden />
                            </button>
                          }
                          items={[
                            ...(!d.completed
                              ? [
                                  { label: "Snooze 1 day", icon: <Clock size={14} strokeWidth={1.6} />, onSelect: () => void snooze(d, "1d") },
                                  { label: "Snooze 3 days", icon: <Clock size={14} strokeWidth={1.6} />, onSelect: () => void snooze(d, "3d") },
                                  { label: "Snooze until next Monday", icon: <Clock size={14} strokeWidth={1.6} />, onSelect: () => void snooze(d, "nextMon") },
                                ]
                              : []),
                            { label: "Edit deadline", icon: <Pencil size={14} strokeWidth={1.6} />, dividerBefore: !d.completed, onSelect: () => { setEditing(d); setModal(true); } },
                            { label: "Delete deadline", icon: <Trash2 size={14} strokeWidth={1.6} />, destructive: true, onSelect: () => void handleDelete(d._id) },
                          ]}
                        />
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
            <Pagination page={page} pag={pag} onPage={setPage} className="px-4 py-3 border-t border-border" />
          </div>
        )}
      </PageBody>

      {modal && <DeadlineFormModal deadline={editing} applications={apps} onSave={save} onClose={() => { setModal(false); setEditing(null); }} />}
      {confirmState.open && (
        <ConfirmModal
          title={confirmState.title}
          message={confirmState.message}
          confirmLabel={confirmState.confirmLabel}
          danger={confirmState.danger}
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      )}
    </div>
  );
}