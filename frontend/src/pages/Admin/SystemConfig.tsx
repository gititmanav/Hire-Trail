/** Admin → Settings. Only switches the product actually reads: maintenance
 *  mode and the feature flags (the list is DEFAULT_SETTINGS on the server) —
 *  plus resetting the demo account. AI lives in Admin → AI. */
import { useState, useEffect } from "react";
import toast from "../../components/ui/toast.ts";
import { adminAPI } from "../../utils/api";
import PageHeader from "../../components/ui/PageHeader.tsx";
import Toggle from "../../components/ui/Toggle.tsx";
import Button from "../../components/ui/Button.tsx";
import { Skeleton } from "../../components/Skeleton/Skeleton.tsx";
import ConfirmModal from "../../components/ConfirmModal/ConfirmModal";
import { useConfirm } from "../../hooks/useConfirm";
import { SettingsCard, SettingsRow, SettingsSection } from "../Settings/ui.tsx";
import type { SystemSetting } from "../../types";

const MAINTENANCE_KEY = "maintenance_mode";

/** What each flag hides when it's off (hooks/useFeatureFlags readers). */
const FEATURE_COPY: Record<string, { title: string; description: string }> = {
  feature_kanban: { title: "Board view", description: "The Board view on Applications." },
  feature_job_search: { title: "Job search", description: "The Jobs page and its sidebar link." },
  feature_csv_import_export: { title: "Import / Export", description: "The CSV Import / Export page and its sidebar link." },
};

export default function SystemConfig() {
  const [settings, setSettings] = useState<SystemSetting[] | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const { confirm, confirmState, handleConfirm, handleCancel } = useConfirm();

  useEffect(() => {
    adminAPI.getSettings()
      .then((r) => setSettings(r.settings))
      .catch(() => setSettings([]));
  }, []);

  // Read the way the server does (Boolean(value)), so the switch shows what's in force.
  const valueOf = (key: string) => Boolean(settings?.find((s) => s.key === key)?.value);

  const patch = (key: string, value: boolean) =>
    setSettings((prev) => prev && prev.map((s) => (s.key === key ? { ...s, value } : s)));

  /** Optimistic: the switch moves now and moves back if the save fails
   *  (the interceptor says why). */
  const save = async (key: string, value: boolean, done: string) => {
    patch(key, value);
    setSaving(key);
    try {
      await adminAPI.updateSetting(key, value);
      toast.success(done);
    } catch {
      patch(key, !value);
    } finally {
      setSaving(null);
    }
  };

  const setMaintenance = async (on: boolean) => {
    if (on) {
      const ok = await confirm(
        "Everyone who isn't an admin is signed out and can't sign in until you turn it off. Admins keep full access.",
        { title: "Turn on maintenance mode?", confirmLabel: "Turn on" },
      );
      if (!ok) return;
    }
    void save(MAINTENANCE_KEY, on, on ? "Maintenance mode is on" : "Maintenance mode is off");
  };

  const resetDemo = async () => {
    const ok = await confirm(
      "The demo's applications, contacts, deadlines and resumes are replaced with a fresh set dated around today. Anyone using the demo right now is signed out.",
      { title: "Reset the demo account?", confirmLabel: "Reset demo", danger: false },
    );
    if (!ok) return;
    setResetting(true);
    try {
      const r = await adminAPI.resetDemo();
      toast.success(`Demo reset — ${r.applications.toLocaleString()} applications, ${r.contacts.toLocaleString()} contacts, ${r.deadlines.toLocaleString()} deadlines`);
    } catch { /* the interceptor toasts */ } finally {
      setResetting(false);
    }
  };

  const features = (settings ?? []).filter((s) => s.key.startsWith("feature_"));
  const maintenanceOn = valueOf(MAINTENANCE_KEY);

  return (
    <div>
      <PageHeader title="Settings" />

      <div className="max-w-3xl">
        {!settings ? (
          <div className="space-y-6" aria-busy>
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-48 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </div>
        ) : (
          <>
            {settings.some((s) => s.key === MAINTENANCE_KEY) && (
              <SettingsSection title="Maintenance">
                <SettingsCard>
                  <SettingsRow
                    title={
                      <span className="inline-flex items-center gap-2">
                        Maintenance mode
                        {maintenanceOn && (
                          <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-red-600 dark:text-red-400">
                            <span aria-hidden className="w-1.5 h-1.5 rounded-full bg-red-500" />On
                          </span>
                        )}
                      </span>
                    }
                    description={
                      maintenanceOn
                        ? "Only admins can use HireTrail right now. Everyone else sees a maintenance message until you turn this off."
                        : "Signs everyone but admins out and shows a maintenance message. Admins keep full access, so you can always turn it back off."
                    }
                  >
                    <Toggle label="Maintenance mode" checked={maintenanceOn} disabled={saving === MAINTENANCE_KEY} onChange={setMaintenance} />
                  </SettingsRow>
                </SettingsCard>
              </SettingsSection>
            )}

            {features.length > 0 && (
              <SettingsSection title="Features" description="Turning one off hides it for everyone. Nothing is deleted, and turning it back on brings it back as it was.">
                <SettingsCard>
                  {features.map((s) => {
                    const copy = FEATURE_COPY[s.key] ?? { title: s.key, description: s.description };
                    const on = Boolean(s.value);
                    return (
                      <SettingsRow key={s.key} title={copy.title} description={copy.description}>
                        <Toggle
                          label={copy.title}
                          checked={on}
                          disabled={saving === s.key}
                          onChange={(next) => void save(s.key, next, `${copy.title} is ${next ? "on" : "off"}`)}
                        />
                      </SettingsRow>
                    );
                  })}
                </SettingsCard>
              </SettingsSection>
            )}

            <SettingsSection title="Demo account">
              <SettingsCard>
                <SettingsRow
                  title="Reset the demo account"
                  description="Gives demo@hiretrail.com — what “Try the demo” opens — a fresh set of applications, contacts and deadlines dated around today."
                >
                  <Button size="sm" onClick={resetDemo} loading={resetting}>Reset demo</Button>
                </SettingsRow>
              </SettingsCard>
            </SettingsSection>
          </>
        )}
      </div>

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
