/** Admin → AI Providers. Controls the platform-wide AI default: the enable
 *  toggle (off ⇒ users must BYOK), the encrypted default key, the default
 *  provider/model, and the per-user monthly token quota. Wired to /api/admin/ai. */
import { useCallback, useEffect, useState } from "react";
import { Sparkles, Check, ChevronDown, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { adminAiAPI, type AdminAiConfig } from "../../utils/api";
import ActionDropdown from "../../components/ActionDropdown/ActionDropdown.tsx";

const PROVIDERS = ["google", "openai", "anthropic", "openrouter", "bedrock", "mistral", "xai", "groq", "deepseek", "perplexity", "cohere"];
const inputCls = "w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring";

export default function AISystemConfig() {
  const [config, setConfig] = useState<AdminAiConfig | null>(null);
  const [gatewayConfigured, setGatewayConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Default-key form
  const [keyProvider, setKeyProvider] = useState("google");
  const [keyValue, setKeyValue] = useState("");
  // Editable config fields
  const [defaultModel, setDefaultModel] = useState("");
  const [monthlyLimit, setMonthlyLimit] = useState(200000);

  const load = useCallback(async () => {
    try {
      const { config: c, gatewayConfigured: gw } = await adminAiAPI.getConfig();
      setConfig(c); setGatewayConfigured(gw);
      setDefaultModel(c.defaultModel || "");
      setMonthlyLimit(c.monthlyTokenLimit);
      if (c.defaultProvider) setKeyProvider(c.defaultProvider);
    } catch { toast.error("Could not load AI config"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const patch = async (p: Partial<AdminAiConfig>) => {
    setBusy(true);
    try { setConfig(await adminAiAPI.updateConfig(p)); toast.success("Saved"); }
    catch { toast.error("Update failed"); }
    finally { setBusy(false); }
  };

  const saveKey = async () => {
    if (!keyValue.trim()) return;
    setBusy(true);
    try {
      const c = await adminAiAPI.setKey(keyProvider, keyValue.trim());
      setConfig(c); setKeyValue("");
      toast.success(`Default ${keyProvider} key saved`);
    } catch (e) {
      const x = e as { response?: { data?: { error?: string } } };
      toast.error(x.response?.data?.error || "Could not save key");
    } finally { setBusy(false); }
  };

  const removeKey = async () => {
    setBusy(true);
    try { setConfig(await adminAiAPI.deleteKey()); toast.success("Default key removed"); }
    catch { toast.error("Could not remove key"); }
    finally { setBusy(false); }
  };

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading AI config…</div>;
  if (!config) return <div className="p-6 text-sm text-danger">Could not load AI config.</div>;

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
          <Sparkles size={22} strokeWidth={1.8} className="text-primary" />AI Providers
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Platform-wide AI default for users who haven’t added their own key.</p>
      </div>

      {/* Enable toggle */}
      <div className="bg-card border border-border rounded-xl p-5 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">Default AI enabled</p>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            When on, users without their own key use the default below (rate-limited). When off, everyone must bring their own key.
            <span className="block mt-1">Gateway: <span className={gatewayConfigured ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}>{gatewayConfigured ? "configured (any provider + Bedrock)" : "not configured (4 legacy providers via direct SDK)"}</span></span>
          </p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
          <input type="checkbox" className="sr-only peer" checked={config.enabled} disabled={busy} onChange={(e) => patch({ enabled: e.target.checked })} />
          <span className="w-11 h-6 bg-muted border border-border rounded-full peer-checked:bg-primary peer-disabled:opacity-50 transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:shadow-sm after:transition-transform peer-checked:after:translate-x-5"></span>
        </label>
      </div>

      {/* Default key */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between gap-3 mb-3">
          <p className="text-sm font-semibold text-foreground">Default API key</p>
          {config.hasDefaultKey && (
            <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">{config.defaultProvider} ····{config.defaultKeyLast4}</span>
              <button onClick={removeKey} disabled={busy} className="inline-flex items-center gap-1 text-danger hover:underline"><Trash2 size={13} />Remove</button>
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-3">
          <ActionDropdown
            align="left" menuWidth="w-full"
            trigger={<button type="button" className="w-full flex items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground hover:border-muted-foreground/40"><span className="capitalize">{keyProvider}</span><ChevronDown size={16} className="text-muted-foreground" /></button>}
            items={PROVIDERS.map((p) => ({ label: p, icon: <Check size={14} className={keyProvider === p ? "text-primary" : "opacity-0"} />, onClick: () => setKeyProvider(p) }))}
          />
          <div className="flex gap-2">
            <input type="password" className={inputCls} placeholder={config.hasDefaultKey ? "Enter a new key to replace" : "Paste the default key"} value={keyValue} onChange={(e) => setKeyValue(e.target.value)} autoComplete="off" />
            <button onClick={saveKey} disabled={busy || !keyValue.trim()} className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg disabled:opacity-50 shrink-0">Save</button>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">Validated against the provider, then stored encrypted. For Bedrock, paste JSON credentials.</p>
      </div>

      {/* Model + quota */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div>
          <label className="block text-xs font-medium text-foreground mb-1.5">Default model override (optional)</label>
          <div className="flex gap-2">
            <input className={inputCls} placeholder="e.g. google/gemini-2.5-flash" value={defaultModel} onChange={(e) => setDefaultModel(e.target.value)} />
            <button onClick={() => patch({ defaultModel })} disabled={busy} className="px-4 py-2 text-sm font-medium border border-border rounded-lg hover:bg-muted shrink-0">Save</button>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-foreground mb-1.5">Per-user monthly token quota (default-key users)</label>
          <div className="flex gap-2">
            <input type="number" className={inputCls} value={monthlyLimit} onChange={(e) => setMonthlyLimit(Number(e.target.value))} min={0} />
            <button onClick={() => patch({ monthlyTokenLimit: monthlyLimit })} disabled={busy} className="px-4 py-2 text-sm font-medium border border-border rounded-lg hover:bg-muted shrink-0">Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}
