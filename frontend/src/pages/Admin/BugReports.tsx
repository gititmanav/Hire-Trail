/** Admin bug-report inbox — silent captures from errorHandler + frontend interceptors. */
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { adminAPI } from "../../utils/api.ts";
import type { BugReport, BugReportStatus, BugReportSource } from "../../utils/api.ts";

const STATUS_OPTIONS: { value: BugReportStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "triaged", label: "Triaged" },
  { value: "ignored", label: "Ignored" },
  { value: "fixed", label: "Fixed" },
];

const SOURCE_OPTIONS: { value: BugReportSource; label: string }[] = [
  { value: "backend_500", label: "Backend 500" },
  { value: "backend_async_worker", label: "Async worker" },
  { value: "frontend_uncaught", label: "Frontend uncaught" },
  { value: "frontend_axios_5xx", label: "Frontend 5xx" },
  { value: "frontend_unhandled_rejection", label: "Frontend rejection" },
];

const STATUS_TONE: Record<BugReportStatus, string> = {
  new:      "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200",
  triaged:  "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200",
  ignored:  "bg-muted text-muted-foreground",
  fixed:    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200",
};

const SOURCE_TONE: Record<BugReportSource, string> = {
  backend_500:                    "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-200 border-red-200 dark:border-red-900/60",
  backend_async_worker:           "bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-200 border-orange-200 dark:border-orange-900/60",
  frontend_uncaught:              "bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-200 border-purple-200 dark:border-purple-900/60",
  frontend_axios_5xx:             "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200 border-amber-200 dark:border-amber-900/60",
  frontend_unhandled_rejection:   "bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-200 border-violet-200 dark:border-violet-900/60",
};

const SOURCE_LABEL: Record<BugReportSource, string> = SOURCE_OPTIONS.reduce(
  (acc, o) => { acc[o.value] = o.label; return acc; },
  {} as Record<BugReportSource, string>,
);

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export default function BugReports() {
  const [reports, setReports] = useState<BugReport[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, pages: 0 });
  const [statusFilter, setStatusFilter] = useState<BugReportStatus | "">("");
  const [sourceFilter, setSourceFilter] = useState<BugReportSource | "">("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<{ total: number; open: number } | null>(null);
  const [selected, setSelected] = useState<BugReport | null>(null);

  const fetchPage = useCallback((page: number) => {
    setLoading(true);
    adminAPI
      .listBugReports({
        page,
        limit: 25,
        status: statusFilter || undefined,
        source: sourceFilter || undefined,
        search: search.trim() || undefined,
      })
      .then((res) => {
        setReports(res.data);
        setPagination(res.pagination);
      })
      .catch(() => toast.error("Failed to load bug reports"))
      .finally(() => setLoading(false));
  }, [statusFilter, sourceFilter, search]);

  useEffect(() => { fetchPage(1); }, [fetchPage]);

  useEffect(() => {
    adminAPI.getBugReportStats()
      .then((s) => setStats({ total: s.total, open: s.open }))
      .catch(() => { /* stats are decorative */ });
  }, [reports.length]);

  const updateStatus = async (id: string, status: BugReportStatus) => {
    try {
      const updated = await adminAPI.updateBugReport(id, { status });
      setReports((prev) => prev.map((r) => (r._id === id ? { ...r, ...updated } : r)));
      if (selected?._id === id) setSelected({ ...selected, ...updated });
      toast.success(`Marked ${status}`);
    } catch { toast.error("Could not update status"); }
  };

  const updateNotes = async (id: string, adminNotes: string) => {
    try {
      const updated = await adminAPI.updateBugReport(id, { adminNotes });
      setReports((prev) => prev.map((r) => (r._id === id ? { ...r, ...updated } : r)));
      if (selected?._id === id) setSelected({ ...selected, ...updated });
    } catch { toast.error("Could not save note"); }
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Bug reports</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Silent captures from server errors and frontend exceptions. Sensitive fields are redacted before storage.
        </p>
      </div>

      {/* Stat strip */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="Total" value={stats.total} />
          <Stat label="Open (new + triaged)" value={stats.open} tone={stats.open > 0 ? "danger" : "muted"} />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <select
          className="input-premium w-44"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as BugReportStatus | "")}
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select
          className="input-premium w-52"
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value as BugReportSource | "")}
        >
          <option value="">All sources</option>
          {SOURCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <input
          type="search"
          className="input-premium w-64"
          placeholder="Search message or route…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="text-[11px] uppercase tracking-wider text-muted-foreground bg-muted/40 border-b border-border">
            <tr>
              <th className="px-3 py-2 text-left">Message</th>
              <th className="px-3 py-2 text-left">Source</th>
              <th className="px-3 py-2 text-left">Route</th>
              <th className="px-3 py-2 text-right">Count</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Last seen</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">Loading…</td></tr>
            ) : reports.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">No bug reports match these filters.</td></tr>
            ) : reports.map((r) => (
              <tr
                key={r._id}
                onClick={() => setSelected(r)}
                className="border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer"
              >
                <td className="px-3 py-2 max-w-[420px]">
                  <p className="font-medium text-foreground truncate" title={r.errorMessage}>{r.errorMessage || "(empty)"}</p>
                  <p className="text-[11px] text-muted-foreground font-mono">{r.fingerprint}</p>
                </td>
                <td className="px-3 py-2">
                  <span className={`px-2 py-0.5 rounded-full text-[10.5px] font-bold uppercase tracking-wider border ${SOURCE_TONE[r.source]}`}>
                    {SOURCE_LABEL[r.source]}
                  </span>
                </td>
                <td className="px-3 py-2 text-[12px] text-muted-foreground font-mono truncate max-w-[220px]" title={r.route}>
                  {r.method ? `${r.method} ` : ""}{r.route || "—"}
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">{r.count}</td>
                <td className="px-3 py-2">
                  <span className={`px-2 py-0.5 rounded-full text-[10.5px] font-bold uppercase tracking-wider ${STATUS_TONE[r.status]}`}>
                    {r.status}
                  </span>
                </td>
                <td className="px-3 py-2 text-[12px] text-muted-foreground">{relativeTime(r.lastSeenAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-muted-foreground">
            Page {pagination.page} of {pagination.pages} · {pagination.total.toLocaleString()} reports
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => fetchPage(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="px-3 py-1.5 text-xs font-medium border border-border rounded-lg hover:bg-muted disabled:opacity-50"
            >Previous</button>
            <button
              type="button"
              onClick={() => fetchPage(pagination.page + 1)}
              disabled={pagination.page >= pagination.pages}
              className="px-3 py-1.5 text-xs font-medium border border-border rounded-lg hover:bg-muted disabled:opacity-50"
            >Next</button>
          </div>
        </div>
      )}

      {selected && (
        <BugReportDetail
          report={selected}
          onClose={() => setSelected(null)}
          onStatus={(s) => updateStatus(selected._id, s)}
          onNotes={(n) => updateNotes(selected._id, n)}
        />
      )}
    </div>
  );
}

function Stat({ label, value, tone = "muted" }: { label: string; value: number; tone?: "muted" | "danger" }) {
  return (
    <div className={`rounded-xl border border-border p-3 ${tone === "danger" ? "bg-red-50/50 dark:bg-red-950/20" : "bg-card"}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`text-2xl font-bold mt-0.5 ${tone === "danger" ? "text-red-700 dark:text-red-200" : "text-foreground"}`}>
        {value.toLocaleString()}
      </p>
    </div>
  );
}

function BugReportDetail({
  report,
  onClose,
  onStatus,
  onNotes,
}: {
  report: BugReport;
  onClose: () => void;
  onStatus: (s: BugReportStatus) => void;
  onNotes: (n: string) => void;
}) {
  const [notes, setNotes] = useState(report.adminNotes);
  // Re-sync when the parent's selection changes (e.g. status update came back).
  useEffect(() => { setNotes(report.adminNotes); }, [report._id, report.adminNotes]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  // List of admin actions, scoped to whatever status we're NOT already in.
  const actions: { label: string; status: BugReportStatus; tone: string }[] = (
    [
      { label: "Mark triaged", status: "triaged", tone: "border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-200 dark:hover:bg-blue-900/30" },
      { label: "Mark fixed", status: "fixed", tone: "border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-200 dark:hover:bg-emerald-900/30" },
      { label: "Ignore", status: "ignored", tone: "border-border text-muted-foreground hover:bg-muted" },
    ] as const
  ).filter((a) => a.status !== report.status);

  return (
    <div className="fixed inset-0 bg-black/55 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-2xl w-full max-w-3xl max-h-[88vh] overflow-y-auto shadow-2xl animate-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`px-2 py-0.5 rounded-full text-[10.5px] font-bold uppercase tracking-wider border ${SOURCE_TONE[report.source]}`}>
                {SOURCE_LABEL[report.source]}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10.5px] font-bold uppercase tracking-wider ${STATUS_TONE[report.status]}`}>
                {report.status}
              </span>
              <span className="text-[11px] text-muted-foreground font-mono">{report.fingerprint}</span>
            </div>
            <h2 className="text-base font-semibold text-foreground break-words">{report.errorMessage || "(empty message)"}</h2>
            <p className="text-xs text-muted-foreground mt-1">
              {report.count.toLocaleString()} occurrence{report.count === 1 ? "" : "s"} · first {relativeTime(report.firstSeenAt)} · last {relativeTime(report.lastSeenAt)}
              {report.affectedUserIds.length > 0 && ` · ${report.affectedUserIds.length} affected user${report.affectedUserIds.length === 1 ? "" : "s"}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted shrink-0"
            aria-label="Close"
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="4" y1="4" x2="12" y2="12"/><line x1="12" y1="4" x2="4" y2="12"/></svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <Field label="Route">
            <code className="text-[12px] font-mono text-foreground break-all">
              {report.method ? `${report.method} ` : ""}{report.route || "—"}
            </code>
          </Field>

          {report.userAgent && (
            <Field label="User agent">
              <code className="text-[12px] font-mono text-muted-foreground break-all">{report.userAgent}</code>
            </Field>
          )}

          {report.errorStack && (
            <Field label="Stack">
              <pre className="text-[11.5px] font-mono leading-relaxed text-foreground/90 bg-muted/40 rounded-lg p-3 overflow-x-auto whitespace-pre">{report.errorStack}</pre>
            </Field>
          )}

          {report.requestBodyPreview && (
            <Field label="Request body (sanitized)">
              <pre className="text-[11.5px] font-mono leading-relaxed text-foreground/90 bg-muted/40 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all">{report.requestBodyPreview}</pre>
            </Field>
          )}

          <Field label="Admin notes">
            <textarea
              className="input-premium w-full min-h-[100px] text-sm"
              placeholder="Internal notes — root cause, link to PR, repro steps…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => { if (notes !== report.adminNotes) onNotes(notes); }}
              maxLength={4000}
            />
          </Field>
        </div>

        <div className="sticky bottom-0 bg-card border-t border-border px-6 py-4 flex items-center justify-end gap-2">
          {actions.map((a) => (
            <button
              key={a.status}
              type="button"
              onClick={() => onStatus(a.status)}
              className={`px-3 py-1.5 text-xs font-medium border rounded-lg ${a.tone}`}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">{label}</div>
      {children}
    </div>
  );
}
