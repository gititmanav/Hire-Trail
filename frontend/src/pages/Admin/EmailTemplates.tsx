import { useState, useEffect, useCallback, useMemo } from "react";
import toast from "react-hot-toast";
import { adminAPI } from "../../utils/api";
import ConfirmModal from "../../components/ConfirmModal/ConfirmModal";
import { useConfirm } from "../../hooks/useConfirm";
import type { EmailTemplate } from "../../types";

const TYPE_STYLES: Record<string, { bg: string; text: string }> = {
  welcome: {
    bg: "bg-green-100 dark:bg-green-900/30",
    text: "text-green-700 dark:text-green-400",
  },
  reset: {
    bg: "bg-blue-100 dark:bg-blue-900/30",
    text: "text-blue-700 dark:text-blue-400",
  },
  suspend: {
    bg: "bg-red-100 dark:bg-red-900/30",
    text: "text-red-700 dark:text-red-400",
  },
  reminder: {
    bg: "bg-yellow-100 dark:bg-yellow-900/30",
    text: "text-yellow-700 dark:text-yellow-400",
  },
  digest: {
    bg: "bg-purple-100 dark:bg-purple-900/30",
    text: "text-purple-700 dark:text-purple-400",
  },
};

const SAMPLE_VARS: Record<string, string> = {
  userName: "John Doe",
  appName: "HireTrail",
  userEmail: "john@example.com",
  resetLink: "https://hiretrail.app/reset/abc123",
  loginLink: "https://hiretrail.app/login",
  date: new Date().toLocaleDateString(),
};

interface FormData {
  name: string;
  subject: string;
  bodyHtml: string;
  variables: string;
  type: EmailTemplate["type"];
  active: boolean;
}

const EMPTY_FORM: FormData = {
  name: "",
  subject: "",
  bodyHtml: "",
  variables: "",
  type: "welcome",
  active: true,
};

export default function EmailTemplates() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const { confirm, confirmState, handleConfirm, handleCancel } = useConfirm();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await adminAPI.getEmailTemplates({ limit: 100 });
      setTemplates(result.data);
    } catch {
      toast.error("Failed to load email templates");
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
    setShowPreview(false);
  };

  const openEdit = (t: EmailTemplate) => {
    setEditingId(t._id);
    setForm({
      name: t.name,
      subject: t.subject,
      bodyHtml: t.bodyHtml,
      variables: t.variables.join(", "),
      type: t.type,
      active: t.active,
    });
    setShowForm(true);
    setShowPreview(false);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowPreview(false);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error("Template name is required");
      return;
    }
    if (!form.subject.trim()) {
      toast.error("Subject is required");
      return;
    }
    setSubmitting(true);
    try {
      const variables = form.variables
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
      const payload: Partial<EmailTemplate> = {
        name: form.name,
        subject: form.subject,
        bodyHtml: form.bodyHtml,
        variables,
        type: form.type,
        active: form.active,
      };
      if (editingId) {
        await adminAPI.updateEmailTemplate(editingId, payload);
        toast.success("Template updated");
      } else {
        await adminAPI.createEmailTemplate(payload);
        toast.success("Template created");
      }
      closeForm();
      fetchData();
    } catch {
      toast.error("Failed to save template");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm("Are you sure you want to delete this template?", {
      title: "Delete Template",
      confirmLabel: "Delete",
    });
    if (!ok) return;
    try {
      await adminAPI.deleteEmailTemplate(id);
      toast.success("Template deleted");
      fetchData();
    } catch {
      toast.error("Failed to delete template");
    }
  };

  const previewHtml = useMemo(() => {
    let html = form.bodyHtml;
    for (const [key, val] of Object.entries(SAMPLE_VARS)) {
      html = html.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), val);
    }
    return html;
  }, [form.bodyHtml]);

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
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-foreground">
            Email Templates
          </h1>
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">
            Coming Soon
          </span>
        </div>
        <button onClick={openCreate} className="btn-accent text-sm">
          Create Template
        </button>
      </div>

      <div className="card-premium p-4 border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/10">
        <p className="text-sm text-yellow-700 dark:text-yellow-400">
          Email sending is not yet connected. Templates created here will be
          used once the email integration is active.
        </p>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="card-premium w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <h2 className="text-lg font-semibold text-foreground">
              {editingId ? "Edit Template" : "Create Template"}
            </h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="input-premium w-full"
                  placeholder="Template name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Type
                </label>
                <select
                  value={form.type}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      type: e.target.value as EmailTemplate["type"],
                    })
                  }
                  className="input-premium w-full"
                >
                  <option value="welcome">Welcome</option>
                  <option value="reset">Reset</option>
                  <option value="suspend">Suspend</option>
                  <option value="reminder">Reminder</option>
                  <option value="digest">Digest</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Subject
              </label>
              <input
                type="text"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                className="input-premium w-full"
                placeholder="Email subject line"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Body (HTML)
              </label>
              <textarea
                value={form.bodyHtml}
                onChange={(e) =>
                  setForm({ ...form, bodyHtml: e.target.value })
                }
                rows={8}
                className="input-premium w-full font-mono text-sm"
                placeholder="<h1>Hello {{userName}}</h1><p>Welcome to {{appName}}!</p>"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Variables (comma-separated)
              </label>
              <input
                type="text"
                value={form.variables}
                onChange={(e) =>
                  setForm({ ...form, variables: e.target.value })
                }
                className="input-premium w-full"
                placeholder="userName, appName, resetLink"
              />
            </div>

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

            {/* Preview Toggle */}
            <div>
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="btn-secondary text-xs"
              >
                {showPreview ? "Hide Preview" : "Show Preview"}
              </button>
              {showPreview && (
                <div className="mt-3 border border-border rounded-lg overflow-hidden">
                  <div className="bg-muted px-4 py-2 border-b border-border">
                    <p className="text-xs text-muted-foreground">
                      HTML Preview (sample data substituted)
                    </p>
                  </div>
                  <div
                    className="p-4 bg-background prose dark:prose-invert max-w-none text-sm"
                    dangerouslySetInnerHTML={{ __html: previewHtml }}
                  />
                </div>
              )}
            </div>

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

      {/* Template List */}
      {templates.length === 0 ? (
        <div className="card-premium p-10 text-center text-muted-foreground">
          No email templates yet.
        </div>
      ) : (
        <div className="space-y-4">
          {templates.map((t) => {
            const style = TYPE_STYLES[t.type] || TYPE_STYLES.welcome;
            return (
              <div key={t._id} className="card-premium p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-semibold text-foreground">
                        {t.name}
                      </h3>
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${style.bg} ${style.text}`}
                      >
                        {t.type}
                      </span>
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          t.active
                            ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {t.active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <p className="text-sm text-secondary-foreground mt-1">
                      Subject: {t.subject}
                    </p>
                    {t.variables.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Variables:{" "}
                        {t.variables.map((v) => `{{${v}}}`).join(", ")}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => openEdit(t)}
                      className="btn-secondary text-xs px-3 py-1.5"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(t._id)}
                      className="text-xs px-3 py-1.5 rounded-lg border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
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
