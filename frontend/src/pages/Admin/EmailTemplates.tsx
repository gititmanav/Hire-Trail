import { useState, useEffect, useCallback, useMemo } from "react";
import toast from "react-hot-toast";
import { adminAPI } from "../../utils/api";
import ConfirmModal from "../../components/ConfirmModal/ConfirmModal";
import { useConfirm } from "../../hooks/useConfirm";
import type { EmailTemplate } from "../../types";

const TYPE_STYLES: Record<string, { bg: string; text: string; ring: string }> = {
  welcome:  { bg: "bg-emerald-500/10", text: "text-emerald-700 dark:text-emerald-300", ring: "ring-emerald-500/30" },
  reset:    { bg: "bg-blue-500/10",    text: "text-blue-700 dark:text-blue-300",       ring: "ring-blue-500/30" },
  suspend:  { bg: "bg-red-500/10",     text: "text-red-700 dark:text-red-300",         ring: "ring-red-500/30" },
  reminder: { bg: "bg-amber-500/10",   text: "text-amber-700 dark:text-amber-300",     ring: "ring-amber-500/30" },
  digest:   { bg: "bg-purple-500/10",  text: "text-purple-700 dark:text-purple-300",   ring: "ring-purple-500/30" },
};

const ALL_TYPES = ["welcome", "reset", "suspend", "reminder", "digest"] as const;

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
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<EmailTemplate["type"] | "all">("all");
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

  useEffect(() => { fetchData(); }, [fetchData]);

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
    if (!form.name.trim()) { toast.error("Template name is required"); return; }
    if (!form.subject.trim()) { toast.error("Subject is required"); return; }
    setSubmitting(true);
    try {
      const variables = form.variables.split(",").map((v) => v.trim()).filter(Boolean);
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
      danger: true,
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

  const stats = useMemo(() => {
    const total = templates.length;
    const active = templates.filter((t) => t.active).length;
    const byType: Record<string, number> = {};
    for (const t of templates) byType[t.type] = (byType[t.type] || 0) + 1;
    return { total, active, byType };
  }, [templates]);

  const filtered = useMemo(() => {
    let list = templates;
    if (typeFilter !== "all") list = list.filter((t) => t.type === typeFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((t) => t.name.toLowerCase().includes(q) || t.subject.toLowerCase().includes(q));
    }
    return list;
  }, [templates, search, typeFilter]);

  return (
    <div className="fade-up">
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Email Templates</h1>
          <p className="text-sm text-muted-foreground mt-1">Reusable transactional emails. Variables use <code className="text-xs px-1 py-0.5 rounded bg-muted">{"{{variable}}"}</code> syntax.</p>
        </div>
        <button onClick={openCreate} className="btn-accent text-sm">+ New template</button>
      </div>

      {/* Notice */}
      <div className="mb-5 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 flex items-start gap-3">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0">
          <path d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-xs text-amber-700 dark:text-amber-300">Email sending isn't connected yet — templates created here will be used once the email integration ships.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Total</p>
          <p className="text-2xl font-bold text-foreground mt-1">{stats.total}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Active</p>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{stats.active}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 col-span-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">By type</p>
          <div className="flex flex-wrap gap-1.5">
            {ALL_TYPES.map((t) => {
              const c = stats.byType[t] || 0;
              const s = TYPE_STYLES[t];
              return (
                <span key={t} className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-medium rounded-full ${s.bg} ${s.text}`}>
                  {t} <span className="opacity-70">{c}</span>
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {/* Filter chips + search */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="inline-flex bg-muted rounded-lg p-1">
          <button
            onClick={() => setTypeFilter("all")}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${typeFilter === "all" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            All
          </button>
          {ALL_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors capitalize ${typeFilter === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              {t}
            </button>
          ))}
        </div>
        <input
          className="input-premium w-full max-w-xs"
          placeholder="Search name or subject..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground">
          {templates.length === 0 ? "No email templates yet — create your first one." : "No templates match these filters."}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {filtered.map((t) => {
            const style = TYPE_STYLES[t.type] || TYPE_STYLES.welcome;
            return (
              <div key={t._id} className="bg-card border border-border rounded-xl p-5 hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-semibold text-foreground truncate">{t.name}</h3>
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${style.bg} ${style.text}`}>{t.type}</span>
                      <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${t.active ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-muted text-muted-foreground"}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${t.active ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
                        {t.active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <p className="text-sm text-secondary-foreground mt-1 truncate" title={t.subject}>{t.subject}</p>
                    {t.variables.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {t.variables.map((v) => (
                          <span key={v} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{`{{${v}}}`}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0">
                    <button onClick={() => openEdit(t)} className="btn-secondary text-xs px-3 py-1">Edit</button>
                    <button
                      onClick={() => handleDelete(t._id)}
                      className="text-xs px-3 py-1 rounded-lg border border-destructive/40 text-destructive hover:bg-destructive/10"
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

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="card-premium w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <h2 className="text-lg font-semibold text-foreground">{editingId ? "Edit Template" : "Create Template"}</h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Name</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-premium w-full" placeholder="Template name" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Type</label>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as EmailTemplate["type"] })} className="input-premium w-full">
                  {ALL_TYPES.map((t) => <option key={t} value={t} className="capitalize">{t}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Subject</label>
              <input type="text" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="input-premium w-full" placeholder="Email subject line" />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Body (HTML)</label>
              <textarea value={form.bodyHtml} onChange={(e) => setForm({ ...form, bodyHtml: e.target.value })} rows={8} className="input-premium w-full font-mono text-sm" placeholder="<h1>Hello {{userName}}</h1><p>Welcome to {{appName}}!</p>" />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Variables (comma-separated)</label>
              <input type="text" value={form.variables} onChange={(e) => setForm({ ...form, variables: e.target.value })} className="input-premium w-full" placeholder="userName, appName, resetLink" />
            </div>

            <label className="flex items-center gap-2 text-sm text-foreground">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="rounded border-border" />
              Active
            </label>

            <div>
              <button onClick={() => setShowPreview(!showPreview)} className="btn-secondary text-xs">
                {showPreview ? "Hide preview" : "Show preview"}
              </button>
              {showPreview && (
                <div className="mt-3 border border-border rounded-lg overflow-hidden">
                  <div className="bg-muted px-4 py-2 border-b border-border">
                    <p className="text-xs text-muted-foreground">HTML preview (sample data substituted)</p>
                  </div>
                  <div className="p-4 bg-background prose dark:prose-invert max-w-none text-sm" dangerouslySetInnerHTML={{ __html: previewHtml }} />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={closeForm} className="btn-secondary text-sm">Cancel</button>
              <button onClick={handleSubmit} disabled={submitting} className="btn-accent text-sm">
                {submitting ? "Saving..." : editingId ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmState.open && <ConfirmModal title={confirmState.title} message={confirmState.message} confirmLabel={confirmState.confirmLabel} danger={confirmState.danger} onConfirm={handleConfirm} onCancel={handleCancel} />}
    </div>
  );
}
