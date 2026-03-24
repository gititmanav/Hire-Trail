import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import { adminAPI } from "../../utils/api";
import type { IntegrationStatusItem } from "../../types";

const STATUS_STYLES: Record<
  string,
  { bg: string; text: string; dot: string; label: string }
> = {
  connected: {
    bg: "bg-green-100 dark:bg-green-900/30",
    text: "text-green-700 dark:text-green-400",
    dot: "bg-green-500",
    label: "Connected",
  },
  disconnected: {
    bg: "bg-red-100 dark:bg-red-900/30",
    text: "text-red-700 dark:text-red-400",
    dot: "bg-red-500",
    label: "Disconnected",
  },
  error: {
    bg: "bg-yellow-100 dark:bg-yellow-900/30",
    text: "text-yellow-700 dark:text-yellow-400",
    dot: "bg-yellow-500",
    label: "Error",
  },
};

export default function IntegrationStatus() {
  const [integrations, setIntegrations] = useState<IntegrationStatusItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await adminAPI.getIntegrations();
      setIntegrations(result.integrations);
    } catch {
      toast.error("Failed to load integrations");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Integration Status
        </h1>
        <button onClick={fetchData} className="btn-secondary text-sm">
          Refresh
        </button>
      </div>

      {integrations.length === 0 ? (
        <div className="card-premium p-10 text-center text-gray-400 dark:text-gray-500">
          No integrations found.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {integrations.map((integration) => {
            const style = STATUS_STYLES[integration.status] || STATUS_STYLES.error;
            return (
              <div key={integration.key} className="card-premium p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                      {integration.name}
                    </h3>
                    <span className="inline-block mt-1 text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                      {integration.category}
                    </span>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${style.bg} ${style.text}`}
                  >
                    <span className={`w-2 h-2 rounded-full ${style.dot}`} />
                    {style.label}
                  </span>
                </div>
                {integration.details && (
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    {integration.details}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
