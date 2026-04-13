import { useState, useEffect, useCallback } from "react";
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">
          Announcements
        </h1>
        <button onClick={openCreate} className="btn-accent text-sm">
          Create Announcement
        </button>
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
      {announcements.length === 0 ? (
        <div className="card-premium p-10 text-center text-muted-foreground">
          No announcements yet.
        </div>
      ) : (
        <div className="space-y-4">
          {announcements.map((a) => {
            const style = TYPE_STYLES[a.type] || TYPE_STYLES.info;
            return (
              <div key={a._id} className="card-premium p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-semibold text-foreground">
                        {a.title}
                      </h3>
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${style.bg} ${style.text}`}
                      >
                        {a.type}
                      </span>
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          a.active
                            ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {a.active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    {a.body && (
                      <p className="text-sm text-secondary-foreground mt-1">
                        {a.body}
                      </p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span>
                        Start: {new Date(a.startDate).toLocaleDateString()}
                      </span>
                      <span>
                        End: {new Date(a.endDate).toLocaleDateString()}
                      </span>
                      {a.dismissible && <span>Dismissible</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => openEdit(a)}
                      className="btn-secondary text-xs px-3 py-1.5"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(a._id)}
                      className="text-xs px-3 py-1.5 rounded-lg border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      Delete
                    </button>
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
