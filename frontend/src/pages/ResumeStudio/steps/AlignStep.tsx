/** Step 2 — "Align". Pick which sections to tailor, which missing keywords to
 *  weave in (+ custom ones), and the depth (Quick vs Full). The choices seed the
 *  AI Rewrite tab's instruction on the Review step. */
import { useState } from "react";
import { Check, Plus, Zap, Layers } from "lucide-react";
import type { StudioController } from "../useStudioDocument.ts";

export interface AlignConfig {
  sectionIds: string[];
  keywords: string[];
  mode: "quick" | "full";
}

export function defaultAlignConfig(studio: StudioController): AlignConfig {
  const doc = studio.doc;
  return {
    sectionIds: doc ? doc.sections.filter((s) => s.type !== "education").map((s) => s.id) : [],
    keywords: studio.gap ? studio.gap.missing.slice(0, 4) : [],
    mode: "full",
  };
}

/** Build a single natural-language instruction from the align choices — this is
 *  what the AI Rewrite tab pre-fills so "Edit With AI" works in one click. */
export function buildAlignInstruction(config: AlignConfig, studio: StudioController): string {
  const titles = (studio.doc?.sections ?? []).filter((s) => config.sectionIds.includes(s.id)).map((s) => s.title);
  const depth = config.mode === "quick" ? "Make light, surgical edits" : "Do a thorough rewrite";
  const kw = config.keywords.length ? ` Naturally work in these keywords where truthful: ${config.keywords.join(", ")}.` : "";
  const secs = titles.length ? ` Focus on: ${titles.join(", ")}.` : "";
  return `${depth} to tailor this resume to the target role.${secs}${kw}`.trim();
}

export default function AlignStep({
  studio, config, setConfig,
}: {
  studio: StudioController;
  config: AlignConfig;
  setConfig: (c: AlignConfig) => void;
}) {
  const { doc, gap } = studio;
  const [custom, setCustom] = useState("");
  if (!doc) return null;

  const toggleSection = (id: string) =>
    setConfig({ ...config, sectionIds: config.sectionIds.includes(id) ? config.sectionIds.filter((x) => x !== id) : [...config.sectionIds, id] });
  const toggleKeyword = (k: string) =>
    setConfig({ ...config, keywords: config.keywords.includes(k) ? config.keywords.filter((x) => x !== k) : [...config.keywords, k] });
  const addCustom = () => {
    const k = custom.trim();
    if (!k || config.keywords.includes(k)) { setCustom(""); return; }
    setConfig({ ...config, keywords: [...config.keywords, k] });
    setCustom("");
  };

  const missing = gap?.missing ?? [];
  const extraSelected = config.keywords.filter((k) => !missing.includes(k));

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Align to the role</h2>
        <p className="text-sm text-muted-foreground mt-1">Tell the AI what to focus on. You'll review and fine-tune every change next.</p>
      </div>

      {/* Sections */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-1">Sections to tailor</h3>
        <p className="text-xs text-muted-foreground mb-3">Only the sections you pick will be rewritten.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {doc.sections.slice().sort((a, b) => a.order - b.order).map((s) => {
            const on = config.sectionIds.includes(s.id);
            return (
              <button
                key={s.id}
                onClick={() => toggleSection(s.id)}
                className={`flex items-center gap-2.5 rounded-lg border p-3 text-left transition-colors ${on ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"}`}
              >
                <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${on ? "bg-primary border-primary" : "border-muted-foreground/40"}`}>
                  {on && <Check size={11} strokeWidth={3} className="text-primary-foreground" />}
                </span>
                <span className="text-sm font-medium text-foreground">{s.title}</span>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground ml-auto">{s.type}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Keywords */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-1">Keywords to emphasize</h3>
        <p className="text-xs text-muted-foreground mb-3">From the gap analysis — tap to include, or add your own.</p>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {missing.map((k) => {
            const on = config.keywords.includes(k);
            return (
              <button
                key={k}
                onClick={() => toggleKeyword(k)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full border transition-colors ${on ? "bg-primary text-primary-foreground border-primary" : "border-border text-foreground hover:border-primary/50"}`}
              >
                {on && <Check size={11} strokeWidth={3} />}
                {k}
              </button>
            );
          })}
          {extraSelected.map((k) => (
            <button key={k} onClick={() => toggleKeyword(k)} className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full border bg-primary text-primary-foreground border-primary">
              <Check size={11} strokeWidth={3} />{k}
            </button>
          ))}
          {missing.length === 0 && extraSelected.length === 0 && (
            <span className="text-xs text-muted-foreground">No missing keywords — add any you'd like to stress.</span>
          )}
        </div>
        <div className="flex items-center gap-2 max-w-sm">
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }}
            placeholder="Add a custom keyword…"
            className="flex-1 px-3 py-1.5 text-sm bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring"
          />
          <button onClick={addCustom} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-border rounded-lg text-foreground hover:bg-muted">
            <Plus size={13} strokeWidth={2} /> Add
          </button>
        </div>
      </div>

      {/* Mode */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-3">How much should we change?</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ModeCard
            active={config.mode === "quick"} onClick={() => setConfig({ ...config, mode: "quick" })}
            icon={<Zap size={18} strokeWidth={1.9} />} title="Quick"
            desc="Light, surgical edits — keep your voice, just sharpen it."
          />
          <ModeCard
            active={config.mode === "full"} onClick={() => setConfig({ ...config, mode: "full" })}
            icon={<Layers size={18} strokeWidth={1.9} />} title="Full"
            desc="Thorough rewrite of the selected sections for maximum alignment."
          />
        </div>
      </div>
    </div>
  );
}

function ModeCard({ active, onClick, icon, title, desc }: { active: boolean; onClick: () => void; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <button onClick={onClick} className={`text-left rounded-xl border p-4 transition-colors ${active ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border hover:bg-muted/40"}`}>
      <div className="flex items-center gap-2 mb-1.5">
        <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{icon}</span>
        <span className="text-sm font-semibold text-foreground">{title}</span>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
    </button>
  );
}
