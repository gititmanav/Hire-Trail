import { useState, useEffect, useCallback, useRef } from "react";
import toast from "react-hot-toast";
import { adminAPI } from "../../utils/api";
import type { PerformanceMetrics } from "../../types";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(2)} ${units[i]}`;
}

export default function PerformanceMonitor() {
  const [data, setData] = useState<PerformanceMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchPerformance = useCallback(() => {
    adminAPI
      .getPerformance()
      .then(setData)
      .catch(() => toast.error("Failed to load performance data"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchPerformance();
  }, [fetchPerformance]);

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(fetchPerformance, 30000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefresh, fetchPerformance]);

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card-premium animate-pulse h-28 rounded-lg" />
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card-premium animate-pulse h-28 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { server, database } = data;
  const heapPercent = server.memory.heapTotalMB > 0
    ? Math.round((server.memory.heapUsedMB / server.memory.heapTotalMB) * 100)
    : 0;

  const dbStatusClass =
    database.status === "connected"
      ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
      : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Performance Monitor</h1>
        <div className="flex items-center gap-3">
          <button
            className="btn-secondary text-sm"
            onClick={fetchPerformance}
          >
            Refresh
          </button>
          <button
            className={`text-sm px-3 py-1.5 rounded-lg font-medium transition-colors ${
              autoRefresh
                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
                : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
            }`}
            onClick={() => setAutoRefresh((prev) => !prev)}
          >
            Auto-Refresh: {autoRefresh ? "ON" : "OFF"}
          </button>
        </div>
      </div>

      {/* Server Info Cards */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Server</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card-premium p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Uptime</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{server.uptimeFormatted}</p>
          </div>
          <div className="card-premium p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Memory Usage</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">
              {server.memory.heapUsedMB.toFixed(1)} / {server.memory.heapTotalMB.toFixed(1)} MB
            </p>
            <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  heapPercent > 80 ? "bg-red-500" : heapPercent > 60 ? "bg-yellow-500" : "bg-green-500"
                }`}
                style={{ width: `${heapPercent}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {heapPercent}% used &middot; RSS: {server.memory.rssMB.toFixed(1)} MB
            </p>
          </div>
          <div className="card-premium p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Node Version</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{server.nodeVersion}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{server.platform}</p>
          </div>
          <div className="card-premium p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Process ID</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{server.pid}</p>
          </div>
        </div>
      </div>

      {/* Database Stats Cards */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Database</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="card-premium p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Status</p>
            <span className={`inline-block mt-2 text-xs font-medium px-2.5 py-1 rounded-full ${dbStatusClass}`}>
              {database.status}
            </span>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 truncate" title={database.host}>
              {database.host}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{database.name}</p>
          </div>
          {database.stats ? (
            <>
              <div className="card-premium p-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">Collections</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">
                  {database.stats.collections}
                </p>
              </div>
              <div className="card-premium p-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">Data Size</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">
                  {formatBytes(database.stats.dataSize)}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Storage: {formatBytes(database.stats.storageSize)}
                </p>
              </div>
              <div className="card-premium p-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">Index Size</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">
                  {formatBytes(database.stats.indexSize)}
                </p>
              </div>
              <div className="card-premium p-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Objects</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">
                  {database.stats.objects.toLocaleString()}
                </p>
              </div>
            </>
          ) : (
            <div className="card-premium p-4 col-span-4">
              <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                Database stats unavailable.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
