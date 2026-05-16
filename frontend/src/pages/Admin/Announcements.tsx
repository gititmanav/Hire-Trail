import { useState, useEffect, useCallback, useMemo } from "react";
import toast from "react-hot-toast";
import { adminAPI } from "../../utils/api";
import ConfirmModal from "../../components/ConfirmModal/ConfirmModal";
import { useConfirm } from "../../hooks/useConfirm";
import type { Announcement } from "../../types";

const TYPE_STYLES: Record<string, { bg: string; text: string }> = {
  info: {
    bg: "bg-blue-100 dark:bg-blue-900/30",
    text: "text-blue-700 dark:text-blue-400",
  },
  warning: {
    bg: "bg-yellow-100 dark:bg-yellow-900/30",
    text: "text-yellow-700 dark:text-yellow-400",
  },
  success: {
    bg: "bg-green-100 dark:bg-green-900/30",
    text: "text-green-700 dark:text-green-400",
  },
};

const BANNER_STYLES: Record<string, string> = {
  info: "bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700 text-blue-800 dark:text-blue-200",
  warning:
    "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700 text-yellow-800 dark:text-yellow-200",
  success:
    "bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700 text-green-800 dark:text-green-200",
};

interface FormData {
  title: string;
  body: string;
  type: "info" | "warning" | "success";
  endDate: string;
  dismissible: boolean;
  active: boolean;
}

const EMPTY_FORM: FormData = {
  title: "",
  body: "",
  type: "info",
  endDate: "",
  dismissible: true,
  active: true,
};

export default function Announcements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const { confirm, confirmState, handleConfirm, handleCancel } = useConfirm();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await adminAPI.getAnnouncements({ limit: 100 });
      setAnnouncements(result.data);
    } catch {
      toast.error("Failed to load announcements");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (a: Announcement) => {
    setEditingId(a._id);
    setForm({
      title: a.title,
      body: a.body,
      type: a.type,
      endDate: a.endDate ? a.endDate.slice(0, 10) : "",
      dismissible: a.dismissible,
      active: a.active,
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }
    setSubmitting(true);
    try {
      const payload: Partial<Announcement> = {
        title: form.title,
        body: form.body,
        type: form.type,
        endDate: form.endDate || undefined,
        dismissible: form.dismissible,
        active: form.active,
      };
      if (editingId) {
        await adminAPI.updateAnnouncement(editingId, payload);
        toast.success("Announcement updated");
      } else {
        await adminAPI.createAnnouncement(payload);
        toast.success("Announcement created");
      }
      closeForm();
      fetchData();
    } catch {
      toast.error("Failed to save announcement");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm("Are you sure you want to delete this announcement?", {
      title: "Delete Announcement",
      confirmLabel: "Delete",
    });
    if (!ok) return;
    try {
      await adminAPI.deleteAnnouncement(id);
      toast.success("Announcement deleted");
      fetchData();
    } catch {
      toast.error("Failed to delete announcement");
    }
  };

  const now = Date.now();
  const stats = useMemo(() => {
    let active = 0, scheduled = 0, expired = 0, inactive = 0;
    for (const a of announcements) {
      if (!a.active) { inactive++; continue; }
      const start = a.startDate ? new Date(a.startDate).getTime() : 0;
      const end = a.endDate ? new Date(a.endDate).getTime() : Infinity;
      if (start > now) scheduled++;
      else if (end < now) expired++;
      else active++;
    }
    return { total: announcements.length, active, scheduled, expired, inactive };
  }, [announcements, now]);

  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "scheduled" | "expired" | "inactive">("all");
  const filtered = useMemo(() => {
    if (statusFilter === "all") return announcements;
    return announcements.filter((a) => {
      if (!a.active) return statusFilter === "inactive";
      const start = a.startDate ? new Date(a.startDate).getTime() : 0;
      const end = a.endDate ? new Date(a.endDate).getTime() : Infinity;
      if (start > now) return statusFilter === "scheduled";
      if (end < now) return statusFilter === "expired";
      return statusFilter === "active";
    });
  }, [announcements, statusFilter, now]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="fade-up">
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Announcements</h1>
          <p className="text-sm text-muted-foreground mt-1">Banner messages shown to all users. Scheduled by start/end date.</p>
        </div>
        <button onClick={openCreate} className="btn-accent text-sm">+ New announcement</button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        {[
          { key: "all" as const, label: "All", value: stats.total, accent: "text-foreground" },
          { key: "active" as const, label: "Live", value: stats.active, accent: "text-emerald-600 dark:text-emerald-400" },
          { key: "scheduled" as const, label: "Scheduled", value: stats.scheduled, accent: "text-blue-600 dark:text-blue-400" },
          { key: "expired" as const, label: "Expired", value: stats.expired, accent: "text-muted-foreground" },
          { key: "inactive" as const, label: "Inactive", value: stats.inactive, accent: "text-amber-600 dark:text-amber-400" },
        ].map((s) => (
          <button
            key={s.key}
            onClick={() => setStatusFilter(s.key)}
            className={`bg-card border rounded-xl p-4 text-left transition-all ${statusFilter === s.key ? "border-primary/50 ring-1 ring-primary/30" : "border-border hover:border-primary/30"}`}
          >
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.accent}`}>{s.value}</p>
          </button>
        ))}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="card-premium w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <h2 className="text-lg font-semibold text-foreground">
              {editingId ? "Edit Announcement" : "Create Announcement"}
            </h2>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Title
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="input-premium w-full"
                placeholder="Announcement title"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Body
              </label>
              <textarea
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                rows={4}
                className="input-premium w-full"
                placeholder="Announcement body..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Type
                </label>
                <select
                  value={form.type}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      type: e.target.value as FormData["type"],
                    })
                  }
                  className="input-premium w-full"
                >
                  <option value="info">Info</option>
                  <option value="warning">Warning</option>
                  <option value="success">Success</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(e) =>
                    setForm({ ...form, endDate: e.target.value })
                  }
                  className="input-premium w-full"
                />
              </div>
            </div>

            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={form.dismissible}
                  onChange={(e) =>
                    setForm({ ...form, dismissible: e.target.checked })
                  }
                  className="rounded border-border"
                />
                Dismissible
              </label>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) =>
                    setForm({ ...form, active: e.target.checked })
                  }
                  className="rounded border-border"
                />
                Active
              </label>
            </div>

            {/* Preview */}
            {form.title && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Preview
                </p>
                <div
                  className={`border rounded-lg p-3 ${
                    BANNER_STYLES[form.type] || BANNER_STYLES.info
                  }`}
                >
                  <p className="font-semibold text-sm">{form.title}</p>
                  {form.body && (
                    <p className="text-sm mt-1 opacity-90">{form.body}</p>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={closeForm} className="btn-secondary text-sm">
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="btn-accent text-sm"
              >
                {submitting
                  ? "Saving..."
                  : editingId
                    ? "Update"
                    : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Announcements List */}
      {filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground">
          {announcements.length === 0 ? "No announcements yet — create your first one." : "No announcements match this filter."}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((a) => {
            const style = TYPE_STYLES[a.type] || TYPE_STYLES.info;
            const start = a.startDate ? new Date(a.startDate).getTime() : 0;
            const end = a.endDate ? new Date(a.endDate).getTime() : Infinity;
            const status = !a.active ? "Inactive" : start > now ? "Scheduled" : end < now ? "Expired" : "Live";
            const statusCls = !a.active ? "bg-muted text-muted-foreground" :
              status === "Scheduled" ? "bg-blue-500/10 text-blue-700 dark:text-blue-300" :
              status === "Expired" ? "bg-muted text-muted-foreground" :
              "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
            return (
              <div key={a._id} className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-semibold text-foreground truncate">{a.title}</h3>
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${style.bg} ${style.text}`}>{a.type}</span>
                      <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${statusCls}`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
                        {status}
                      </span>
                      {a.dismissible && <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Dismissible</span>}
                    </div>
                    {a.body && <p className="text-sm text-secondary-foreground mt-1.5 line-clamp-2">{a.body}</p>}
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span>Start: {new Date(a.startDate).toLocaleDateString()}</span>
                      <span>→</span>
                      <span>End: {new Date(a.endDate).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0">
                    <button onClick={() => openEdit(a)} className="btn-secondary text-xs px-3 py-1">Edit</button>
                    <button onClick={() => handleDelete(a._id)} className="text-xs px-3 py-1 rounded-lg border border-destructive/40 text-destructive hover:bg-destructive/10">Delete</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {confirmState.open && (
        <ConfirmModal
          title={confirmState.title}
          message={confirmState.message}
          confirmLabel={confirmState.confirmLabel}
          danger={confirmState.danger}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
    </div>
  );
}
