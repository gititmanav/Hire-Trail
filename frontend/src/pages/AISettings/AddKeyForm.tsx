/** Add a BYOK key for ANY gateway provider — an AWS-Bedrock-style picker:
 *  a branded PROVIDER pane on the left and a searchable, grouped MODEL pane on
 *  the right. Credential inputs adapt to the provider's shape (single key,
 *  Bedrock/Azure fields, or a JSON blob). The assembled credential + the CHOSEN
 *  model are validated through the gateway before save, and the chosen model is
 *  persisted as the key's modelOverride (so we run exactly what was picked —
 *  there is no model-specific provider key; the model is sent per call). */
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ExternalLink, Lock, Search, Sparkles, X } from "lucide-react";
import toast from "react-hot-toast";
import { aiAPI } from "../../utils/api.ts";
import type { AICatalogProvider, AIModel } from "../../utils/api.ts";
import { useDemoGate } from "../../hooks/useDemoGate.tsx";

type ValidationState =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "ok"; model?: string }
  | { state: "invalid"; reason: string };

const inputCls =
  "w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring";

/** Brand color per provider (and per Bedrock-hosted maker). Used for the chip —
 *  a colored rounded square with the initial. No image assets / deps. */
const BRAND: Record<string, { bg: string; fg: string }> = {
  anthropic: { bg: "#D4A27F", fg: "#1a1a1a" },
  openai: { bg: "#0a0a0a", fg: "#ffffff" },
  google: { bg: "#4285F4", fg: "#ffffff" },
  bedrock: { bg: "#FF9900", fg: "#1a1a1a" },
  amazon: { bg: "#FF9900", fg: "#1a1a1a" },
  meta: { bg: "#0668E1", fg: "#ffffff" },
  mistral: { bg: "#FA520F", fg: "#ffffff" },
  cohere: { bg: "#39594D", fg: "#ffffff" },
  deepseek: { bg: "#4D6BFE", fg: "#ffffff" },
  xai: { bg: "#111111", fg: "#ffffff" },
  groq: { bg: "#F55036", fg: "#ffffff" },
  perplexity: { bg: "#20808D", fg: "#ffffff" },
  openrouter: { bg: "#6467F2", fg: "#ffffff" },
  azure: { bg: "#0078D4", fg: "#ffffff" },
  vertex: { bg: "#4285F4", fg: "#ffffff" },
  ai21: { bg: "#E4002B", fg: "#ffffff" },
  minimax: { bg: "#E03997", fg: "#ffffff" },
  moonshot: { bg: "#16161a", fg: "#ffffff" },
};
function brandFor(id: string): { bg: string; fg: string } {
  return BRAND[id.toLowerCase()] ?? { bg: "#64748b", fg: "#ffffff" };
}
function BrandChip({ id, size = 22 }: { id: string; size?: number }) {
  const b = brandFor(id);
  return (
    <span
      className="inline-flex items-center justify-center rounded-md font-bold shrink-0"
      style={{ width: size, height: size, background: b.bg, color: b.fg, fontSize: size * 0.5 }}
      aria-hidden
    >
      {(id[0] ?? "?").toUpperCase()}
    </span>
  );
}

/** Group key for a model within its provider. For Bedrock-style ids
 *  ("bedrock/anthropic.claude-…") the maker is the segment after the slash,
 *  before the dot → nice "Anthropic / Meta / Amazon" grouping. Otherwise "". */
function modelMaker(providerId: string, modelId: string): string {
  const rest = modelId.startsWith(`${providerId}/`) ? modelId.slice(providerId.length + 1) : modelId;
  const dot = rest.indexOf(".");
  if (dot > 1 && dot < 24) return rest.slice(0, dot).toLowerCase();
  return "";
}

export default function AddKeyForm({
  catalog,
  models,
  gatewayConfigured,
  onAdded,
}: {
  catalog: AICatalogProvider[];
  models: AIModel[];
  gatewayConfigured: boolean;
  onAdded: () => void | Promise<void>;
}) {
  const { requireRealAccount } = useDemoGate();
  const [providerId, setProviderId] = useState<string>(catalog[0]?.id ?? "google");
  const [providerSearch, setProviderSearch] = useState("");
  const [modelSearch, setModelSearch] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [jsonText, setJsonText] = useState("");
  const [name, setName] = useState("");
  const [modelOverride, setModelOverride] = useState(""); // "" = provider default
  const [saving, setSaving] = useState(false);
  const [validation, setValidation] = useState<ValidationState>({ state: "idle" });
  const validationSeq = useRef(0);

  const sel = useMemo(() => catalog.find((p) => p.id === providerId), [catalog, providerId]);
  const format = sel?.credentialFormat ?? "apiKey";
  const blocked = Boolean(sel?.gatewayOnly && !gatewayConfigured);

  const filteredProviders = useMemo(() => {
    const q = providerSearch.trim().toLowerCase();
    const list = q ? catalog.filter((p) => p.label.toLowerCase().includes(q) || p.id.toLowerCase().includes(q)) : catalog;
    return list;
  }, [catalog, providerSearch]);

  // Models for the chosen provider: prefer the live gateway list, fall back to catalog.
  const providerModels = useMemo(() => {
    const live = models.filter((m) => m.provider === providerId);
    const base = live.length
      ? live.map((m) => ({ id: m.id, label: m.label, ctx: m.contextWindow }))
      : (sel?.models ?? []).map((m) => ({ id: m.id, label: m.label, ctx: null as number | null }));
    const q = modelSearch.trim().toLowerCase();
    return q ? base.filter((m) => m.label.toLowerCase().includes(q) || m.id.toLowerCase().includes(q)) : base;
  }, [models, providerId, sel, modelSearch]);

  // Group the model list by maker (Bedrock → Anthropic/Meta/Amazon…) when ids carry one.
  const modelGroups = useMemo(() => {
    const groups = new Map<string, { id: string; label: string; ctx: number | null }[]>();
    for (const m of providerModels) {
      const maker = modelMaker(providerId, m.id);
      const key = maker || "__flat__";
      (groups.get(key) ?? groups.set(key, []).get(key)!).push(m);
    }
    return [...groups.entries()].sort((a, b) => (a[0] === "__flat__" ? -1 : a[0].localeCompare(b[0])));
  }, [providerModels, providerId]);

  const defaultModel = sel?.models.find((m) => m.capability === "smart")?.id ?? sel?.models[0]?.id ?? "";

  const assembledKey = useMemo(() => {
    if (format === "apiKey") return apiKey.trim();
    if (format === "json") return jsonText.trim();
    const obj: Record<string, string> = {};
    for (const f of sel?.credentialFields ?? []) {
      const v = (fieldValues[f.key] ?? "").trim();
      if (v) obj[f.key] = v;
    }
    return Object.keys(obj).length ? JSON.stringify(obj) : "";
  }, [format, apiKey, jsonText, fieldValues, sel]);

  const requiredFilled = useMemo(() => {
    if (format === "apiKey") return apiKey.trim().length >= 8;
    if (format === "json") { try { return Boolean(JSON.parse(jsonText)); } catch { return false; } }
    return (sel?.credentialFields ?? []).every((f) => f.optional || (fieldValues[f.key] ?? "").trim());
  }, [format, apiKey, jsonText, fieldValues, sel]);

  // Reset everything credential-related when the provider changes.
  useEffect(() => {
    setApiKey(""); setFieldValues({}); setJsonText(""); setModelOverride(""); setModelSearch(""); setValidation({ state: "idle" });
  }, [providerId]);

  // Debounced validate-on-change — re-runs when the key OR the chosen model
  // changes, so we test the exact model that'll run (critical for Bedrock).
  useEffect(() => {
    if (blocked) { setValidation({ state: "idle" }); return; }
    if (!requiredFilled || assembledKey.length < 8) { setValidation({ state: "idle" }); return; }
    const seq = ++validationSeq.current;
    const controller = new AbortController();
    setValidation({ state: "checking" });
    const t = setTimeout(async () => {
      try {
        const result = await aiAPI.validateKey({ provider: providerId, apiKey: assembledKey, model: modelOverride || undefined }, controller.signal);
        if (seq !== validationSeq.current) return;
        setValidation(result.ok ? { state: "ok", model: result.modelTested } : { state: "invalid", reason: result.reason || "Key did not validate." });
      } catch (err) {
        const e = err as { code?: string; name?: string };
        if (e?.code === "ERR_CANCELED" || e?.name === "CanceledError" || e?.name === "AbortError") return;
        if (seq !== validationSeq.current) return;
        setValidation({ state: "invalid", reason: "Could not reach the validation endpoint." });
      }
    }, 500);
    return () => { clearTimeout(t); controller.abort(); };
  }, [assembledKey, providerId, blocked, requiredFilled, modelOverride]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assembledKey || blocked) return;
    if (!requireRealAccount("AI provider keys")) return;
    setSaving(true);
    try {
      await aiAPI.createKey({
        provider: providerId,
        apiKey: assembledKey,
        name: name.trim() || undefined,
        modelOverride: modelOverride.trim() || null,
      });
      setApiKey(""); setFieldValues({}); setJsonText(""); setName(""); setModelOverride(""); setValidation({ state: "idle" });
      toast.success(`${sel?.label ?? providerId} key saved`);
      await onAdded();
    } catch (err) {
      const x = err as { response?: { data?: { error?: unknown } } };
      toast.error(typeof x.response?.data?.error === "string" ? x.response.data.error : "Failed to save key");
    } finally {
      setSaving(false);
    }
  };

  const makerLabel = (k: string) => (k === "__flat__" ? "" : k.charAt(0).toUpperCase() + k.slice(1));

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {/* AWS-style two-pane picker: Provider | Model */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Provider pane */}
        <div className="border border-border rounded-xl bg-card overflow-hidden flex flex-col">
          <div className="px-3 pt-3 pb-2 border-b border-border">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Provider</p>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input value={providerSearch} onChange={(e) => setProviderSearch(e.target.value)} placeholder="Search providers…" className="w-full pl-8 pr-2 py-1.5 text-xs bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring/30" />
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto p-1.5">
            {filteredProviders.map((p) => {
              const active = p.id === providerId;
              const locked = Boolean(p.gatewayOnly && !gatewayConfigured);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setProviderId(p.id)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors ${active ? "bg-primary/10 ring-1 ring-primary/30" : "hover:bg-muted"}`}
                >
                  <BrandChip id={p.id} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-foreground truncate">{p.label}</span>
                    {p.freeTier && <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">Free tier</span>}
                  </span>
                  {locked && <Lock size={13} className="text-amber-500 shrink-0" />}
                  {active && <Check size={14} strokeWidth={2.5} className="text-primary shrink-0" />}
                </button>
              );
            })}
            {filteredProviders.length === 0 && <p className="text-xs text-muted-foreground px-2 py-3">No providers match.</p>}
          </div>
        </div>

        {/* Model pane */}
        <div className="border border-border rounded-xl bg-card overflow-hidden flex flex-col">
          <div className="px-3 pt-3 pb-2 border-b border-border">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Model <span className="normal-case font-normal">· {providerModels.length} available</span></p>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input value={modelSearch} onChange={(e) => setModelSearch(e.target.value)} placeholder="Search models…" className="w-full pl-8 pr-2 py-1.5 text-xs bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring/30" disabled={blocked} />
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto p-1.5">
            {/* Default (auto) option */}
            <button type="button" onClick={() => setModelOverride("")} className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left ${modelOverride === "" ? "bg-primary/10 ring-1 ring-primary/30" : "hover:bg-muted"}`}>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-medium text-foreground">Provider default</span>
                <span className="block text-[11px] text-muted-foreground truncate">{defaultModel || "auto"}</span>
              </span>
              {modelOverride === "" && <Check size={14} strokeWidth={2.5} className="text-primary shrink-0" />}
            </button>
            {modelGroups.map(([maker, list]) => (
              <div key={maker}>
                {makerLabel(maker) && <p className="px-2.5 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">{makerLabel(maker)}</p>}
                {list.map((m) => {
                  const active = modelOverride === m.id;
                  return (
                    <button key={m.id} type="button" onClick={() => setModelOverride(m.id)} className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left ${active ? "bg-primary/10 ring-1 ring-primary/30" : "hover:bg-muted"}`}>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm text-foreground truncate">{m.label}</span>
                        <span className="block text-[10px] text-muted-foreground font-mono truncate">{m.id}{m.ctx ? ` · ${Math.round(m.ctx / 1000)}K ctx` : ""}</span>
                      </span>
                      {active && <Check size={14} strokeWidth={2.5} className="text-primary shrink-0" />}
                    </button>
                  );
                })}
              </div>
            ))}
            {providerModels.length === 0 && <p className="text-xs text-muted-foreground px-2 py-3">No models match — leave on “Provider default”, or type the exact id below.</p>}
          </div>
        </div>
      </div>

      {/* Provider note: free-tier + get-key link, or a gateway-required warning. */}
      {blocked ? (
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-300/60 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/20 p-3">
          <Lock size={15} strokeWidth={1.8} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-xs text-foreground leading-relaxed">
            <span className="font-medium">{sel?.label}</span> runs only through the AI Gateway, which isn't configured on this server yet. Ask an admin to set <code className="text-[11px]">AI_GATEWAY_API_KEY</code>, or pick a direct provider (OpenAI, Anthropic, Google, OpenRouter).
          </p>
        </div>
      ) : (
        <div className={`flex items-start gap-2.5 rounded-lg border p-3 ${sel?.freeTier ? "border-emerald-300/60 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/20" : "border-border bg-muted/30"}`}>
          <Sparkles size={15} strokeWidth={1.8} className={`mt-0.5 shrink-0 ${sel?.freeTier ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`} />
          <div className="min-w-0">
            <p className="text-xs text-foreground leading-relaxed">
              {sel?.freeTier ? "Offers a usable free tier — good for getting started." : "Paid provider — billed to your own account (no HireTrail markup)."}
              {sel?.keyKind === "aws" && " Pick the exact model your account has access to (Bedrock keys aren't model-specific)."}
            </p>
            {sel?.getKeyUrl && (
              <a href={sel.getKeyUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 mt-1 text-xs font-medium text-primary hover:underline">
                Get a {sel.label} key <ExternalLink size={11} strokeWidth={2} />
              </a>
            )}
          </div>
        </div>
      )}

      {/* Credential inputs — shape depends on the provider. */}
      {!blocked && format === "apiKey" && (
        <CredInput label="API key" type="password" value={apiKey} onChange={setApiKey} placeholder="Paste your provider API key" required />
      )}
      {!blocked && format === "fields" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(sel?.credentialFields ?? []).map((f) => (
            <CredInput key={f.key} label={f.label} type={f.type === "password" ? "password" : "text"} value={fieldValues[f.key] ?? ""} onChange={(v) => setFieldValues((s) => ({ ...s, [f.key]: v }))} placeholder={f.optional ? "(optional)" : ""} />
          ))}
        </div>
      )}
      {!blocked && format === "json" && (
        <div>
          <label className="block text-xs font-medium text-foreground mb-1.5">Credentials (JSON)</label>
          <textarea className={`${inputCls} font-mono text-xs`} rows={4} value={jsonText} onChange={(e) => setJsonText(e.target.value)} placeholder='{"project":"…","location":"…","googleCredentials":{"privateKey":"…","clientEmail":"…"}}' />
        </div>
      )}

      {/* Label + validation status */}
      {!blocked && (
        <div className="flex items-end gap-3 flex-wrap">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-medium text-foreground mb-1.5">Label (optional)</label>
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Personal / Work" />
          </div>
          {validation.state !== "idle" && (
            <p className={`text-[11px] inline-flex items-center gap-1 pb-2.5 ${validation.state === "ok" ? "text-emerald-600 dark:text-emerald-400" : validation.state === "invalid" ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`} role="status" aria-live="polite">
              {validation.state === "checking" && (<><span className="inline-block w-2 h-2 rounded-full bg-current animate-pulse" />Validating{modelOverride ? " model…" : "…"}</>)}
              {validation.state === "ok" && (<><Check size={12} strokeWidth={2.4} aria-hidden />Validated{validation.model ? ` (${validation.model})` : ""}.</>)}
              {validation.state === "invalid" && (<><X size={12} strokeWidth={2.4} aria-hidden />{validation.reason}</>)}
            </p>
          )}
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        {validation.state === "invalid" && <span className="text-[11px] text-muted-foreground">Save anyway? Click again.</span>}
        <button type="submit" disabled={saving || blocked || !assembledKey || validation.state === "checking"} className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg disabled:opacity-50">
          {saving ? "Saving…" : validation.state === "ok" ? "Save key ✓" : "Save key"}
        </button>
      </div>
    </form>
  );
}

function CredInput({
  label, type, value, onChange, placeholder, required,
}: {
  label: string; type: "text" | "password"; value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-foreground mb-1.5">{label}</label>
      <input type={type} className={inputCls} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoComplete="off" required={required} />
    </div>
  );
}
