import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import { adminAPI } from "../../utils/api";
import type { AuditLog, Pagination } from "../../types";

const actionColors: Record<string, string> = {
  login: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  create: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  update: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  delete: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  suspend: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
  unsuspend: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300",
  role_change: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
  export: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300",
  impersonate: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300",
};

const actionOptions = ["", "login", "create", "update", "delete", "suspend", "unsuspend", "role_change", "export", "impersonate"];
const resourceOptions = ["", "user", "application", "resume", "contact", "deadline", "announcement", "setting", "invite"];

function getUserName(userId: AuditLog["userId"]): string {
  if (typeof userId === "object" && userId !== null) return userId.name;
  return "System";
}

function formatJson(val: unknown): string {
  if (val === null || val === undefined) return "—";
  try {
    return JSON.stringify(val, null, 2);
  } catch {
    return String(val);
  }
}

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 25, total: 0, pages: 0 });
  const [actionFilter, setActionFilter] = useState("");
  const [resourceFilter, setResourceFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(
    (page: number) => {
      setLoading(true);
      const params: Record<string, unknown> = { page, limit: 25 };
      if (actionFilter) params.action = actionFilter;
      if (resourceFilter) params.resourceType = resourceFilter;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      adminAPI
        .getAuditLogs(params as Parameters<typeof adminAPI.getAuditLogs>[0])
        .then((res) => {
          setLogs(res.data);
          setPagination(res.pagination);
        })
        .catch(() => toast.error("Failed to load audit logs"))
        .finally(() => setLoading(false));
    },
    [actionFilter, resourceFilter, startDate, endDate]
  );

  useEffect(() => {
    fetchLogs(1);
  }, [fetchLogs]);

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold text-foreground">Audit Logs</h1>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <select
          className="input-premium w-44"
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
        >
          <option value="">All Actions</option>
          {actionOptions.filter(Boolean).map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <select
          className="input-premium w-44"
          value={resourceFilter}
          onChange={(e) => setResourceFilter(e.target.value)}
        >
          <option value="">All Resources</option>
          {resourceOptions.filter(Boolean).map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <input
          type="date"
          className="input-premium w-44"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          placeholder="Start Date"
        />
        <input
          type="date"
          className="input-premium w-44"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          placeholder="End Date"
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs uppercase text-muted-foreground border-b border-border">
            <tr>
              <th className="px-4 py-3 w-8" />
              <th className="px-4 py-3">Timestamp</th>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Resource Type</th>
              <th className="px-4 py-3">IP Address</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  Loading...
                </td>
              </tr>
            )}
            {!loading && logs.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No logs found.
                </td>
              </tr>
            )}
            {!loading &&
              logs.map((log) => {
                const isExpanded = expandedRow === log._id;
                const badgeCls = actionColors[log.action] || "bg-muted text-foreground";
                return (
                  <tr key={log._id} className="border-b border-border">
                    <td colSpan={6} className="p-0">
                      <div
                        className="grid grid-cols-[2rem_1fr_1fr_1fr_1fr_1fr] items-center hover:bg-muted cursor-pointer"
                        onClick={() => setExpandedRow(isExpanded ? null : log._id)}
                      >
                        <span className="px-4 py-3 text-muted-foreground">{isExpanded ? "▼" : "▶"}</span>
                        <span className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString()}
                        </span>
                        <span className="px-4 py-3 text-foreground">{getUserName(log.userId)}</span>
                        <span className="px-4 py-3">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badgeCls}`}>
                            {log.action}
                          </span>
                        </span>
                        <span className="px-4 py-3 text-muted-foreground">{log.resourceType}</span>
                        <span className="px-4 py-3 text-muted-foreground font-mono text-xs">
                          {log.ipAddress || "—"}
                        </span>
                      </div>
                      {isExpanded && (
                        <div className="px-8 py-4 bg-muted border-t border-border">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground mb-1">Old Value</p>
                              <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto max-h-48 text-foreground">
                                {formatJson(log.oldValue)}
                              </pre>
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground mb-1">New Value</p>
                              <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto max-h-48 text-foreground">
                                {formatJson(log.newValue)}
                              </pre>
                            </div>
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-muted-foreground">
            Page {pagination.page} of {pagination.pages} ({pagination.total} entries)
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => fetchLogs(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="btn-secondary text-sm disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => fetchLogs(pagination.page + 1)}
              disabled={pagination.page >= pagination.pages}
              className="btn-secondary text-sm disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
