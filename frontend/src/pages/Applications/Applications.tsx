/**
 * Applications page.
 *
 * Layout: full-width row cards (one application per row). Replaces the older
 * tabular view. The right-side resizable detail panel is preserved as-is —
 * the row click opens it. Other features kept: archive tab, stage filter,
 * server search, CSV import/export, sortable fetches, multi-select bulk
 * actions, company grouping (now opt-in via toolbar toggle).
 */
import { useCallback, useEffect, useMemo, useRef, useState, useLayoutEffect, FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ChevronDown, Download, Plus, Upload, X
} from "lucide-react";
import toast from "react-hot-toast";
import { applicationsAPI, resumesAPI, contactsAPI, deadlinesAPI, companiesAPI, masterProfileAPI } from "../../utils/api.ts";
import { useRefetchOnFocus } from "../../hooks/useRefetchOnFocus.ts";
import { useApplicationsListState } from "../../hooks/useApplicationsListState.ts";
import { exportToCSV } from "../../utils/csv.ts";
import ImportModal from "../../components/ImportModal/ImportModal.tsx";
import ActionDropdown from "../../components/ActionDropdown/ActionDropdown.tsx";
import { SkeletonStats } from "../../components/Skeleton/Skeleton.tsx";
import ResumePreview from "../../components/ResumePreview/ResumePreview.tsx";
import ConfirmModal from "../../components/ConfirmModal/ConfirmModal.tsx";
import ResumeModal from "../../components/ResumeModal/ResumeModal.tsx";
import { useConfirm } from "../../hooks/useConfirm.ts";
import { useDeadlineFollowups } from "../../hooks/useDeadlineFollowups.tsx";
import { STAGES } from "../../utils/stageStyles.ts";
import ApplicationRow from "./components/ApplicationRow.tsx";
import ApplicationsToolbar from "./components/ApplicationsToolbar.tsx";
import BulkActionBar from "./components/BulkActionBar.tsx";
import ShortcutsModal from "./components/ShortcutsModal.tsx";
import SkeletonRows from "./components/SkeletonRows.tsx";
import CompanyGroupHeader from "./components/CompanyGroupHeader.tsx";
import EmptyState from "./components/EmptyState.tsx";
import ApplicationDetailSidebar from "./ApplicationDetailSidebar.tsx";
import AiAnalysisSidebar from "./AiAnalysisSidebar.tsx";
import type {
  Application, Resume, Contact, Deadline, Stage,
  ApplicationFormData, Pagination, Company,
} from "../../types";

/** Tab-session memory of company ids we've already asked for a logo. Survives
 *  re-renders (it's outside React state) AND remounts of the Applications page,
 *  so navigating away and back doesn't re-spam the endpoint. Cleared on full
 *  page reload, which is the right escape hatch for users wanting to retry. */
const LOGO_FETCH_SEEN = new Set<string>();

/* ─── Top-level "New / Edit" modal (kept inline; small enough not to extract) ─── */
function Modal({ app, resumes, onSave, onClose, onResumesChanged }: {
  app: Application | null;
  resumes: Resume[];
  onSave: (d: ApplicationFormData) => Promise<void>;
  onClose: () => void;
  onResumesChanged: () => Promise<Resume[]>;
}) {
  const [form, setForm] = useState<ApplicationFormData>({
    company: app?.company || "", role: app?.role || "", jobUrl: app?.jobUrl || "",
    stage: app?.stage || "Applied", notes: app?.notes || "",
    resumeId: app?.resumeId || "", companyId: app?.companyId || "",
    contactId: app?.contactId || "", outreachStatus: app?.outreachStatus || "none",
    location: app?.location || "", salary: app?.salary || "", jobType: app?.jobType || "",
  });
  const [saving, setSaving] = useState(false);
  const [showResumeModal, setShowResumeModal] = useState(false);
  const u = (k: string, v: string) => setForm({ ...form, [k]: v });

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape" && !showResumeModal) onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose, showResumeModal]);

  const handleAddResume = async (data: { name: string; targetRole: string; fileName: string; file: File | null }) => {
    const created = await resumesAPI.create(data);
    const updated = await onResumesChanged();
    u("resumeId", created._id);
    setShowResumeModal(false);
    toast.success("Resume added");
    return updated;
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/45 flex items-center justify-center z-50" onClick={onClose}>
        <div className="card-premium p-6 w-full max-w-[520px] max-h-[90vh] overflow-y-auto animate-in" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold text-foreground">{app ? "Edit application" : "New application"}</h2>
            <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted">
              <X size={16} strokeWidth={2} aria-hidden />
            </button>
          </div>
          <form onSubmit={(e: FormEvent) => { e.preventDefault(); setSaving(true); onSave(form).catch(() => setSaving(false)); }} className="space-y-4">
            <div><label className="block text-sm font-medium text-foreground mb-1.5">Company *</label><input className="input-premium" value={form.company} onChange={(e) => u("company", e.target.value)} required /></div>
            <div><label className="block text-sm font-medium text-foreground mb-1.5">Role *</label><input className="input-premium" value={form.role} onChange={(e) => u("role", e.target.value)} required /></div>
            <div><label className="block text-sm font-medium text-foreground mb-1.5">Job URL</label><input type="url" className="input-premium" value={form.jobUrl} onChange={(e) => u("jobUrl", e.target.value)} /></div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div><label className="block text-sm font-medium text-foreground mb-1.5">Location</label><input className="input-premium" value={form.location || ""} onChange={(e) => u("location", e.target.value)} placeholder="City, remote, etc." /></div>
              <div><label className="block text-sm font-medium text-foreground mb-1.5">Salary</label><input className="input-premium" value={form.salary || ""} onChange={(e) => u("salary", e.target.value)} placeholder="e.g. $120k–$150k" /></div>
              <div><label className="block text-sm font-medium text-foreground mb-1.5">Job type</label><input className="input-premium" value={form.jobType || ""} onChange={(e) => u("jobType", e.target.value)} placeholder="Full-time, internship…" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Stage</label>
                <ActionDropdown
                  align="left"
                  menuWidth="w-full"
                  trigger={
                    <button type="button" className="input-premium h-9 flex items-center justify-between text-left">
                      <span>{form.stage}</span>
                      <ChevronDown size={14} strokeWidth={1.5} />
                    </button>
                  }
                  items={STAGES.map((s) => ({
                    label: s,
                    onClick: () => u("stage", s),
                    className: form.stage === s ? "text-primary font-medium" : undefined,
                  }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Resume</label>
                <div className="flex gap-1.5">
                  <div className="flex-1">
                    <ActionDropdown
                      align="left"
                      menuWidth="w-full"
                      searchable
                      searchPlaceholder="Search resumes..."
                      maxVisibleItems={8}
                      trigger={
                        <button type="button" className="input-premium h-9 flex items-center justify-between text-left">
                          <span className="truncate">{resumes.find((r) => r._id === form.resumeId)?.name || "None"}</span>
                          <ChevronDown size={14} strokeWidth={1.5} />
                        </button>
                      }
                      items={[
                        { label: "None", onClick: () => u("resumeId", ""), className: !form.resumeId ? "text-primary font-medium" : undefined },
                        ...resumes.map((r) => ({
                          label: r.name,
                          onClick: () => u("resumeId", r._id),
                          className: form.resumeId === r._id ? "text-primary font-medium" : undefined,
                        })),
                      ]}
                    />
                  </div>
                  <button type="button" onClick={() => setShowResumeModal(true)} title="Add new resume" className="w-9 h-9 shrink-0 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground/40">
                    <Plus size={16} strokeWidth={2} />
                  </button>
                </div>
              </div>
            </div>
            <div><label className="block text-sm font-medium text-foreground mb-1.5">Notes</label><textarea className="input-premium min-h-[80px] resize-y" value={form.notes} onChange={(e) => u("notes", e.target.value)} /></div>
            <div className="flex justify-end gap-2 pt-4 border-t border-border">
              <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={saving} className="btn-accent disabled:opacity-50">{saving ? "Saving..." : app ? "Update" : "Add application"}</button>
            </div>
          </form>
        </div>
      </div>
      {showResumeModal && <ResumeModal resume={null} existingTags={[...new Set(resumes.flatMap((r) => r.tags || []))].sort()} onSave={handleAddResume as any} onClose={() => setShowResumeModal(false)} />}
    </>
  );
}

/* ─── Pagination footer ─── */
function PaginationBar({ page, pag, setPage }: { page: number; pag: Pagination; setPage: (p: number) => void }) {
  if (pag.pages <= 1) return null;
  return (
    <div className="flex items-center justify-between mt-4">
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

/* ─── Main component ─── */
export default function Applications() {
  const state = useApplicationsListState();

  const [apps, setApps] = useState<Application[]>([]);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [pag, setPag] = useState<Pagination>({ page: 1, limit: 25, total: 0, pages: 0 });
  const [activeCount, setActiveCount] = useState(0);
  const [archivedCount, setArchivedCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const [modal, setModal] = useState(false);
  const [importModal, setImportModal] = useState(false);
  const [editing, setEditing] = useState<Application | null>(null);
  const [sidebarApp, setSidebarApp] = useState<Application | null>(null);
  const [sidebarResume, setSidebarResume] = useState<Resume | null>(null);
  const [aiSidebarSessionId, setAiSidebarSessionId] = useState<string | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [focusedIndex, setFocusedIndex] = useState(0);
  /** Whether this user has a master profile — drives the AppFit empty-state
   *  message ("set up your profile" vs "run analysis"). Fetched once on mount;
   *  treat missing/error as "no profile" so the nudge still appears. */
  const [hasMasterProfile, setHasMasterProfile] = useState(false);
  useEffect(() => {
    masterProfileAPI.get()
      .then((p) => setHasMasterProfile(!!p))
      .catch(() => setHasMasterProfile(false));
  }, []);

  const { confirm: confirmDelete, confirmState, handleConfirm: onConfirm, handleCancel: onCancel } = useConfirm();
  const { promptAfterStageChange } = useDeadlineFollowups();
  const focusSearchRef = useRef<(() => void) | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  /* ─── Data fetching ─── */
  const fetchData = useCallback(async () => {
    try {
      const [a, r, opposite, c, dl, co] = await Promise.all([
        applicationsAPI.getAll({
          page: state.page, limit: 25,
          sort: state.sort.field, order: state.sort.order,
          search: state.debouncedSearch || undefined,
          archived: state.archiveTab === "archived" ? "true" : "false",
        }),
        resumesAPI.getAll(),
        applicationsAPI.getAll({ limit: 1, archived: state.archiveTab === "active" ? "true" : "false" }),
        contactsAPI.getAll({ limit: 500 }),
        deadlinesAPI.getAll({ limit: 500, status: "upcoming" }),
        companiesAPI.getAll({ limit: 500 }),
      ]);
      setApps(a.data); setPag(a.pagination);
      setResumes(r); setContacts(c.data); setDeadlines(dl.data); setCompanies(co.data);
      if (state.archiveTab === "active") {
        setActiveCount(a.pagination.total); setArchivedCount(opposite.pagination.total);
      } else {
        setArchivedCount(a.pagination.total); setActiveCount(opposite.pagination.total);
      }
    } catch { /* interceptor surfaces errors */ } finally { setLoading(false); }
  }, [state.page, state.sort, state.debouncedSearch, state.archiveTab]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useRefetchOnFocus(fetchData);

  /* While any visible app has an AI pass in flight (extraction reading the
   *  posting, or fit analysis), poll the applications list so the row updates
   *  live — fields populate and the fit grade lands without a manual refresh.
   *  Polls only the apps endpoint (not the full 6-call fetchData) and stops as
   *  soon as nothing is processing. */
  const hasInFlightAi = useMemo(
    () => apps.some((a) => a.aiExtractionStatus === "processing" || a.fit?.status === "processing"),
    [apps],
  );
  useEffect(() => {
    if (!hasInFlightAi) return;
    const id = window.setInterval(async () => {
      try {
        const a = await applicationsAPI.getAll({
          page: state.page, limit: 25,
          sort: state.sort.field, order: state.sort.order,
          search: state.debouncedSearch || undefined,
          archived: state.archiveTab === "archived" ? "true" : "false",
        });
        setApps(a.data); setPag(a.pagination);
      } catch { /* interceptor surfaces errors */ }
    }, 4000);
    return () => window.clearInterval(id);
  }, [hasInFlightAi, state.page, state.sort, state.debouncedSearch, state.archiveTab]);

  /* ─── Shortcut deep-link: ?new=1 opens the create modal. We share the
   *  useSearchParams instance with the ?focus handler below — strip the
   *  param after the modal opens so a hard reload doesn't reopen it. */
  const [searchParams, setSearchParams] = useSearchParams();
  const handledNewRef = useRef(false);
  useEffect(() => {
    if (handledNewRef.current) return;
    if (searchParams.get("new") === "1") {
      handledNewRef.current = true;
      setEditing(null);
      setModal(true);
      const next = new URLSearchParams(searchParams);
      next.delete("new");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  /* ─── Funnel deep-link: ?stage=Interview pre-selects the stage filter chip
   *  (set by the Dashboard's FunnelWidget click-through). Stripped after apply
   *  so a refresh doesn't re-pin a filter the user has since cleared.
   *  Stays a no-op for unknown stages — defensive against stale links. */
  const handledStageRef = useRef(false);
  const setStageFilter = state.setStageFilter;
  useEffect(() => {
    const stageParam = searchParams.get("stage");
    if (!stageParam) {
      handledStageRef.current = false;
      return;
    }
    if (handledStageRef.current) return;
    handledStageRef.current = true;
    if (STAGES.includes(stageParam as Stage)) {
      setStageFilter(stageParam as Stage);
    }
    const next = new URLSearchParams(searchParams);
    next.delete("stage");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, setStageFilter]);

  /* ─── Global search deep-link: ?focus=ID opens the detail sidebar.
   *  Fires once per ID; the param is stripped from the URL after open so a
   *  manual close doesn't immediately re-trigger on the next render. If the
   *  target isn't in the current page of results (deep-link from a sibling
   *  page while paginated past the relevant row), we fall back to a
   *  single-record fetch so the sidebar still opens. (searchParams /
   *  setSearchParams hoisted above for the ?new handler.) */
  const focusedRef = useRef<string | null>(null);
  useEffect(() => {
    const focusId = searchParams.get("focus");
    if (!focusId) {
      // No focus param in URL → clear the guard so re-arriving with the same
      // ID later (e.g. user clicks the same attention-list item twice with the
      // sidebar closed in between) re-opens the sidebar instead of no-oping.
      focusedRef.current = null;
      return;
    }
    if (focusedRef.current === focusId) return;
    if (apps.length === 0) return;
    const target = apps.find((a) => a._id === focusId);
    const open = (app: Application) => {
      focusedRef.current = focusId;
      setSidebarApp(app);
      const next = new URLSearchParams(searchParams);
      next.delete("focus");
      setSearchParams(next, { replace: true });
    };
    if (target) {
      open(target);
      return;
    }
    // Fallback: fetch by ID. Don't await — fire-and-forget so the effect
    // doesn't suspend rendering. Swallow errors silently (likely 404 / stale id).
    let cancelled = false;
    void applicationsAPI.getOne(focusId).then((fetched) => {
      if (cancelled || !fetched) return;
      open(fetched);
    }).catch(() => { /* swallow */ });
    return () => { cancelled = true; };
  }, [apps, searchParams, setSearchParams]);

  /* ─── Derived data ─── */
  const filtered = useMemo(() => (
    state.stageFilter === "All" ? apps : apps.filter((a) => a.stage === state.stageFilter)
  ), [apps, state.stageFilter]);

  const stageCounts = useMemo(() => {
    return STAGES.reduce((acc, s) => {
      acc[s] = apps.filter((a) => a.stage === s).length;
      return acc;
    }, {} as Record<Stage, number>);
  }, [apps]);

  const resumeById = useMemo(() => Object.fromEntries(resumes.map((r) => [r._id, r])), [resumes]);
  const contactById = useMemo(() => Object.fromEntries(contacts.map((c) => [c._id, c])), [contacts]);
  /** Map of companies by id (for logos) AND by lowercased name (for apps that
   *  predate the find-or-create flow and still only have a `company` string). */
  const companyById = useMemo(() => Object.fromEntries(companies.map((c) => [c._id, c])), [companies]);
  const companyByName = useMemo(() => Object.fromEntries(companies.map((c) => [c.name.toLowerCase(), c])), [companies]);
  const resolveCompany = useCallback((app: Application): Company | undefined => (
    (app.companyId ? companyById[app.companyId] : undefined) || companyByName[app.company.toLowerCase()]
  ), [companyById, companyByName]);

  // Lazy logo refresh: for any visible app whose resolved company has no
  // logoUrl yet (and hasn't been tried recently per the backend's 30d gate),
  // fire a single fetch in the background. Deduplicated by company id
  // *across the entire tab session* via the module-level Set below — so a
  // page reload that returns the same set of unconverted companies (e.g. the
  // demo dataset) doesn't re-spam the endpoint on every render.
  useEffect(() => {
    for (const a of apps) {
      const c = resolveCompany(a);
      if (!c) continue;
      if (c.logoUrl) continue;
      if (c.logoFetchedAt) continue;
      if (LOGO_FETCH_SEEN.has(c._id)) continue;
      LOGO_FETCH_SEEN.add(c._id);
      void companiesAPI.fetchLogo(c._id).then((res) => {
        if (!res?.logoUrl) return;
        setCompanies((prev) => prev.map((p) => p._id === c._id ? { ...p, logoUrl: res.logoUrl, logoFetchedAt: res.logoFetchedAt ?? null } : p));
      }).catch(() => undefined);
    }
  }, [apps, resolveCompany]);

  // Reset focus when the visible list changes shape
  useLayoutEffect(() => {
    if (focusedIndex >= filtered.length) setFocusedIndex(Math.max(0, filtered.length - 1));
  }, [filtered.length, focusedIndex]);

  // Drop stale selections when paging/filtering loses those ids
  useEffect(() => {
    if (state.selectedIds.size === 0) return;
    const valid = new Set(apps.map((a) => a._id));
    const next = new Set(Array.from(state.selectedIds).filter((id) => valid.has(id)));
    if (next.size !== state.selectedIds.size) state.setSelectedIds(next);
  }, [apps, state.selectedIds, state]);

  /* ─── Grouped view (when toolbar toggle is on) ─── */
  const grouped = useMemo(() => {
    if (!state.groupByCompany) return null;
    const map = new Map<string, Application[]>();
    for (const a of filtered) {
      if (!map.has(a.company)) map.set(a.company, []);
      map.get(a.company)!.push(a);
    }
    return Array.from(map.entries());
  }, [filtered, state.groupByCompany]);

  /* ─── Mutations ─── */
  const handleSave = async (d: ApplicationFormData) => {
    if (editing) {
      const isNewlyRejected = d.stage === "Rejected" && editing.stage !== "Rejected";
      const updateData: Partial<ApplicationFormData & { archivedReason?: string }> = { ...d };
      if (isNewlyRejected) updateData.archivedReason = "rejected";
      await applicationsAPI.update(editing._id, updateData);
      toast.success(isNewlyRejected ? "Rejected — auto-archiving in 7 days." : "Updated");
    } else {
      await applicationsAPI.create(d);
      toast.success("Added");
    }
    setModal(false); setEditing(null);
    await fetchData();
  };

  const handleStageChange = useCallback(async (id: string, stage: Stage) => {
    try {
      const target = apps.find((a) => a._id === id);
      const fromStage = target?.stage;
      await applicationsAPI.update(id, { stage });
      toast.success(`Stage updated to ${stage}`);
      await fetchData();
      if (sidebarApp && sidebarApp._id === id) setSidebarApp((prev) => prev ? { ...prev, stage } : null);
      // Phase-3 cross-cutting: prompt the user to close any related open
      // deadlines now that the stage has moved. Non-blocking — failures are
      // swallowed by the hook so a flaky fetch doesn't break the main flow.
      if (target && fromStage && fromStage !== stage) {
        void promptAfterStageChange({
          applicationId: id,
          companyName: target.company,
          fromStage,
          toStage: stage,
        });
      }
    } catch { /* interceptor */ }
  }, [fetchData, sidebarApp, apps, promptAfterStageChange]);

  const handleSidebarSave = useCallback(async (id: string, data: Partial<ApplicationFormData> & { jobDescription?: string }) => {
    await applicationsAPI.update(id, data);
    await fetchData();
    const updated = await applicationsAPI.getOne(id);
    setSidebarApp(updated);
  }, [fetchData]);

  const handleDelete = useCallback(async (id: string) => {
    const ok = await confirmDelete("This application will be permanently deleted.", { title: "Delete application?", confirmLabel: "Delete" });
    if (!ok) return;
    await applicationsAPI.delete(id);
    toast.success("Deleted");
    await fetchData();
  }, [confirmDelete, fetchData]);

  const handleExport = async () => {
    try {
      toast.loading("Preparing export...", { id: "export" });
      const res = await applicationsAPI.getAll({ limit: 999 });
      exportToCSV(res.data);
      toast.success(`Exported ${res.data.length} applications`, { id: "export" });
    } catch { toast.error("Export failed", { id: "export" }); }
  };

  /* ─── Bulk actions ─── */
  const selectedCount = state.selectedIds.size;
  const bulkArchive = async () => {
    if (selectedCount === 0) return;
    const ok = await confirmDelete(`Archive ${selectedCount} selected application${selectedCount === 1 ? "" : "s"}?`, { title: "Archive selected?", confirmLabel: "Archive", danger: false });
    if (!ok) return;
    await Promise.all(Array.from(state.selectedIds).map((id) => applicationsAPI.archive(id, "manual")));
    toast.success(`Archived ${selectedCount}`);
    state.clearSelection();
    await fetchData();
  };
  const bulkUnarchive = async () => {
    if (selectedCount === 0) return;
    await Promise.all(Array.from(state.selectedIds).map((id) => applicationsAPI.unarchive(id)));
    toast.success(`Unarchived ${selectedCount}`);
    state.clearSelection();
    await fetchData();
  };
  const bulkDelete = async () => {
    if (selectedCount === 0) return;
    const ok = await confirmDelete(`Permanently delete ${selectedCount} application${selectedCount === 1 ? "" : "s"}?`, { title: "Delete selected?", confirmLabel: "Delete" });
    if (!ok) return;
    await Promise.all(Array.from(state.selectedIds).map((id) => applicationsAPI.delete(id)));
    toast.success(`Deleted ${selectedCount}`);
    state.clearSelection();
    await fetchData();
  };

  /* ─── Keyboard navigation ─── */
  useEffect(() => {
    const isTyping = () => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable;
    };

    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (state.selectedIds.size > 0) { state.clearSelection(); return; }
        if (shortcutsOpen) { setShortcutsOpen(false); return; }
      }
      if (isTyping()) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      switch (e.key) {
        case "j":
          e.preventDefault();
          setFocusedIndex((i) => Math.min(filtered.length - 1, i + 1));
          break;
        case "k":
          e.preventDefault();
          setFocusedIndex((i) => Math.max(0, i - 1));
          break;
        case "Enter": {
          const app = filtered[focusedIndex];
          if (app) { e.preventDefault(); setSidebarApp(app); }
          break;
        }
        case "e": {
          const app = filtered[focusedIndex];
          if (app) { e.preventDefault(); setEditing(app); setModal(true); }
          break;
        }
        case "x": {
          const app = filtered[focusedIndex];
          if (app) { e.preventDefault(); state.toggleSelectedId(app._id); }
          break;
        }
        case "/":
          e.preventDefault();
          focusSearchRef.current?.();
          break;
        case "?":
          e.preventDefault();
          setShortcutsOpen(true);
          break;
        default:
          break;
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [filtered, focusedIndex, shortcutsOpen, state]);

  // Scroll focused row into view
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-app-row="1"][tabindex="0"]`);
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    el?.focus({ preventScroll: true });
  }, [focusedIndex]);

  const toggleGroup = (company: string) => setExpandedGroups((prev) => {
    const next = new Set(prev);
    if (next.has(company)) next.delete(company); else next.add(company);
    return next;
  });

  /* ─── Render ─── */
  if (loading) {
    return (
      <div className="fade-up">
        <SkeletonStats />
        <SkeletonRows count={6} />
      </div>
    );
  }

  return (
    <div className="fade-up">
      {/* Header */}
      {/* Header wraps to a second row below ~430px so the Import/Export/Add
       *  buttons don't push the H1 off-screen on mobile. */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Applications</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setImportModal(true)} className="btn-secondary" title="Import CSV">
            <Upload size={16} strokeWidth={1.5} />Import
          </button>
          <button onClick={handleExport} className="btn-secondary" title="Export CSV">
            <Download size={16} strokeWidth={1.5} />Export
          </button>
          <button onClick={() => { setEditing(null); setModal(true); }} className="btn-accent">
            <Plus size={16} strokeWidth={2} />Add application
          </button>
        </div>
      </div>

      {/* Archive tabs */}
      <div className="flex gap-6 mb-3 border-b border-border">
        {([["active", "Active", activeCount], ["archived", "Archived", archivedCount]] as const).map(([tab, label, count]) => (
          <button
            key={tab}
            onClick={() => state.setArchiveTab(tab)}
            className={`pb-2 text-sm font-medium border-b-2 ${
              state.archiveTab === tab ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {label} <span className="text-xs ml-1 text-muted-foreground">({count})</span>
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <ApplicationsToolbar
        search={state.search}
        onSearch={state.setSearch}
        stageFilter={state.stageFilter}
        onStageFilter={state.setStageFilter}
        stageCounts={stageCounts}
        density={state.density}
        onDensity={state.setDensity}
        groupByCompany={state.groupByCompany}
        onGroupToggle={state.setGroupByCompany}
        onShortcutsHelp={() => setShortcutsOpen(true)}
        focusSearchRef={focusSearchRef}
      />

      {/* List */}
      {filtered.length === 0 ? (
        <EmptyState
          mode={apps.length === 0 ? "welcome" : "filtered"}
          onAddManually={() => { setEditing(null); setModal(true); }}
          onImport={() => setImportModal(true)}
          onClearFilters={() => { state.setStageFilter("All"); state.setSearch(""); }}
        />
      ) : (
        <div
          ref={listRef}
          role="list"
          aria-label="Applications"
          className="mt-4 space-y-2"
          // Changing the key when filters change forces React to remount the
          // rows, re-firing the stagger animation. Cheap "feels alive" trick.
          key={`${state.stageFilter}|${state.debouncedSearch}|${state.archiveTab}`}
        >
          {grouped ? (
            grouped.map(([company, companyApps]) => {
              const expanded = expandedGroups.has(company);
              return (
                <div key={company} className="space-y-2">
                  <CompanyGroupHeader
                    company={company}
                    apps={companyApps}
                    expanded={expanded}
                    onToggle={() => toggleGroup(company)}
                  />
                  {expanded && (
                    <div className="space-y-2 pl-4 border-l-2 border-border ml-2">
                      {companyApps.map((a) => {
                        const idx = filtered.indexOf(a);
                        return (
                          <ApplicationRow
                            key={a._id}
                            app={a}
                            resume={a.resumeId ? resumeById[a.resumeId] : undefined}
                            contact={a.contactId ? contactById[a.contactId] : undefined}
                            deadlines={deadlines}
                            density={state.density}
                            focused={focusedIndex === idx}
                            selected={state.selectedIds.has(a._id)}
                            selectionActive={selectedCount > 0}
                            onOpen={() => setSidebarApp(a)}
                            onEdit={() => { setEditing(a); setModal(true); }}
                            onDelete={() => handleDelete(a._id)}
                            onToggleSelect={() => state.toggleSelectedId(a._id)}
                            onResumeClick={() => {
                              const r = a.resumeId ? resumeById[a.resumeId] : undefined;
                              if (r?.fileUrl) setSidebarResume(r);
                            }}
                            onOpenFit={(sid) => sid && setAiSidebarSessionId(sid)}
                            hasMasterProfile={hasMasterProfile}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            filtered.map((a, idx) => (
              <ApplicationRow
                key={a._id}
                app={a}
                company={resolveCompany(a)}
                resume={a.resumeId ? resumeById[a.resumeId] : undefined}
                contact={a.contactId ? contactById[a.contactId] : undefined}
                deadlines={deadlines}
                density={state.density}
                focused={focusedIndex === idx}
                selected={state.selectedIds.has(a._id)}
                selectionActive={selectedCount > 0}
                staggerIndex={idx}
                onOpen={() => setSidebarApp(a)}
                onEdit={() => { setEditing(a); setModal(true); }}
                onDelete={() => handleDelete(a._id)}
                onToggleSelect={() => state.toggleSelectedId(a._id)}
                onResumeClick={() => {
                  const r = a.resumeId ? resumeById[a.resumeId] : undefined;
                  if (r?.fileUrl) setSidebarResume(r);
                }}
                onOpenFit={(sid) => sid && setAiSidebarSessionId(sid)}
                hasMasterProfile={hasMasterProfile}
              />
            ))
          )}

          <PaginationBar page={state.page} pag={pag} setPage={state.setPage} />
        </div>
      )}

      {/* Floating bulk-action bar */}
      {selectedCount > 0 && (
        <BulkActionBar
          count={selectedCount}
          archived={state.archiveTab === "archived"}
          onArchive={bulkArchive}
          onUnarchive={bulkUnarchive}
          onDelete={bulkDelete}
          onClear={state.clearSelection}
        />
      )}

      {/* Sidebar */}
      {sidebarApp && (
        <ApplicationDetailSidebar
          app={sidebarApp}
          resumes={resumes}
          contacts={contacts}
          deadlines={deadlines}
          onClose={() => { setSidebarApp(null); setSidebarResume(null); }}
          onStageChange={handleStageChange}
          onViewResume={(r) => setSidebarResume(r)}
          onSaveInline={handleSidebarSave}
        />
      )}
      {sidebarResume && sidebarResume.fileUrl && (
        <ResumePreview fileUrl={sidebarResume.fileUrl} name={sidebarResume.name} fileName={sidebarResume.fileName} onClose={() => setSidebarResume(null)} />
      )}
      {aiSidebarSessionId && (
        <AiAnalysisSidebar sessionId={aiSidebarSessionId} onClose={() => setAiSidebarSessionId(null)} />
      )}

      {modal && (
        <Modal
          app={editing}
          resumes={resumes}
          onSave={handleSave}
          onClose={() => { setModal(false); setEditing(null); }}
          onResumesChanged={async () => { const r = await resumesAPI.getAll(); setResumes(r); return r; }}
        />
      )}
      {importModal && <ImportModal onClose={() => setImportModal(false)} onImported={fetchData} />}
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
      {shortcutsOpen && <ShortcutsModal onClose={() => setShortcutsOpen(false)} />}
    </div>
  );
}
