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
        isMaintenanceMode ? "" : "border-b border-border/50 last:border-0"
      }`}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">
          {setting.key}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
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
            className={`relative inline-flex h-6 w-11 items-center rounded-full focus:outline-none focus:ring-2 focus:ring-ring/40 ${
              value
                ? "bg-primary"
                : "bg-muted-foreground/30"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full shadow-sm transition-transform ${
                value ? "translate-x-6 bg-white" : "translate-x-1 bg-white"
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // Find maintenance mode setting
  const maintenanceSetting = allSettings.find(
    (s) => s.key === "maintenance_mode"
  );

  const categoryOrder = ["general", "limits", "features", "session", "storage"];

  return (
    <div className="fade-up space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">System Configuration</h1>
        <p className="text-sm text-muted-foreground mt-1">Platform-wide feature flags, limits, and operational settings.</p>
      </div>

      {/* Maintenance Mode Banner */}
      {maintenanceSetting && (
        <div className={`rounded-xl border p-5 ${maintenanceSetting.value ? "border-red-500/40 bg-red-500/5" : "border-border bg-card"}`}>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${maintenanceSetting.value ? "bg-red-500/15 text-red-600 dark:text-red-400" : "bg-muted text-muted-foreground"}`}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
                </svg>
              </div>
              <div>
                <h2 className={`text-lg font-semibold ${maintenanceSetting.value ? "text-red-700 dark:text-red-300" : "text-foreground"}`}>Maintenance mode</h2>
                <p className={`text-sm mt-0.5 ${maintenanceSetting.value ? "text-red-600 dark:text-red-300/90" : "text-muted-foreground"}`}>
                  {maintenanceSetting.value
                    ? "The platform is in maintenance mode. Non-admin users cannot access it."
                    : "Maintenance mode is off. The platform is accessible to all users."}
                </p>
              </div>
            </div>
            <SettingRow setting={maintenanceSetting} onSave={handleSave} />
          </div>
        </div>
      )}

      {/* Grouped Settings */}
      {categoryOrder.map((cat) => {
        const settings = grouped[cat];
        if (!settings || settings.length === 0) return null;
        const filtered = settings.filter((s) => s.key !== "maintenance_mode");
        if (filtered.length === 0) return null;

        return (
          <div key={cat} className="bg-card border border-border rounded-xl p-5">
            <h2 className="text-base font-semibold text-foreground mb-2 uppercase tracking-wider text-muted-foreground">
              {CATEGORY_LABELS[cat] || cat}
            </h2>
            <div className="space-y-0">
              {filtered.map((setting) => (
                <SettingRow key={setting._id} setting={setting} onSave={handleSave} />
              ))}
            </div>
          </div>
        );
      })}

      {Object.entries(grouped)
        .filter(([cat]) => !categoryOrder.includes(cat))
        .map(([cat, settings]) => {
          if (!settings || settings.length === 0) return null;
          return (
            <div key={cat} className="bg-card border border-border rounded-xl p-5">
              <h2 className="text-base font-semibold mb-2 uppercase tracking-wider text-muted-foreground">{CATEGORY_LABELS[cat] || cat}</h2>
              <div className="space-y-0">
                {settings.map((setting) => (
                  <SettingRow key={setting._id} setting={setting} onSave={handleSave} />
                ))}
              </div>
            </div>
          );
        })}
    </div>
  );
}
