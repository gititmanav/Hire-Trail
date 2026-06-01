import { useState, useCallback } from "react";
import { Loader2, AlertCircle, Database, User } from "lucide-react";
import toast from "react-hot-toast";
import { adminAPI } from "../../utils/api";

export default function BackupManagement() {
  const [exportingFull, setExportingFull] = useState(false);
  const [exportingUser, setExportingUser] = useState(false);
  const [userIdOrEmail, setUserIdOrEmail] = useState("");

  const triggerDownload = useCallback((blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  const handleFullExport = async () => {
    setExportingFull(true);
    try {
      const blob = await adminAPI.exportBackup();
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      triggerDownload(blob, `hiretrail-backup-${timestamp}.json`);
      toast.success("Full backup exported successfully");
    } catch {
      toast.error("Failed to export backup");
    } finally {
      setExportingFull(false);
    }
  };

  const handleUserExport = async () => {
    const id = userIdOrEmail.trim();
    if (!id) {
      toast.error("Please enter a user ID or email");
      return;
    }
    setExportingUser(true);
    try {
      const blob = await adminAPI.exportUserData(id);
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      triggerDownload(blob, `user-data-${id}-${timestamp}.json`);
      toast.success("User data exported successfully");
    } catch {
      toast.error("Failed to export user data");
    } finally {
      setExportingUser(false);
    }
  };

  const Spinner = () => <Loader2 className="animate-spin h-4 w-4" />;

  return (
    <div className="fade-up space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Backup Management</h1>
        <p className="text-sm text-muted-foreground mt-1">Export the full database or per-user data as JSON for archival and GDPR portability.</p>
      </div>

      {/* Notice */}
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 flex items-start gap-3">
        <AlertCircle width={18} height={18} strokeWidth={2} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium text-amber-700 dark:text-amber-300">Backups can be large</p>
          <p className="text-xs text-amber-700 dark:text-amber-300/80 mt-0.5">
            Full exports include users, applications, resumes, contacts, deadlines, master profiles, tailor sessions, feedback, and audit logs. Ensure you have bandwidth before downloading.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Full Database Export */}
        <div className="bg-card border border-border rounded-xl p-6 flex flex-col">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Database width={18} height={18} strokeWidth={2} />
            </div>
            <h2 className="text-lg font-semibold text-foreground">Full database export</h2>
          </div>
          <p className="text-sm text-secondary-foreground mb-5 flex-1">
            Export the entire database as a JSON file. Suitable for disaster recovery, migration, or archival.
          </p>
          <button
            className="btn-accent self-start inline-flex items-center gap-2"
            onClick={handleFullExport}
            disabled={exportingFull}
          >
            {exportingFull ? <><Spinner /> Exporting...</> : "Export full backup"}
          </button>
        </div>

        {/* Single User Data Export */}
        <div className="bg-card border border-border rounded-xl p-6 flex flex-col">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <User width={18} height={18} strokeWidth={2} />
            </div>
            <h2 className="text-lg font-semibold text-foreground">Single user export</h2>
          </div>
          <p className="text-sm text-secondary-foreground mb-4">
            Export every record belonging to one user. Useful for GDPR data portability.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              className="input-premium flex-1"
              placeholder="User ID or email address"
              value={userIdOrEmail}
              onChange={(e) => setUserIdOrEmail(e.target.value)}
            />
            <button
              className="btn-accent whitespace-nowrap inline-flex items-center gap-2"
              onClick={handleUserExport}
              disabled={exportingUser}
            >
              {exportingUser ? <><Spinner /> Exporting...</> : "Export user data"}
            </button>
          </div>
        </div>
      </div>

      {/* Backup History placeholder */}
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold text-foreground">Backup history</h2>
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300">Planned</span>
        </div>
        <p className="text-sm text-muted-foreground">
          Server-side scheduled backups and download history aren't enabled yet. For now, exports run on-demand and stream directly to your browser.
        </p>
      </div>
    </div>
  );
}
