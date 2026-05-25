/** BYOK panel — add/remove API keys per provider, pick a model override per key. */
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { aiAPI } from "../../utils/api.ts";
import type { AIProvider, AIKey } from "../../utils/api.ts";
import { useDemoGate } from "../../hooks/useDemoGate.tsx";

/** "Did this key pass validation?" debounced state machine. */
type ValidationState =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "ok" }
  | { state: "invalid"; reason: string };

const inputCls = "w-full px-3 py-2 text-sm bg-card border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring";

const PROVIDER_META: Record<AIProvider, { label: string; placeholder: string; helpUrl: string }> = {
  anthropic: { label: "Anthropic (Claude)", placeholder: "sk-ant-...", helpUrl: "https://console.anthropic.com/settings/keys" },
  openai: { label: "OpenAI (GPT)", placeholder: "sk-proj-...", helpUrl: "https://platform.openai.com/api-keys" },
  google: { label: "Google (Gemini)", placeholder: "AI...", helpUrl: "https://aistudio.google.com/apikey" },
  openrouter: { label: "OpenRouter", placeholder: "sk-or-...", helpUrl: "https://openrouter.ai/keys" },
};

export function AISettingsCard() {
  const [keys, setKeys] = useState<AIKey[]>([]);
  const [defaults, setDefaults] = useState<Record<AIProvider, { fast: string; smart: string }> | null>(null);
  const [provider, setProvider] = useState<AIProvider>("anthropic");
  const [apiKey, setApiKey] = useState("");
  const [name, setName] = useState("");
  const [modelOverride, setModelOverride] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [validation, setValidation] = useState<ValidationState>({ state: "idle" });
  const validationSeq = useRef(0);
  const { requireRealAccount } = useDemoGate();

  const load = async () => {
    try {
      const [keysRes, provRes] = await Promise.all([aiAPI.listKeys(), aiAPI.listProviders()]);
      setKeys(keysRes);
      setDefaults(provRes.defaults);
    } catch {
      // If unauthenticated or server issue, show empty state silently.
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  /* Debounced validation: when the user has typed at least 8 chars (or pastes),
   * we ping the provider via the backend. A seq token + AbortController guard
   * against stale responses AND cancel any in-flight request when the user keeps
   * typing — avoids wasting the provider's quota on superseded candidates. */
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
        // axios surfaces aborts as AxiosError with code "ERR_CANCELED" — silent.
        const e = err as { code?: string; name?: string };
        if (e?.code === "ERR_CANCELED" || e?.name === "CanceledError" || e?.name === "AbortError") return;
        if (seq !== validationSeq.current) return;
        setValidation({ state: "invalid", reason: "Could not reach validation endpoint." });
      }
    }, 500);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [apiKey, provider]);

  const onAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) return;
    if (!requireRealAccount("AI provider keys")) return;
    setSaving(true);
    try {
      await aiAPI.createKey({ provider, apiKey: apiKey.trim(), name: name.trim() || undefined, modelOverride: modelOverride.trim() || null });
      setApiKey("");
      setName("");
      setModelOverride("");
      toast.success(`${PROVIDER_META[provider].label} key saved`);
      await load();
    } catch (err) {
      const e = err as { response?: { data?: { error?: unknown } } };
      const msg = typeof e.response?.data?.error === "string" ? e.response?.data?.error : "Failed to save key";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const onRemove = async (id: string) => {
    if (!confirm("Remove this API key?")) return;
    try {
      await aiAPI.deleteKey(id);
      toast.success("Key removed");
      await load();
    } catch {
      toast.error("Failed to remove key");
    }
  };

  const onToggleActive = async (k: AIKey) => {
    try {
      await aiAPI.updateKey(k._id, { isActive: !k.isActive });
      await load();
    } catch {
      toast.error("Failed to update key");
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-center gap-2 mb-1">
        <h3 className="text-base font-semibold text-foreground">AI Provider Keys</h3>
        <span className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-primary/10 text-primary">BYOK</span>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Bring your own API keys for resume parsing and tailoring. Keys are encrypted at rest. Without a key, HireTrail falls back to the default provider when configured.
      </p>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : (
        <>
          {keys.length > 0 && (
            <div className="space-y-2 mb-5">
              {keys.map((k) => (
                <div key={k._id} className="flex items-center justify-between gap-3 px-3 py-2 border border-border rounded-lg">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${k.isActive ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
                      <span className="text-sm font-medium text-foreground">{PROVIDER_META[k.provider].label}</span>
                      {k.name && <span className="text-xs text-muted-foreground">· {k.name}</span>}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      Model: {k.modelOverride || defaults?.[k.provider]?.smart || "default"} · Added {new Date(k.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => onToggleActive(k)} className="px-2 py-1 text-xs font-medium border border-border rounded-md text-secondary-foreground hover:bg-muted">
                      {k.isActive ? "Deactivate" : "Activate"}
                    </button>
                    <button onClick={() => onRemove(k._id)} className="px-2 py-1 text-xs font-medium border border-border rounded-md text-red-500 hover:bg-destructive/10">
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={onAdd} className="space-y-3 border-t border-border pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Provider</label>
                <select className={inputCls} value={provider} onChange={(e) => setProvider(e.target.value as AIProvider)}>
                  {(Object.keys(PROVIDER_META) as AIProvider[]).map((p) => (
                    <option key={p} value={p}>{PROVIDER_META[p].label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Label (optional)</label>
                <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Personal / Work" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                API Key <a href={PROVIDER_META[provider].helpUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline ml-1">— get one</a>
              </label>
              <input type="password" className={inputCls} value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={PROVIDER_META[provider].placeholder} required />
              {/* Inline validation feedback. Surfaces as soon as the key looks
                 *  long enough to be real. Keeps the save button disabled when
                 *  the validator explicitly rejects the key. */}
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
                  {validation.state === "checking" && (
                    <>
                      <span className="inline-block w-2 h-2 rounded-full bg-current animate-pulse" />
                      Validating…
                    </>
                  )}
                  {validation.state === "ok" && (
                    <>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden><polyline points="20 6 9 17 4 12"/></svg>
                      Key validates with {PROVIDER_META[provider].label.split(" ")[0]}.
                    </>
                  )}
                  {validation.state === "invalid" && (
                    <>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      {validation.reason}
                    </>
                  )}
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Model override (optional)</label>
              <input className={inputCls} value={modelOverride} onChange={(e) => setModelOverride(e.target.value)} placeholder={defaults?.[provider]?.smart || ""} />
              <p className="text-[11px] text-muted-foreground mt-1">Leave blank to use the default ({defaults?.[provider]?.smart || "loading..."}).</p>
            </div>
            <div className="flex items-center justify-end gap-3">
              {validation.state === "invalid" && (
                <span className="text-[11px] text-muted-foreground">Override and save anyway? Click again.</span>
              )}
              <button
                type="submit"
                disabled={saving || !apiKey.trim() || validation.state === "checking"}
                className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg disabled:opacity-50"
              >
                {saving ? "Saving..." : validation.state === "ok" ? "Save key ✓" : "Save key"}
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
