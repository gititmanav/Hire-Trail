/** Add a BYOK key for ANY gateway provider. Provider + model come from the live
 *  gateway catalog (40+ providers, hundreds of models); credential inputs adapt
 *  to the provider's shape (single key, Bedrock/Azure fields, or a JSON blob).
 *  The assembled credential is validated through the gateway before save. */
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ExternalLink, Lock, Sparkles, X } from "lucide-react";
import toast from "react-hot-toast";
import { aiAPI } from "../../utils/api.ts";
import type { AICatalogProvider, AIModel } from "../../utils/api.ts";
import { useDemoGate } from "../../hooks/useDemoGate.tsx";

type ValidationState =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "ok" }
  | { state: "invalid"; reason: string };

const inputCls =
  "w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring";

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
  const [apiKey, setApiKey] = useState("");
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [jsonText, setJsonText] = useState("");
  const [name, setName] = useState("");
  const [modelOverride, setModelOverride] = useState("");
  const [saving, setSaving] = useState(false);
  const [validation, setValidation] = useState<ValidationState>({ state: "idle" });
  const validationSeq = useRef(0);

  const sel = useMemo(() => catalog.find((p) => p.id === providerId), [catalog, providerId]);
  const format = sel?.credentialFormat ?? "apiKey";
  const blocked = Boolean(sel?.gatewayOnly && !gatewayConfigured);

  // Models for the chosen provider: prefer the live list, fall back to the catalog's.
  const providerModels = useMemo(() => {
    const live = models.filter((m) => m.provider === providerId);
    if (live.length) return live.map((m) => ({ id: m.id, label: m.label }));
    return (sel?.models ?? []).map((m) => ({ id: m.id, label: m.label }));
  }, [models, providerId, sel]);
  const defaultModel = sel?.models.find((m) => m.capability === "smart")?.id ?? sel?.models[0]?.id ?? "";

  // Assemble the credential string the backend stores (single key, or JSON for
  // multi-field / json providers). byok forwarding parses it back generically.
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

  // Reset credential state when the provider changes.
  useEffect(() => {
    setApiKey(""); setFieldValues({}); setJsonText(""); setModelOverride(""); setValidation({ state: "idle" });
  }, [providerId]);

  // Debounced validate-on-type. Skipped for gateway-only providers when the
  // platform gateway isn't configured (it can't be checked or used yet).
  useEffect(() => {
    if (blocked) { setValidation({ state: "idle" }); return; }
    if (!requiredFilled || assembledKey.length < 8) { setValidation({ state: "idle" }); return; }
    const seq = ++validationSeq.current;
    const controller = new AbortController();
    setValidation({ state: "checking" });
    const t = setTimeout(async () => {
      try {
        const result = await aiAPI.validateKey({ provider: providerId, apiKey: assembledKey }, controller.signal);
        if (seq !== validationSeq.current) return;
        setValidation(result.ok ? { state: "ok" } : { state: "invalid", reason: result.reason || "Key did not validate." });
      } catch (err) {
        const e = err as { code?: string; name?: string };
        if (e?.code === "ERR_CANCELED" || e?.name === "CanceledError" || e?.name === "AbortError") return;
        if (seq !== validationSeq.current) return;
        setValidation({ state: "invalid", reason: "Could not reach the validation endpoint." });
      }
    }, 500);
    return () => { clearTimeout(t); controller.abort(); };
  }, [assembledKey, providerId, blocked, requiredFilled]);

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

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-foreground mb-1.5">Provider</label>
          <select
            value={providerId}
            onChange={(e) => setProviderId(e.target.value)}
            className={inputCls}
          >
            {catalog.map((p) => (
              <option key={p.id} value={p.id}>{p.label}{p.freeTier ? " — free tier" : ""}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-foreground mb-1.5">Label (optional)</label>
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Personal / Work" />
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
            <CredInput
              key={f.key}
              label={f.label}
              type={f.type === "password" ? "password" : "text"}
              value={fieldValues[f.key] ?? ""}
              onChange={(v) => setFieldValues((s) => ({ ...s, [f.key]: v }))}
              placeholder={f.optional ? "(optional)" : ""}
            />
          ))}
        </div>
      )}
      {!blocked && format === "json" && (
        <div>
          <label className="block text-xs font-medium text-foreground mb-1.5">Credentials (JSON)</label>
          <textarea
            className={`${inputCls} font-mono text-xs`}
            rows={4}
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            placeholder='{"project":"…","location":"…","googleCredentials":{"privateKey":"…","clientEmail":"…"}}'
          />
        </div>
      )}

      {/* Validation status */}
      {!blocked && validation.state !== "idle" && (
        <p
          className={`text-[11px] inline-flex items-center gap-1 ${
            validation.state === "ok" ? "text-emerald-600 dark:text-emerald-400" :
            validation.state === "invalid" ? "text-red-600 dark:text-red-400" : "text-muted-foreground"
          }`}
          role="status"
          aria-live="polite"
        >
          {validation.state === "checking" && (<><span className="inline-block w-2 h-2 rounded-full bg-current animate-pulse" />Validating…</>)}
          {validation.state === "ok" && (<><Check size={12} strokeWidth={2.4} aria-hidden />Key validates with {sel?.label}.</>)}
          {validation.state === "invalid" && (<><X size={12} strokeWidth={2.4} aria-hidden />{validation.reason}</>)}
        </p>
      )}

      {/* Model picker — searchable across the provider's live models. */}
      {!blocked && (
        <div>
          <label className="block text-xs font-medium text-foreground mb-1.5">Model (optional)</label>
          <input
            className={inputCls}
            list="ht-model-options"
            value={modelOverride}
            onChange={(e) => setModelOverride(e.target.value)}
            placeholder={defaultModel ? `Default: ${defaultModel}` : "Type to search models…"}
          />
          <datalist id="ht-model-options">
            {providerModels.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </datalist>
          <p className="text-[11px] text-muted-foreground mt-1">
            Leave blank for the default{defaultModel ? ` (${defaultModel})` : ""}. {providerModels.length} model{providerModels.length === 1 ? "" : "s"} available.
          </p>
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        {validation.state === "invalid" && (
          <span className="text-[11px] text-muted-foreground">Save anyway? Click again.</span>
        )}
        <button
          type="submit"
          disabled={saving || blocked || !assembledKey || validation.state === "checking"}
          className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg disabled:opacity-50"
        >
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
      <input
        type={type}
        className={inputCls}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        required={required}
      />
    </div>
  );
}
