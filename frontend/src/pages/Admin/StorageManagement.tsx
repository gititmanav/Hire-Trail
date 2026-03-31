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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">
          Storage Management
        </h1>
        <button onClick={fetchData} className="btn-secondary text-sm">
          Refresh
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card-premium p-5">
          <p className="text-sm text-muted-foreground">
            Total Files
          </p>
          <p className="text-3xl font-bold text-foreground mt-1">
            {stats.totalFiles}
          </p>
        </div>
        <div className="card-premium p-5">
          <p className="text-sm text-muted-foreground">
            Orphaned Files
          </p>
          <p className="text-3xl font-bold text-orange-600 dark:text-orange-400 mt-1">
            {stats.orphanedFiles}
          </p>
        </div>
        <div className="card-premium p-5">
          <p className="text-sm text-muted-foreground">
            Cloudinary Storage
          </p>
          {stats.cloudinary ? (
            <div className="mt-1">
              <p className="text-xl font-bold text-foreground">
                {formatBytes(stats.cloudinary.totalStorage)} /{" "}
                {formatBytes(stats.cloudinary.storageLimit)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Bandwidth: {formatBytes(stats.cloudinary.bandwidth)} /{" "}
                {formatBytes(stats.cloudinary.bandwidthLimit)}
              </p>
            </div>
          ) : (
            <div className="mt-1">
              <p className="text-lg text-muted-foreground">
                —
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Cloudinary env vars not set. Files are tracked in DB only.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Files Table */}
      <div className="card-premium overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">
            Files ({files.length})
          </h2>
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
      <div className="card-premium overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            Orphaned Files ({orphans.length})
          </h2>
          {orphans.length > 0 && (
            <button onClick={handleCleanup} className="btn-accent text-sm">
              Cleanup Orphans
            </button>
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
