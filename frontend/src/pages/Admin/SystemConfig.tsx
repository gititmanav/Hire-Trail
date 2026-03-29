import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import { adminAPI } from "../../utils/api";
import type { SystemSetting } from "../../types";

const CATEGORY_LABELS: Record<string, string> = {
  general: "General",
  limits: "Limits",
  features: "Features",
  session: "Session",
  storage: "Storage",
};

function SettingRow({
  setting,
  onSave,
}: {
  setting: SystemSetting;
  onSave: (key: string, value: unknown) => Promise<void>;
}) {
  const [value, setValue] = useState<unknown>(setting.value);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(setting.value);
  }, [setting.value]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(setting.key, value);
    } finally {
      setSaving(false);
    }
  };

  const isMaintenanceMode = setting.key === "maintenance_mode";

  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3 ${
        isMaintenanceMode ? "" : "border-b border-gray-100 dark:border-gray-700/50 last:border-0"
      }`}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-white">
          {setting.key}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          {setting.description}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {setting.valueType === "boolean" ? (
          <button
            onClick={() => {
              const next = !value;
              setValue(next);
              setSaving(true);
              onSave(setting.key, next).finally(() => setSaving(false));
            }}
            disabled={saving}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-accent/40 ${
              value
                ? "bg-accent"
                : "bg-gray-300 dark:bg-gray-600"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full shadow-sm transition-transform ${
                value ? "translate-x-6 bg-white" : "translate-x-1 bg-white dark:bg-gray-300"
              }`}
            />
          </button>
        ) : setting.valueType === "number" ? (
          <>
            <input
              type="number"
              value={String(value ?? "")}
              onChange={(e) => setValue(Number(e.target.value))}
              className="input-premium w-28 text-sm"
            />
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-accent text-xs px-3 py-1.5"
            >
              {saving ? "..." : "Save"}
            </button>
          </>
        ) : (
          <>
            <input
              type="text"
              value={String(value ?? "")}
              onChange={(e) => setValue(e.target.value)}
              className="input-premium w-48 text-sm"
            />
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-accent text-xs px-3 py-1.5"
            >
              {saving ? "..." : "Save"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function SystemConfig() {
  const [grouped, setGrouped] = useState<Record<string, SystemSetting[]>>({});
  const [allSettings, setAllSettings] = useState<SystemSetting[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await adminAPI.getSettings();
      setGrouped(result.grouped);
      setAllSettings(result.settings);
    } catch {
      toast.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSave = useCallback(
    async (key: string, value: unknown) => {
      try {
        await adminAPI.updateSetting(key, value);
        toast.success(`Setting "${key}" updated`);
        // Update local state
        setAllSettings((prev) =>
          prev.map((s) => (s.key === key ? { ...s, value } : s))
        );
        setGrouped((prev) => {
          const next: Record<string, SystemSetting[]> = {};
          for (const [cat, settings] of Object.entries(prev)) {
            next[cat] = settings.map((s) =>
              s.key === key ? { ...s, value } : s
            );
          }
          return next;
        });
      } catch {
        toast.error(`Failed to update "${key}"`);
      }
    },
    []
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
      </div>
    );
  }

  // Find maintenance mode setting
  const maintenanceSetting = allSettings.find(
    (s) => s.key === "maintenance_mode"
  );

  const categoryOrder = ["general", "limits", "features", "session", "storage"];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
        System Configuration
      </h1>

      {/* Maintenance Mode Banner */}
      {maintenanceSetting && (
        <div
          className={`card-premium p-5 border-2 ${
            maintenanceSetting.value
              ? "border-red-500 bg-red-50 dark:bg-red-900/20"
              : "border-gray-200 dark:border-gray-700"
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-red-700 dark:text-red-400">
                Maintenance Mode
              </h2>
              <p className="text-sm text-red-600 dark:text-red-300 mt-0.5">
                {maintenanceSetting.value
                  ? "The application is currently in maintenance mode. Users cannot access the platform."
                  : "Maintenance mode is off. The platform is accessible to all users."}
              </p>
            </div>
            <SettingRow setting={maintenanceSetting} onSave={handleSave} />
          </div>
        </div>
      )}

      {/* Grouped Settings */}
      {categoryOrder.map((cat) => {
        const settings = grouped[cat];
        if (!settings || settings.length === 0) return null;
        // Filter out maintenance mode from general group since it's displayed above
        const filtered = settings.filter((s) => s.key !== "maintenance_mode");
        if (filtered.length === 0) return null;

        return (
          <div key={cat} className="card-premium p-5">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 capitalize">
              {CATEGORY_LABELS[cat] || cat}
            </h2>
            <div className="space-y-0">
              {filtered.map((setting) => (
                <SettingRow
                  key={setting._id}
                  setting={setting}
                  onSave={handleSave}
                />
              ))}
            </div>
          </div>
        );
      })}

      {/* Any categories not in the predefined order */}
      {Object.entries(grouped)
        .filter(([cat]) => !categoryOrder.includes(cat))
        .map(([cat, settings]) => {
          if (!settings || settings.length === 0) return null;
          return (
            <div key={cat} className="card-premium p-5">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 capitalize">
                {CATEGORY_LABELS[cat] || cat}
              </h2>
              <div className="space-y-0">
                {settings.map((setting) => (
                  <SettingRow
                    key={setting._id}
                    setting={setting}
                    onSave={handleSave}
                  />
                ))}
              </div>
            </div>
          );
        })}
    </div>
  );
}
