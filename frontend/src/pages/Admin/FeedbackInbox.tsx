/** Admin Feedback inbox — list, filter, triage. */
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { adminAPI } from "../../utils/api.ts";
import type { FeedbackItem, FeedbackStatus, FeedbackSeverity, FeedbackType } from "../../utils/api.ts";

const STATUS_OPTIONS: { value: FeedbackStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "triaged", label: "Triaged" },
  { value: "in_progress", label: "In progress" },
  { value: "resolved", label: "Resolved" },
  { value: "dismissed", label: "Dismissed" },
];

const SEVERITY_OPTIONS: { value: FeedbackSeverity; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

const TYPE_META: Record<FeedbackType, { label: string; tone: string }> = {
  bug: { label: "Bug", tone: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200" },
  suggestion: { label: "Suggestion", tone: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200" },
  idea: { label: "Idea", tone: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200" },
  praise: { label: "Praise", tone: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200" },
  other: { label: "Other", tone: "bg-muted text-muted-foreground" },
};

const STATUS_META: Record<FeedbackStatus, { label: string; tone: string }> = {
  open: { label: "Open", tone: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200" },
  triaged: { label: "Triaged", tone: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200" },
  in_progress: { label: "In progress", tone: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200" },
  resolved: { label: "Resolved", tone: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200" },
  dismissed: { label: "Dismissed", tone: "bg-muted text-muted-foreground" },
};

const SEVERITY_META: Record<FeedbackSeverity, { label: string; dot: string }> = {
  low: { label: "Low", dot: "bg-gray-400" },
  normal: { label: "Normal", dot: "bg-blue-500" },
  high: { label: "High", dot: "bg-amber-500" },
  critical: { label: "Critical", dot: "bg-red-600" },
};

interface Stats {
  total: number;
  open: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  bySeverity: Record<string, number>;
}

export default function FeedbackInbox() {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("");
  const [filterSeverity, setFilterSeverity] = useState<string>("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [selected, setSelected] = useState<FeedbackItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [res, s] = await Promise.all([
        adminAPI.listFeedback({
          page,
          limit: 25,
          status: filterStatus || undefined,
          type: filterType || undefined,
          severity: filterSeverity || undefined,
          search: search.trim() || undefined,
        }),
        adminAPI.getFeedbackStats(),
      ]);
      setItems(res.data);
      setPages(res.pagination.pages);
      setStats(s);
    } catch {
      toast.error("Could not load feedback");
    } finally {
      setLoading(false);
    }
  }, [page, filterStatus, filterType, filterSeverity, search]);

  useEffect(() => { void load(); }, [load]);

  const updateSelected = (next: FeedbackItem) => {
    setSelected(next);
    setItems((prev) => prev.map((x) => (x._id === next._id ? next : x)));
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((x) => x._id !== id));
    setSelected(null);
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Feedback Inbox</h1>
        <p className="text-sm text-muted-foreground mt-1">Bug reports, suggestions, ideas, and praise from your users.</p>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Total" value={stats?.total ?? "—"} tone="bg-card" />
        <StatCard label="Open" value={stats?.open ?? "—"} tone="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/40" />
        <StatCard label="Bugs" value={stats?.byType.bug ?? "—"} tone="bg-card" />
        <StatCard label="Suggestions" value={stats?.byType.suggestion ?? "—"} tone="bg-card" />
        <StatCard label="Ideas" value={stats?.byType.idea ?? "—"} tone="bg-card" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center bg-card border border-border rounded-xl p-3">
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search title, message, or email…"
          className="flex-1 min-w-[200px] px-3 py-1.5 text-sm bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
        />
        <FilterSelect value={filterStatus} onChange={(v) => { setFilterStatus(v); setPage(1); }} placeholder="All statuses" options={STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))} />
        <FilterSelect value={filterType} onChange={(v) => { setFilterType(v); setPage(1); }} placeholder="All types" options={(["bug","suggestion","idea","praise","other"] as const).map((v) => ({ value: v, label: TYPE_META[v].label }))} />
        <FilterSelect value={filterSeverity} onChange={(v) => { setFilterSeverity(v); setPage(1); }} placeholder="All severities" options={SEVERITY_OPTIONS.map((o) => ({ value: o.value, label: o.label }))} />
      </div>

      {/* List + detail split */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_420px] gap-4">
        {/* List */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-10 text-center text-sm text-muted-foreground">Loading…</div>
          ) : items.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">No feedback yet matching these filters.</div>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((f) => (
                <li key={f._id}>
                  <button
                    onClick={() => setSelected(f)}
                    className={`w-full px-4 py-3 text-left hover:bg-muted/40 transition-colors flex items-start gap-3 ${selected?._id === f._id ? "bg-muted/40" : ""}`}
                  >
                    <span className={`shrink-0 mt-0.5 inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${TYPE_META[f.type].tone}`}>
                      {TYPE_META[f.type].label}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-semibold text-foreground truncate">{f.title}</span>
                        <span className={`shrink-0 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded ${STATUS_META[f.status].tone}`}>
                          {STATUS_META[f.status].label}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{f.message}</p>
                      <p className="text-[11px] text-muted-foreground/80 mt-1 flex items-center gap-2">
                        <span className="inline-flex items-center gap-1">
                          <span className={`w-1.5 h-1.5 rounded-full ${SEVERITY_META[f.severity].dot}`} />
                          {SEVERITY_META[f.severity].label}
                        </span>
                        <span>·</span>
                        <span>{f.userName || f.userEmail}</span>
                        <span>·</span>
                        <span>{new Date(f.createdAt).toLocaleString()}</span>
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {pages > 1 && (
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-border text-xs text-muted-foreground">
              <span>Page {page} of {pages}</span>
              <div className="flex gap-1">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="px-2.5 py-1 border border-border rounded hover:bg-muted disabled:opacity-40">Prev</button>
                <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page >= pages} className="px-2.5 py-1 border border-border rounded hover:bg-muted disabled:opacity-40">Next</button>
              </div>
            </div>
          )}
        </div>

        {/* Detail */}
        <DetailPane selected={selected} onUpdate={updateSelected} onDelete={removeItem} onClose={() => setSelected(null)} />
      </div>
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number | string; tone: string }) {
  return (
    <div className={`border border-border rounded-xl p-4 ${tone}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold text-foreground mt-1 tabular-nums">{value}</p>
    </div>
  );
}

function FilterSelect({ value, onChange, placeholder, options }: { value: string; onChange: (v: string) => void; placeholder: string; options: { value: string; label: string }[] }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="px-3 py-1.5 text-sm bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
    >
      <option value="">{placeholder}</option>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function DetailPane({ selected, onUpdate, onDelete, onClose }: {
  selected: FeedbackItem | null;
  onUpdate: (f: FeedbackItem) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  useEffect(() => { setNotes(selected?.adminNotes || ""); }, [selected]);

  if (!selected) {
    return (
      <div className="bg-card border border-border rounded-xl p-6 text-center text-sm text-muted-foreground">
        Select a feedback item to triage.
      </div>
    );
  }

  const setStatus = async (status: FeedbackStatus) => {
    try {
      const next = await adminAPI.updateFeedback(selected._id, { status });
      onUpdate(next);
      toast.success(`Marked ${STATUS_META[status].label}`);
    } catch { toast.error("Update failed"); }
  };

  const setSeverity = async (severity: FeedbackSeverity) => {
    try {
      const next = await adminAPI.updateFeedback(selected._id, { severity });
      onUpdate(next);
    } catch { toast.error("Update failed"); }
  };

  const saveNotes = async () => {
    setSavingNotes(true);
    try {
      const next = await adminAPI.updateFeedback(selected._id, { adminNotes: notes });
      onUpdate(next);
      toast.success("Notes saved");
    } catch { toast.error("Save failed"); }
    finally { setSavingNotes(false); }
  };

  const remove = async () => {
    if (!confirm("Delete this feedback permanently?")) return;
    try {
      await adminAPI.deleteFeedback(selected._id);
      onDelete(selected._id);
      toast.success("Deleted");
    } catch { toast.error("Delete failed"); }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4 self-start sticky top-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${TYPE_META[selected.type].tone}`}>
            {TYPE_META[selected.type].label}
          </span>
          <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded ${STATUS_META[selected.status].tone}`}>
            {STATUS_META[selected.status].label}
          </span>
        </div>
        <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted">
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="4" y1="4" x2="12" y2="12"/><line x1="12" y1="4" x2="4" y2="12"/></svg>
        </button>
      </div>

      <h2 className="text-base font-semibold text-foreground">{selected.title}</h2>
      <pre className="text-sm text-foreground whitespace-pre-wrap font-sans leading-relaxed bg-muted/30 border border-border rounded-lg p-3 max-h-[40vh] overflow-auto">
        {selected.message}
      </pre>

      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <FieldRow label="From">{selected.userName} ({selected.userEmail})</FieldRow>
        <FieldRow label="Page"><code className="font-mono">{selected.pageContext || "—"}</code></FieldRow>
        <FieldRow label="App version">{selected.appVersion || "—"}</FieldRow>
        <FieldRow label="Submitted">{new Date(selected.createdAt).toLocaleString()}</FieldRow>
      </div>

      {selected.userAgent && (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Browser</summary>
          <code className="font-mono text-[11px] block mt-1 text-muted-foreground break-all">{selected.userAgent}</code>
        </details>
      )}

      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border">
        <label className="text-xs">
          <span className="block text-muted-foreground mb-1">Status</span>
          <select value={selected.status} onChange={(e) => setStatus(e.target.value as FeedbackStatus)} className="w-full px-2.5 py-1.5 text-sm bg-background border border-border rounded-md">
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
        <label className="text-xs">
          <span className="block text-muted-foreground mb-1">Severity</span>
          <select value={selected.severity} onChange={(e) => setSeverity(e.target.value as FeedbackSeverity)} className="w-full px-2.5 py-1.5 text-sm bg-background border border-border rounded-md">
            {SEVERITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
      </div>

      <div>
        <label className="block text-xs text-muted-foreground mb-1">Admin notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Triage notes, repro steps, links…"
          className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 resize-y"
        />
        <div className="flex justify-end mt-2 gap-2">
          <button onClick={saveNotes} disabled={savingNotes || notes === selected.adminNotes} className="px-3 py-1 text-xs font-medium text-white bg-primary rounded-md disabled:opacity-50">
            {savingNotes ? "Saving…" : "Save notes"}
          </button>
        </div>
      </div>

      <div className="flex justify-between pt-3 border-t border-border">
        <button onClick={remove} className="text-xs font-medium text-red-600 hover:underline">Delete</button>
      </div>
    </div>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className="text-foreground">{children}</p>
    </div>
  );
}
