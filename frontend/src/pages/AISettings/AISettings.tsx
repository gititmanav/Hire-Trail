/**
 * AI Settings — dedicated page (route /settings/ai).
 *
 * Sections (stacked cards, matching the Settings page idiom):
 *   • Status   — GET /ai/status: which provider AI requests resolve to.
 *   • Usage    — GET /ai/usage: BYOK → tokens + est $; default → 0–100% meter + reset.
 *   • Keys     — list w/ exactly-one-active toggle + type-DELETE removal.
 *   • Add key  — any provider via ActionDropdown, validate-on-add (AddKeyForm).
 *
 * Keys come from the shared useAIKeyStatus provider so the header badge / BYOK
 * warning clear the instant a key is activated here.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, KeyRound, Sparkles, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import ConfirmModal from "../../components/ConfirmModal/ConfirmModal.tsx";
import AiPulse from "../../components/AiIndicator/AiPulse.tsx";
import { Skeleton } from "../../components/Skeleton/Skeleton.tsx";
import { aiAPI } from "../../utils/api.ts";
import type { AIKey, AICatalogProvider, AIModel } from "../../utils/api.ts";
import { aiInsightsAPI, type AIStatus, type AIUsage, type UsageOp } from "../../utils/studioApi.ts";

/** Friendly labels for each metered operation. */
const OP_LABELS: Record<string, string> = {
  resume_parse: "Resume parsing",
  profile_merge: "Profile merge",
  jd_analysis: "Fit analysis",
  field_extract: "Field extraction",
  jd_clean: "JD cleanup",
  thread_classify: "Email classification",
  resume_rewrite: "Resume rewrite",
  other: "Other",
};

/** Human label for a provider id (catalog → title-cased fallback for unknowns). */
function labelFor(catalog: AICatalogProvider[], id: string): string {
  return catalog.find((p) => p.id === id)?.label ?? id.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
import { useAIKeyStatus } from "../../hooks/useAIKeyStatus.tsx";
import AddKeyForm from "./AddKeyForm.tsx";

function notImplemented(err: unknown): boolean {
  const e = err as { response?: { status?: number }; code?: string };
  const s = e?.response?.status;
  return s === 404 || s === 501 || e?.code === "ERR_NETWORK" || s === undefined;
}

/* ---------- Status card ---------- */

function StatusCard({ status, loading }: { status: (AIStatus & { mode: string }) | null; loading: boolean }) {
  const tone =
    !status ? "muted" :
    status.mode === "byok" ? "emerald" :
    status.mode === "default" ? "sky" : "amber";
  const toneCls = {
    emerald: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    sky: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
    amber: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    muted: "bg-muted text-muted-foreground",
  }[tone];
  return (
    <section className="bg-card border border-border rounded-xl p-5 sm:p-7">
      <h2 className="text-base font-semibold text-foreground mb-1">Status</h2>
      <p className="text-xs text-muted-foreground mb-4">Which provider your AI requests currently use.</p>
      {loading ? (
        <Skeleton className="h-16 w-full max-w-md" />
      ) : status ? (
        <div className="flex items-start gap-3 rounded-lg border border-border bg-background p-4 max-w-md">
          <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${toneCls}`}>
            <Sparkles size={18} strokeWidth={1.8} />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-foreground">
                {status.mode === "byok" ? "Your key" : status.mode === "default" ? "Shared provider" : "No provider"}
              </span>
              <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${toneCls}`}>
                {status.mode === "byok" ? "BYOK" : status.mode}
              </span>
              <span className={`inline-flex items-center gap-1 text-[11px] ${status.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${status.ok ? "bg-emerald-500" : "bg-red-500"}`} />
                {status.ok ? "Ready" : "Unavailable"}
              </span>
            </div>
            {(status.provider || status.model) && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {[status.provider, status.model].filter(Boolean).join(" · ")}
              </p>
            )}
            <p className="text-xs text-foreground/80 mt-1 leading-relaxed">{status.message}</p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Status unavailable.</p>
      )}
    </section>
  );
}

/* ---------- Usage card ---------- */

const fmtNum = (n: number) => n.toLocaleString();

function UsageCard({ usage, loading }: { usage: AIUsage | null; loading: boolean }) {
  return (
    <section className="bg-card border border-border rounded-xl p-5 sm:p-7">
      <h2 className="text-base font-semibold text-foreground mb-1">Usage</h2>
      <p className="text-xs text-muted-foreground mb-4">
        {usage?.mode === "byok"
          ? "Token usage billed to your own provider account."
          : "Your monthly allowance on the shared HireTrail provider."}
      </p>
      {loading ? (
        <Skeleton className="h-20 w-full max-w-md" />
      ) : !usage ? (
        <p className="text-sm text-muted-foreground">Usage unavailable.</p>
      ) : usage.mode === "byok" ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl">
            <Stat label="Input tokens" value={fmtNum(usage.tokens?.input ?? 0)} />
            <Stat label="Output tokens" value={fmtNum(usage.tokens?.output ?? 0)} />
            <Stat label="Est. cost" value={`$${(usage.estimatedCostUsd ?? 0).toFixed(2)}`} accent />
            <p className="sm:col-span-3 text-[11px] text-muted-foreground">
              {fmtNum(usage.tokens?.total ?? 0)} total tokens {usage.period ? `· ${usage.period}` : ""}. Estimated — your provider's dashboard is the source of truth.
            </p>
          </div>
          <UsageBreakdown byOp={usage.byOp} />
        </>
      ) : (
        <>
          <DefaultMeter usage={usage} />
          <UsageBreakdown byOp={usage.byOp} />
        </>
      )}
    </section>
  );
}

/** Per-operation token breakdown so the user sees exactly what consumed usage
 *  (parsing, fit analysis, rewrites, …) — updates as new LLM calls are metered. */
function UsageBreakdown({ byOp }: { byOp?: UsageOp[] }) {
  if (!byOp || byOp.length === 0) return null;
  const max = Math.max(...byOp.map((o) => o.tokens), 1);
  return (
    <div className="mt-5 max-w-2xl">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">By operation · this month</p>
      <ul className="space-y-2.5">
        {byOp.map((o) => (
          <li key={o.opType}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-foreground font-medium">{OP_LABELS[o.opType] ?? o.opType}</span>
              <span className="text-muted-foreground tabular-nums">
                {fmtNum(o.tokens)} tok · {o.calls} call{o.calls === 1 ? "" : "s"}{o.estCostUsd > 0 ? ` · $${o.estCostUsd.toFixed(4)}` : ""}
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-primary/60" style={{ width: `${Math.round((o.tokens / max) * 100)}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`text-lg font-bold tabular-nums mt-0.5 ${accent ? "text-primary" : "text-foreground"}`}>{value}</p>
    </div>
  );
}

function DefaultMeter({ usage }: { usage: AIUsage }) {
  const used = usage.used ?? 0;
  const limit = usage.limit ?? 100;
  const pct = Math.min(100, Math.round((used / Math.max(1, limit)) * 100));
  const tone = pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-primary";
  const resets = usage.resetsAt ? new Date(usage.resetsAt) : null;
  return (
    <div className="max-w-md">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-sm font-medium text-foreground tabular-nums">{fmtNum(used)} / {fmtNum(limit)} tokens</span>
        <span className="text-xs text-muted-foreground tabular-nums">{pct}%</span>
      </div>
      <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full transition-[width] duration-500 ${tone}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[11px] text-muted-foreground mt-2">
        {resets ? `Resets ${resets.toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : "Resets monthly"}
        {pct >= 90 ? " · Add your own key for unlimited usage." : ""}
      </p>
    </div>
  );
}

/* ---------- Key row ---------- */

function KeyRow({
  k, label, busy, onActivate, onDeactivate, onDelete,
}: {
  k: AIKey; label: string; busy: boolean;
  onActivate: () => void; onDeactivate: () => void; onDelete: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2.5 border border-border rounded-lg">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`w-2 h-2 rounded-full shrink-0 ${k.isActive ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
          <span className="text-sm font-medium text-foreground">{label}</span>
          {k.name && <span className="text-xs text-muted-foreground">· {k.name}</span>}
          {k.isActive && <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 px-1.5 py-0.5 rounded">Active</span>}
        </div>
        <div className="text-[11px] text-muted-foreground mt-0.5">
          {k.modelOverride ? `Model: ${k.modelOverride} · ` : ""}Added {new Date(k.createdAt).toLocaleDateString()}
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {k.isActive ? (
          <button onClick={onDeactivate} disabled={busy} className="px-2.5 py-1 text-xs font-medium border border-border rounded-md text-secondary-foreground hover:bg-muted disabled:opacity-50">
            Deactivate
          </button>
        ) : (
          <button onClick={onActivate} disabled={busy} className="px-2.5 py-1 text-xs font-medium border border-primary/40 text-primary rounded-md hover:bg-primary/10 disabled:opacity-50">
            Set active
          </button>
        )}
        <button onClick={onDelete} disabled={busy} className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium border border-border rounded-md text-red-500 hover:bg-destructive/10 disabled:opacity-50">
          <Trash2 size={13} strokeWidth={1.8} />Delete
        </button>
      </div>
    </div>
  );
}

/* ---------- Page ---------- */

export default function AISettings() {
  const { keys, hasActiveKey, refresh } = useAIKeyStatus();
  const [catalog, setCatalog] = useState<AICatalogProvider[]>([]);
  const [models, setModels] = useState<AIModel[]>([]);
  const [gatewayConfigured, setGatewayConfigured] = useState(false);
  const [status, setStatus] = useState<(AIStatus & { mode: string }) | null>(null);
  const [usage, setUsage] = useState<AIUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [insightsLoading, setInsightsLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AIKey | null>(null);

  // Full provider catalog + live model list (every gateway provider/model).
  useEffect(() => {
    Promise.all([aiAPI.getCatalog(), aiAPI.listModels().catch(() => ({ models: [], gatewayConfigured: false }))])
      .then(([cat, mods]) => {
        setCatalog(cat.providers);
        setGatewayConfigured(cat.gatewayConfigured);
        setModels(mods.models);
      })
      .catch(() => { /* AddKeyForm shows an empty provider list if this fails */ })
      .finally(() => setLoading(false));
  }, []);
  const labelOf = useCallback((id: string) => labelFor(catalog, id), [catalog]);

  // Status + usage depend on whether a key is active (the mock fallback needs it).
  const loadInsights = useCallback(async () => {
    setInsightsLoading(true);
    try {
      const [st, us] = await Promise.all([
        aiInsightsAPI.getStatus(hasActiveKey),
        aiInsightsAPI.getUsage(hasActiveKey),
      ]);
      setStatus(st as AIStatus & { mode: string });
      setUsage(us as AIUsage);
    } catch {
      setStatus(null); setUsage(null);
    } finally {
      setInsightsLoading(false);
    }
  }, [hasActiveKey]);
  useEffect(() => { void loadInsights(); }, [loadInsights]);

  // Live-refresh usage when the tab regains focus, so usage reflects AI work
  // done elsewhere (parsing, fit analysis, rewrites) without a manual reload.
  useEffect(() => {
    const onFocus = () => { if (document.visibilityState !== "hidden") void loadInsights(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => { window.removeEventListener("focus", onFocus); document.removeEventListener("visibilitychange", onFocus); };
  }, [loadInsights]);

  const activate = async (k: AIKey) => {
    setBusyId(k._id);
    try {
      try {
        await aiAPI.activateKey(k._id);
      } catch (err) {
        if (!notImplemented(err)) throw err;
        // Fallback while the dedicated activate endpoint isn't live: enforce
        // exactly-one-active manually via updateKey.
        await Promise.all(keys.filter((x) => x.isActive && x._id !== k._id).map((x) => aiAPI.updateKey(x._id, { isActive: false })));
        await aiAPI.updateKey(k._id, { isActive: true });
      }
      toast.success(`${labelOf(k.provider)} key activated`);
      await refresh();
    } catch {
      toast.error("Failed to activate key");
    } finally {
      setBusyId(null);
    }
  };

  const deactivate = async (k: AIKey) => {
    setBusyId(k._id);
    try {
      await aiAPI.updateKey(k._id, { isActive: false });
      await refresh();
    } catch {
      toast.error("Failed to deactivate key");
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const k = pendingDelete;
    setBusyId(k._id);
    setPendingDelete(null);
    try {
      await aiAPI.deleteKey(k._id);
      toast.success("Key removed");
      await refresh();
    } catch {
      toast.error("Failed to remove key");
    } finally {
      setBusyId(null);
    }
  };

  const sortedKeys = useMemo(
    () => [...keys].sort((a, b) => (a.isActive === b.isActive ? 0 : a.isActive ? -1 : 1)),
    [keys],
  );

  return (
    <div className="max-w-4xl mx-auto fade-up">
      <div className="mb-5">
        <Link to="/settings" className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground mb-2">
          <ArrowLeft size={13} strokeWidth={2} /> Back to Settings
        </Link>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold text-foreground">AI Providers</h1>
          <span className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-primary/10 text-primary">BYOK</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Bring your own API key for resume parsing, tailoring, and rewrites. Keys are encrypted at rest. Exactly one key is active at a time; with no key, HireTrail falls back to a limited shared provider.
        </p>
      </div>

      <div className="space-y-5">
        <StatusCard status={status} loading={insightsLoading} />
        <UsageCard usage={usage} loading={insightsLoading} />

        {/* Keys */}
        <section className="bg-card border border-border rounded-xl p-5 sm:p-7">
          <div className="flex items-center gap-2 mb-1">
            <KeyRound size={16} strokeWidth={1.8} className="text-muted-foreground" />
            <h2 className="text-base font-semibold text-foreground">Your keys</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-4">Activate one key to route all AI requests through it.</p>

          {loading ? (
            <div className="space-y-2">{[1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : sortedKeys.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-8 text-center">
              <AiPulse size={20} />
              <p className="text-sm font-medium text-foreground mt-2">No keys yet</p>
              <p className="text-xs text-muted-foreground mt-1">Add one below — a free Gemini key takes about 30 seconds.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {!hasActiveKey && (
                <div className="rounded-lg border border-amber-300/60 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/20 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
                  No key is active — AI features use the limited shared provider. Set one active below.
                </div>
              )}
              {sortedKeys.map((k) => (
                <KeyRow
                  key={k._id}
                  k={k}
                  label={labelOf(k.provider)}
                  busy={busyId === k._id}
                  onActivate={() => activate(k)}
                  onDeactivate={() => deactivate(k)}
                  onDelete={() => setPendingDelete(k)}
                />
              ))}
            </div>
          )}
        </section>

        {/* Add key */}
        <section className="bg-card border border-border rounded-xl p-5 sm:p-7">
          <h2 className="text-base font-semibold text-foreground mb-1">Add a key</h2>
          <p className="text-xs text-muted-foreground mb-4">Pick a provider, paste the key — we validate it before saving.</p>
          <AddKeyForm
            catalog={catalog}
            models={models}
            gatewayConfigured={gatewayConfigured}
            onAdded={async () => { await refresh(); await loadInsights(); }}
          />
        </section>
      </div>

      {pendingDelete && (
        <ConfirmModal
          title="Delete this API key?"
          message={`Remove the ${labelOf(pendingDelete.provider)} key${pendingDelete.name ? ` (${pendingDelete.name})` : ""}? This can't be undone.`}
          confirmLabel="Delete key"
          requireType="DELETE"
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}
