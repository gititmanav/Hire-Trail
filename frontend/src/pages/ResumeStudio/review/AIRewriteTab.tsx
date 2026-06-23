/**
 * AI Rewrite tab — the centerpiece. Everything here strictly reflects backend
 * output; it never invents resume content.
 *
 *   • match-score gauge (0–10) that animates before→after on each rewrite
 *   • contextual suggestion chips (doc.suggestions) → preset+scope rewrite
 *   • section targeting: the active target chip (chosen from the preview) +
 *     a free-text instruction → scoped ai-rewrite (defaults to scope "all")
 *   • "See What's Changed": the changes[] changelog from every rewrite
 *   • Undo/revert
 */
import { useEffect, useState } from "react";
import { ArrowRight, RotateCcw, Sparkles, Target, Undo2, X } from "lucide-react";
import AiPulse from "../../../components/AiIndicator/AiPulse.tsx";
import MatchScoreGauge from "./MatchScoreGauge.tsx";
import { useDemoGate } from "../../../hooks/useDemoGate.tsx";
import type { StudioController } from "../useStudioDocument.ts";
import type { AISuggestion } from "../../../utils/resumeDocument.ts";

export default function AIRewriteTab({
  studio,
  seedInstruction,
}: {
  studio: StudioController;
  seedInstruction?: string;
}) {
  const { doc, target, clearTarget, runRewrite, rewriting, changes, scoreAnim, canUndo, undo } = studio;
  const { requireRealAccount } = useDemoGate();
  const [instruction, setInstruction] = useState(seedInstruction ?? "");

  // Seed the textarea from the Align step once (if the user didn't type yet).
  useEffect(() => {
    if (seedInstruction && !instruction) setInstruction(seedInstruction);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedInstruction]);

  if (!doc) return null;
  const suggestions: AISuggestion[] = doc.suggestions ?? [];
  const score = typeof doc.score === "number" ? doc.score : 6;

  const onChip = (s: AISuggestion) => {
    if (!requireRealAccount("AI resume rewrite")) return;
    runRewrite({ scope: s.scope, preset: s.id, instruction: s.instruction });
  };

  const onEditWithAI = () => {
    if (!requireRealAccount("AI resume rewrite")) return;
    const scope = target?.scope ?? "all";
    runRewrite({ scope, instruction: instruction.trim() || undefined });
  };

  return (
    <div className="space-y-5">
      {/* Score + undo */}
      <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-5">
        <MatchScoreGauge score={score} anim={scoreAnim} />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-foreground">Match score</h3>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            Apply a suggestion or describe a tweak — the score updates as your resume gets closer to the role.
          </p>
          {canUndo && (
            <button
              onClick={() => void undo()}
              className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium border border-border rounded-lg text-secondary-foreground hover:bg-muted"
            >
              <Undo2 size={13} strokeWidth={2} /> Undo last change
            </button>
          )}
        </div>
      </div>

      {/* Targeting + instruction */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center justify-between gap-2 mb-2">
          <h3 className="text-sm font-semibold text-foreground inline-flex items-center gap-1.5">
            <Target size={14} strokeWidth={2} className="text-primary" /> Edit with AI
          </h3>
          {rewriting && <AiPulse size={14} label="Rewriting…" labelSize={12} />}
        </div>

        {/* Active target chip (chosen by hovering a section in the preview) */}
        <div className="flex items-center gap-2 flex-wrap mb-2.5">
          <span className="text-[11px] text-muted-foreground">Target:</span>
          {target ? (
            <span className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 text-xs font-medium rounded-full bg-primary/10 text-primary border border-primary/30">
              {target.label}
              <button onClick={clearTarget} className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-primary/20" aria-label="Clear target">
                <X size={11} strokeWidth={2.5} />
              </button>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full bg-muted text-muted-foreground border border-border">
              Whole resume
            </span>
          )}
          <span className="text-[11px] text-muted-foreground">· hover a section in the preview to target it</span>
        </div>

        <textarea
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          rows={3}
          placeholder="Tell me how you'd like to tweak your resume… (e.g. “make the bullets more quantified and senior”)"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring resize-y leading-relaxed"
        />
        <div className="flex items-center justify-end mt-2.5">
          <button
            onClick={onEditWithAI}
            disabled={rewriting}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-primary hover:bg-primary/90 rounded-lg disabled:opacity-50"
          >
            <Sparkles size={15} strokeWidth={2} />
            {rewriting ? "Working…" : "Edit With AI"}
          </button>
        </div>
      </div>

      {/* Suggestion chips */}
      {suggestions.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="text-sm font-semibold text-foreground mb-1">Suggested improvements</h3>
          <p className="text-xs text-muted-foreground mb-3">One click applies the change and updates your score.</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s.id}
                onClick={() => onChip(s)}
                disabled={rewriting}
                className="group inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border border-border bg-background text-foreground hover:border-primary/50 hover:bg-primary/5 disabled:opacity-50 transition-colors"
                title={s.instruction}
              >
                <Sparkles size={12} strokeWidth={2} className="text-primary" />
                {s.label}
                <ArrowRight size={11} strokeWidth={2.5} className="opacity-0 group-hover:opacity-100 -ml-0.5 transition-opacity" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* What's Changed */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-1">
          <RotateCcw size={14} strokeWidth={2} className="text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">See what's changed</h3>
        </div>
        {changes.length === 0 ? (
          <p className="text-xs text-muted-foreground mt-1">No AI edits yet. Your changelog will appear here.</p>
        ) : (
          <ul className="mt-2 space-y-2.5">
            {changes.map((c, i) => (
              <li key={`${c.path}-${i}`} className="text-xs">
                <p className="font-medium text-foreground">{c.summary}</p>
                <div className="mt-1 grid grid-cols-1 gap-1">
                  {c.before && (
                    <p className="text-muted-foreground line-through decoration-red-400/50 leading-relaxed">{c.before}</p>
                  )}
                  <p className="text-emerald-700 dark:text-emerald-300 leading-relaxed">{c.after}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
