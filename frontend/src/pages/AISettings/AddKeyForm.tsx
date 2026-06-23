/** Add an API key for any BYOK provider. Provider is chosen via ActionDropdown
 *  (no native <select>), with a free-tier note + get-key link, and the key is
 *  validated against the provider before save. */
import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, ExternalLink, Sparkles, X } from "lucide-react";
import toast from "react-hot-toast";
import ActionDropdown from "../../components/ActionDropdown/ActionDropdown.tsx";
import { aiAPI } from "../../utils/api.ts";
import type { AIProvider } from "../../utils/api.ts";
import { PROVIDER_CATALOG } from "../../utils/studioApi.ts";
import { useDemoGate } from "../../hooks/useDemoGate.tsx";

type ValidationState =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "ok" }
  | { state: "invalid"; reason: string };

const inputCls =
  "w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring";

const PROVIDER_ORDER: AIProvider[] = ["google", "openrouter", "openai", "anthropic"];

export default function AddKeyForm({
  availableProviders,
  defaultModel,
  onAdded,
}: {
  /** byok-capable providers from GET /ai/providers; falls back to the full catalog. */
  availableProviders: AIProvider[];
  /** resolve the default "smart" model label for the chosen provider, for the placeholder. */
  defaultModel: (p: AIProvider) => string | undefined;
  onAdded: () => void | Promise<void>;
}) {
  const { requireRealAccount } = useDemoGate();
  const providers = (availableProviders.length ? availableProviders : PROVIDER_ORDER)
    .slice()
    .sort((a, b) => PROVIDER_ORDER.indexOf(a) - PROVIDER_ORDER.indexOf(b));

  const [provider, setProvider] = useState<AIProvider>(providers[0] ?? "google");
  const [apiKey, setApiKey] = useState("");
  const [name, setName] = useState("");
  const [modelOverride, setModelOverride] = useState("");
  const [saving, setSaving] = useState(false);
  const [validation, setValidation] = useState<ValidationState>({ state: "idle" });
  const validationSeq = useRef(0);

  const meta = PROVIDER_CATALOG[provider];

  // Debounced validate-on-type (mirrors the proven AISettingsCard behaviour):
  // seq token + AbortController guard against stale + superseded responses.
  useEffect(() => {
    const trimmed = apiKey.trim();
    if (trimmed.length < 8) { setValidation({ state: "idle" }); return; }
    const seq = ++validationSeq.current;
    const controller = new AbortController();
    setValidation({ state: "checking" });
    const t = setTimeout(async () => {
      try {
        const result = await aiAPI.validateKey({ provider, apiKey: trimmed }, controller.signal);
        if (seq !== validationSeq.current) return;
        if (result.ok) setValidation({ state: "ok" });
        else setValidation({ state: "invalid", reason: result.reason || "Key did not validate." });
      } catch (err) {
        const e = err as { code?: string; name?: string };
        if (e?.code === "ERR_CANCELED" || e?.name === "CanceledError" || e?.name === "AbortError") return;
        if (seq !== validationSeq.current) return;
        setValidation({ state: "invalid", reason: "Could not reach the validation endpoint." });
      }
    }, 500);
    return () => { clearTimeout(t); controller.abort(); };
  }, [apiKey, provider]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) return;
    if (!requireRealAccount("AI provider keys")) return;
    setSaving(true);
    try {
      await aiAPI.createKey({
        provider,
        apiKey: apiKey.trim(),
        name: name.trim() || undefined,
        modelOverride: modelOverride.trim() || null,
      });
      setApiKey(""); setName(""); setModelOverride(""); setValidation({ state: "idle" });
      toast.success(`${meta.label} key saved`);
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
          <ActionDropdown
            align="left"
            menuWidth="w-full"
            trigger={
              <button
                type="button"
                className="w-full flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground hover:border-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <span className="inline-flex items-center gap-2">
                  {meta.label}
                  {meta.freeTier && (
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 px-1.5 py-0.5 rounded">Free</span>
                  )}
                </span>
                <ChevronDown size={16} className="text-muted-foreground shrink-0" />
              </button>
            }
            items={providers.map((p) => ({
              label: PROVIDER_CATALOG[p].label,
              icon: <Check size={14} className={provider === p ? "text-primary" : "opacity-0"} />,
              onClick: () => { setProvider(p); setValidation({ state: "idle" }); },
            }))}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-foreground mb-1.5">Label (optional)</label>
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Personal / Work" />
        </div>
      </div>

      {/* Free-tier note + get-key link for the chosen provider */}
      <div className={`flex items-start gap-2.5 rounded-lg border p-3 ${meta.freeTier ? "border-emerald-300/60 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/20" : "border-border bg-muted/30"}`}>
        <Sparkles size={15} strokeWidth={1.8} className={`mt-0.5 shrink-0 ${meta.freeTier ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`} />
        <div className="min-w-0">
          <p className="text-xs text-foreground leading-relaxed">{meta.freeTierNote}</p>
          <a href={meta.getKeyUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 mt-1 text-xs font-medium text-primary hover:underline">
            Get a {meta.short} key <ExternalLink size={11} strokeWidth={2} />
          </a>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-foreground mb-1.5">API key</label>
        <input
          type="password"
          className={inputCls}
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={meta.placeholder}
          autoComplete="off"
          required
        />
        {validation.state !== "idle" && (
          <p
            className={`text-[11px] mt-1.5 inline-flex items-center gap-1 ${
              validation.state === "ok" ? "text-emerald-600 dark:text-emerald-400" :
              validation.state === "invalid" ? "text-red-600 dark:text-red-400" :
              "text-muted-foreground"
            }`}
            role="status"
            aria-live="polite"
          >
            {validation.state === "checking" && (<><span className="inline-block w-2 h-2 rounded-full bg-current animate-pulse" />Validating…</>)}
            {validation.state === "ok" && (<><Check size={12} strokeWidth={2.4} aria-hidden />Key validates with {meta.short}.</>)}
            {validation.state === "invalid" && (<><X size={12} strokeWidth={2.4} aria-hidden />{validation.reason}</>)}
          </p>
        )}
      </div>

      <div>
        <label className="block text-xs font-medium text-foreground mb-1.5">Model override (optional)</label>
        <input className={inputCls} value={modelOverride} onChange={(e) => setModelOverride(e.target.value)} placeholder={defaultModel(provider) || ""} />
        <p className="text-[11px] text-muted-foreground mt-1">Leave blank to use the default{defaultModel(provider) ? ` (${defaultModel(provider)})` : ""}.</p>
      </div>

      <div className="flex items-center justify-end gap-3">
        {validation.state === "invalid" && (
          <span className="text-[11px] text-muted-foreground">Save anyway? Click again.</span>
        )}
        <button
          type="submit"
          disabled={saving || !apiKey.trim() || validation.state === "checking"}
          className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg disabled:opacity-50"
        >
          {saving ? "Saving…" : validation.state === "ok" ? "Save key ✓" : "Save key"}
        </button>
      </div>
    </form>
  );
}
