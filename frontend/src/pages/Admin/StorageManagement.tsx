import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import { adminAPI } from "../../utils/api";
import type { StorageStats } from "../../types";

export default function StorageManagement() {
  const [data, setData] = useState<StorageStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await adminAPI.getStorage();
      setData(result);
    } catch {
      toast.error("Failed to load storage data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const handleCleanup = () => {
    toast("Cleanup not yet implemented", { icon: "🔧" });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        Failed to load storage data.
      </div>
    );
  }

  const { stats, files, orphans } = data;

  const cloudinaryPct = stats.cloudinary && stats.cloudinary.storageLimit > 0
    ? Math.min(100, (stats.cloudinary.totalStorage / stats.cloudinary.storageLimit) * 100) : 0;

  return (
    <div className="fade-up space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Storage Management</h1>
          <p className="text-sm text-muted-foreground mt-1">Cloudinary usage, orphan detection, and file inventory.</p>
        </div>
        <button onClick={fetchData} className="btn-secondary text-sm">Refresh</button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Total files</p>
          <p className="text-3xl font-bold text-foreground mt-1">{stats.totalFiles}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Orphaned files</p>
          <p className={`text-3xl font-bold mt-1 ${stats.orphanedFiles > 0 ? "text-amber-600 dark:text-amber-400" : "text-foreground"}`}>{stats.orphanedFiles}</p>
          <p className="text-[11px] text-muted-foreground mt-1">{stats.orphanedFiles > 0 ? "Files in storage not referenced in DB" : "Storage and DB are in sync"}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Cloudinary storage</p>
          {stats.cloudinary ? (
            <div className="mt-1">
              <p className="text-xl font-bold text-foreground">
                {formatBytes(stats.cloudinary.totalStorage)} <span className="text-sm text-muted-foreground font-normal">of {formatBytes(stats.cloudinary.storageLimit)}</span>
              </p>
              <div className="mt-2 w-full h-2 bg-border rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${cloudinaryPct > 80 ? "bg-red-500" : cloudinaryPct > 60 ? "bg-amber-500" : "bg-primary"}`} style={{ width: `${cloudinaryPct}%` }} />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5">
                Bandwidth: {formatBytes(stats.cloudinary.bandwidth)} / {formatBytes(stats.cloudinary.bandwidthLimit)}
              </p>
            </div>
          ) : (
            <div className="mt-1">
              <p className="text-lg text-muted-foreground">—</p>
              <p className="text-[11px] text-muted-foreground mt-1">Cloudinary env vars not set. Files are tracked in DB only.</p>
            </div>
          )}
        </div>
      </div>

      {/* Files Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Files</h2>
          <span className="text-xs text-muted-foreground">{files.length} total</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted text-left text-muted-foreground">
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">User</th>
                <th className="px-5 py-3 font-medium">Target Role</th>
                <th className="px-5 py-3 font-medium">Upload Date</th>
                <th className="px-5 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {files.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-8 text-center text-muted-foreground"
                  >
                    No files found.
                  </td>
                </tr>
              ) : (
                files.map((file) => (
                  <tr
                    key={file._id}
                    className="hover:bg-muted"
                  >
                    <td className="px-5 py-3 text-foreground font-medium">
                      {file.name || file.fileName}
                    </td>
                    <td className="px-5 py-3 text-secondary-foreground">
                      {file.user?.name ?? "Unknown"}
                    </td>
                    <td className="px-5 py-3 text-secondary-foreground">
                      {file.targetRole}
                    </td>
                    <td className="px-5 py-3 text-secondary-foreground">
                      {new Date(file.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3">
                      {file.fileUrl ? (
                        <a
                          href={file.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary text-primary hover:underline text-sm"
                        >
                          View
                        </a>
                      ) : (
                        <span className="text-muted-foreground text-sm">No URL</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Orphans Section */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Orphaned files</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Files referenced in DB but not found in storage.</p>
          </div>
          {orphans.length > 0 && (
            <button onClick={handleCleanup} className="btn-accent text-sm">Cleanup orphans</button>
          )}
        </div>
        {orphans.length === 0 ? (
          <div className="px-5 py-8 text-center text-muted-foreground">
            No orphaned files found.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {orphans.map((orphan) => (
              <li
                key={orphan._id}
                className="px-5 py-3 flex items-center justify-between hover:bg-muted"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {orphan.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Public ID: {orphan.filePublicId} | User:{" "}
                    {orphan.user?.name ?? "Unknown"}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
