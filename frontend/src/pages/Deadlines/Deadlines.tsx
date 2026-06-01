/** Deadlines filtered server-side by status tab; linked to applications when set. */
import { useState, useEffect, useCallback, useMemo, useRef, FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertTriangle, Calendar, Check, ChevronDown, ClipboardList, Clock, Heart, Mail,
  Pencil, Plus, RefreshCw, Trash2, Users, X,
} from "lucide-react";
import toast from "react-hot-toast";
import { deadlinesAPI, applicationsAPI } from "../../utils/api.ts";
import { SkeletonTable } from "../../components/Skeleton/Skeleton.tsx";
import EmptyState from "../../components/EmptyState/EmptyState.tsx";
import ActionDropdown from "../../components/ActionDropdown/ActionDropdown.tsx";
import ConfirmModal from "../../components/ConfirmModal/ConfirmModal.tsx";
import { useConfirm } from "../../hooks/useConfirm.ts";
import { groupDeadlines, BUCKET_LABEL, BUCKET_ORDER, type DeadlineBucket } from "../../utils/deadlineGroups.ts";
import CompanyLogo from "../../components/CompanyLogo/CompanyLogo.tsx";
import type { Deadline, Application, DeadlineFormData, Pagination } from "../../types";

/* Type → small icon for the row's leading tile. Falls back to a generic
 * calendar glyph for unknown / "Other" types. Each SVG inherits color so the
 * tile background can be tinted via CSS. */
function TypeIcon({ type }: { type: string }) {
  const t = type.toLowerCase();
  const props = { size: 14, strokeWidth: 1.8, "aria-hidden": true as const };
  if (t.includes("oa") || t.includes("assessment")) return <ClipboardList {...props} />;
  if (t.includes("follow"))                          return <Mail {...props} />;
  if (t.includes("interview"))                       return <Users {...props} />;
  if (t.includes("offer") || t.includes("decision")) return <Check {...props} />;
  if (t.includes("thank"))                           return <Heart {...props} />;
  // Other / unknown → calendar
  return <Calendar {...props} />;
}

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

const TYPES = ["OA due date", "Follow-up reminder", "Interview prep", "Offer decision", "Thank you note", "Other"];
const fmt = (d: string) => new Date(d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
const daysN = (d: string) => Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
const dueLabel = (d: string) => { const n = daysN(d); return n < 0 ? "Overdue" : n === 0 ? "Today" : n === 1 ? "Tomorrow" : `${n} days`; };
const dueCls = (d: string, done: boolean) => {
  if (done) return "bg-success-light text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";
  const n = daysN(d);
  if (n < 0) return "bg-danger-light text-red-700 dark:bg-red-900/30 dark:text-red-300";
  if (n <= 2) return "bg-warning-light text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";
  if (n <= 7) return "bg-primary/10 text-primary bg-primary/10 text-primary";
  return "bg-muted text-muted-foreground";
};
const inputCls = "w-full px-3 py-2 text-sm bg-card border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring";
const btnIcon = "w-9 h-9 flex items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted";

function Modal({ deadline: dl, applications: apps, onSave, onClose }: { deadline: Deadline | null; applications: Application[]; onSave: (d: DeadlineFormData) => Promise<void>; onClose: () => void }) {
  const [form, setForm] = useState<DeadlineFormData>({ applicationId: dl?.applicationId || "", type: dl?.type || "", dueDate: dl?.dueDate ? new Date(dl.dueDate).toISOString().split("T")[0] : "", notes: dl?.notes || "", recurrenceDays: dl?.recurrenceDays || 0 });
  const [saving, setSaving] = useState(false);
  const selectedApp = apps.find((a) => a._id === form.applicationId);

  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; document.addEventListener("keydown", h); return () => document.removeEventListener("keydown", h); }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/45 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-card rounded-xl p-6 w-full max-w-[520px] max-h-[90vh] overflow-y-auto shadow-2xl animate-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5"><h2 className="text-lg font-semibold text-foreground">{dl ? "Edit deadline" : "New deadline"}</h2><button className={btnIcon} onClick={onClose}><X size={16} strokeWidth={2} /></button></div>
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            if (!form.type) return toast.error("Please select a deadline type");
            setSaving(true);
            onSave(form).catch(() => setSaving(false));
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Type *</label>
              <ActionDropdown
                align="left"
                menuWidth="w-full"
                searchable
                searchPlaceholder="Search type..."
                trigger={
                  <button type="button" className={`${inputCls} h-9 flex items-center justify-between text-left`}>
                    <span>{form.type || "Select..."}</span>
                    <ChevronDown size={14} strokeWidth={1.5} />
                  </button>
                }
                items={[
                  { label: "Select...", onClick: () => setForm({ ...form, type: "" }), className: !form.type ? "text-primary font-medium" : undefined },
                  ...TYPES.map((t) => ({ label: t, onClick: () => setForm({ ...form, type: t }), className: form.type === t ? "text-primary font-medium" : undefined })),
                ]}
              />
            </div>
            <div><label className="block text-sm font-medium text-foreground mb-1.5">Due date *</label><input type="date" className={inputCls} value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} required /></div>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Application</label>
            <ActionDropdown
              align="left"
              menuWidth="w-full"
              searchable
              searchPlaceholder="Search application..."
              maxVisibleItems={8}
              trigger={
                <button type="button" className={`${inputCls} h-9 flex items-center justify-between text-left`}>
                  <span className="truncate">{selectedApp ? `${selectedApp.company} — ${selectedApp.role}` : "None"}</span>
                  <ChevronDown size={14} strokeWidth={1.5} />
                </button>
              }
              items={[
                { label: "None", onClick: () => setForm({ ...form, applicationId: "" }), className: !form.applicationId ? "text-primary font-medium" : undefined },
                ...apps.map((a) => ({
                  label: `${a.company} — ${a.role}`,
                  onClick: () => setForm({ ...form, applicationId: a._id }),
                  className: form.applicationId === a._id ? "text-primary font-medium" : undefined,
                })),
              ]}
            />
          </div>
          {/* Recurrence cadence — "Follow up every 2 weeks until response." When
           *  non-zero, the backend spawns the next occurrence automatically when
           *  this one is completed. Leave at 0 (default) for a one-off. */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Repeat every (days)</label>
            <input
              type="number"
              min={0}
              max={365}
              className={inputCls}
              value={form.recurrenceDays ?? 0}
              onChange={(e) => setForm({ ...form, recurrenceDays: Math.max(0, Math.min(365, parseInt(e.target.value || "0", 10) || 0)) })}
              placeholder="0 = one-off"
            />
            <p className="text-[11px] text-muted-foreground mt-1">When marked complete, the next occurrence is created automatically.</p>
          </div>
          <div><label className="block text-sm font-medium text-foreground mb-1.5">Notes</label><textarea className={`${inputCls} min-h-[80px] resize-y`} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          <div className="flex justify-end gap-2 pt-4 border-t border-border"><button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-foreground border border-border rounded-lg hover:bg-muted">Cancel</button><button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg disabled:opacity-50">{saving ? "Saving..." : dl ? "Update" : "Add deadline"}</button></div>
        </form>
      </div>
    </div>
  );
}

function PaginationBar({ page, pag, setPage }: { page: number; pag: Pagination; setPage: (p: number) => void }) {
  if (pag.pages <= 1) return null;
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-border">
      <span className="text-sm text-muted-foreground">Showing {(pag.page - 1) * pag.limit + 1}–{Math.min(pag.page * pag.limit, pag.total)} of {pag.total}</span>
      <div className="flex gap-1">
        <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1.5 text-sm border border-border rounded-lg disabled:opacity-30 hover:bg-muted text-secondary-foreground">Prev</button>
        {Array.from({ length: Math.min(pag.pages, 5) }, (_, i) => {
          const p = pag.pages <= 5 ? i + 1 : page <= 3 ? i + 1 : page >= pag.pages - 2 ? pag.pages - 4 + i : page - 2 + i;
          return <button key={p} onClick={() => setPage(p)} className={`w-9 h-9 text-sm rounded-lg ${p === page ? "bg-primary text-primary-foreground" : "border border-border text-secondary-foreground hover:bg-muted"}`}>{p}</button>;
        })}
        <button disabled={page >= pag.pages} onClick={() => setPage(page + 1)} className="px-3 py-1.5 text-sm border border-border rounded-lg disabled:opacity-30 hover:bg-muted text-secondary-foreground">Next</button>
      </div>
    </div>
  );
}

export default function Deadlines() {
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Deadline | null>(null);
  const [filter, setFilter] = useState("upcoming");
  const [page, setPage] = useState(1);
  const [pag, setPag] = useState<Pagination>({ page: 1, limit: 20, total: 0, pages: 0 });
  const [tabCounts, setTabCounts] = useState({ upcoming: 0, overdue: 0, completed: 0 });
  const { confirm: confirmDelete, confirmState, handleConfirm: onConfirm, handleCancel: onCancel } = useConfirm();

  const fetchData = useCallback(async () => {
    try {
      const [d, a] = await Promise.all([
        deadlinesAPI.getAll({ page, limit: 20, status: filter as "all" | "upcoming" | "overdue" | "completed" }),
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
    const base = new Date(d.dueDate);
    base.setHours(12, 0, 0, 0); // noon to dodge timezone edge cases
    if (kind === "1d") base.setDate(base.getDate() + 1);
    else if (kind === "3d") base.setDate(base.getDate() + 3);
    else {
      // Next Monday — if base is already Monday, advance to following Monday.
      const day = base.getDay(); // 0=Sun..6=Sat
      const delta = day === 1 ? 7 : (8 - day) % 7 || 7;
      base.setDate(base.getDate() + delta);
    }
    return base.toISOString();
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

  if (loading) return <div className="fade-up"><SkeletonTable rows={6} /></div>;

  return (
    <div className="fade-up">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6"><h1 className="text-2xl font-semibold text-foreground">Deadlines</h1><button onClick={() => { setEditing(null); setModal(true); }} className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary/90 text-white text-sm font-medium rounded-lg"><Plus size={16} strokeWidth={2} />Add deadline</button>      </div>

      <div className="sticky top-[57px] z-20 bg-background/95 backdrop-blur-sm -mx-4 md:-mx-6 px-4 md:px-6 flex gap-1 border-b border-border mb-4">
        {([["upcoming", "Upcoming", uc], ["overdue", "Overdue", oc], ["completed", "Completed", cc], ["all", "All", 0]] as [string, string, number][]).map(([k, l, c]) => (
          <button key={k} onClick={() => { setPage(1); setFilter(k); }} className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium border-b-2 -mb-px ${filter === k ? "text-primary border-primary" : "text-muted-foreground border-transparent hover:text-foreground"}`}>{l}{c > 0 && <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${k === "overdue" ? "bg-danger-light text-danger" : "bg-muted text-muted-foreground"}`}>{c}</span>}</button>
        ))}
      </div>

      {/* Summary counts */}
      {(uc > 0 || oc > 0 || cc > 0) && (
        <div className="flex items-center gap-4 mb-4 text-sm">
          {oc > 0 && <span className="flex items-center gap-1.5 text-red-600 dark:text-red-400 font-medium"><AlertTriangle size={14} strokeWidth={2} />{oc} overdue</span>}
          {uc > 0 && <span className="text-muted-foreground">{uc} upcoming</span>}
          {cc > 0 && <span className="text-muted-foreground">{cc} completed</span>}
        </div>
      )}

      {deadlines.length === 0 ? (
        filter === "all" ? (
          <EmptyState
            intent="welcome"
            title="Stay ahead of deadlines"
            description="Track OA due dates, interview prep blocks, follow-up reminders, and offer decision deadlines so nothing slips."
            actions={[
              { label: "Add deadline", variant: "primary", onClick: () => { setEditing(null); setModal(true); } },
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
            actions={filter !== "upcoming" ? [{ label: "Show all", variant: "secondary", onClick: () => setFilter("all") }] : undefined}
          />
        )
      ) : (
        // No `overflow-hidden` here — it creates a scroll context that
        // breaks `position: sticky` on the per-bucket section headers,
        // causing them to render below their rows instead of pinning above.
        <div className="bg-card border border-border rounded-xl">
          {visibleBuckets.map((bucket) => (
            <div key={bucket} className="divide-y divide-border">
              <div
                className="sticky top-[105px] z-[5] px-5 py-2 bg-card/95 backdrop-blur-sm border-b border-border flex items-center justify-between"
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
                  <div key={d._id} className={`flex items-center gap-3 px-5 py-3 group ${d.completed ? "opacity-50" : ""} ${overdue ? "bg-red-50/40 dark:bg-red-950/15" : ""}`}>
                    {/* Complete-toggle. On hover, the circle previews its
                     *  completed state (green fill + tick) so the affordance
                     *  is obvious and removes the need for a separate "Mark
                     *  done" text CTA on each row. */}
                    <button
                      onClick={() => toggle(d)}
                      className={`group/check w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
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
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${tileToneClass(d.type)}`} aria-hidden>
                      <TypeIcon type={d.type} />
                    </div>
                    {/* Linked-application monogram so the row immediately tells
                     *  the user which job this deadline belongs to. Skipped for
                     *  unlinked deadlines so we don't render a stray "?" tile. */}
                    {linkedApp && (
                      <CompanyLogo name={linkedApp.company} logoUrl={undefined} size="sm" className="shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
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
                    <div className="flex flex-col items-end gap-0.5 shrink-0">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${dueCls(d.dueDate, d.completed)}`}>{d.completed ? "Done" : dueLabel(d.dueDate)}</span>
                      <span className="text-[11px] text-muted-foreground tabular-nums">{fmt(d.dueDate)}</span>
                    </div>
                    {/* Hover-revealed action toolbar. "Mark done" is no longer
                     *  rendered here — the radio toggle on the left handles it
                     *  with a hover preview, so duplicating the action as text
                     *  was redundant. */}
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!d.completed && (
                          <ActionDropdown
                            align="right"
                            menuWidth="w-44"
                            trigger={
                              <button className={btnIcon} title="Snooze deadline" aria-label="Snooze">
                                <Clock size={14} strokeWidth={1.6} aria-hidden />
                              </button>
                            }
                            items={[
                              { label: "Snooze 1 day", onClick: () => snooze(d, "1d") },
                              { label: "Snooze 3 days", onClick: () => snooze(d, "3d") },
                              { label: "Snooze until next Monday", onClick: () => snooze(d, "nextMon") },
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
                  </div>
                );
              })}
            </div>
          ))}
          <PaginationBar page={page} pag={pag} setPage={setPage} />
        </div>
      )}

      {modal && <Modal deadline={editing} applications={apps} onSave={save} onClose={() => { setModal(false); setEditing(null); }} />}
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