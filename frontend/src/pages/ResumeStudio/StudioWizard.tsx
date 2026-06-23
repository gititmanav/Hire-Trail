/**
 * StudioWizard — the shell-agnostic 3-step tailoring flow (Gap → Align → Review)
 * over ONE shared ResumeDocument. Mounted by BOTH shells:
 *   - the /resume-studio page (manual tailoring), and
 *   - the Applications tailoring drawer (app-driven; opens at Step 2).
 *
 * It owns the step state, the Align config, the live-preview ref, autosave
 * status, and Download (Gotenberg PDF, with a cold-start–aware loader). Step
 * components are shell-blind — they take only `{ studio }`.
 */
import { useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, CloudOff, Download, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { useStudioDocument } from "./useStudioDocument.ts";
import GapStep from "./steps/GapStep.tsx";
import AlignStep, { defaultAlignConfig, buildAlignInstruction, type AlignConfig } from "./steps/AlignStep.tsx";
import ReviewStep from "./steps/ReviewStep.tsx";
import { buildResumeCss } from "./preview/resumeCss.ts";
import { resumeStudioAPI } from "../../utils/studioApi.ts";
import type { StudioController } from "./useStudioDocument.ts";
import type { ResumeDocument } from "../../utils/resumeDocument.ts";

export type Step = "gap" | "align" | "review";
const STEP_ORDER: Step[] = ["gap", "align", "review"];
const STEP_LABEL: Record<Step, string> = { gap: "See the gap", align: "Align", review: "Review" };

function sanitize(s: string): string {
  return s.replace(/[^a-zA-Z0-9-]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "").slice(0, 60) || "resume";
}
function makeFilename(doc: ResumeDocument): string {
  return `hiretrail-${sanitize(doc.meta.name || "resume")}`;
}

function AutosaveIndicator({ state, at }: { state: StudioController["saveState"]; at: Date | null }) {
  if (state === "saving") return <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2 size={13} className="animate-spin" /> Saving…</span>;
  if (state === "error") return <span className="inline-flex items-center gap-1.5 text-xs text-red-500"><CloudOff size={13} /> Save failed — retrying</span>;
  if (state === "saved") return <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400"><Check size={13} strokeWidth={2.5} /> Saved{at ? ` ${at.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : ""}</span>;
  return <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">All changes saved automatically</span>;
}

export default function StudioWizard({
  studio,
  initialStep = "gap",
}: {
  studio: StudioController;
  initialStep?: Step;
}) {
  const [step, setStep] = useState<Step>(initialStep);
  const [alignConfig, setAlignConfig] = useState<AlignConfig | null>(null);
  const [downloading, setDownloading] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  // The Align config defaults from the doc + gap (pure) until the user edits it;
  // once edited, `alignConfig` sticks. Computed in render so the drawer can open
  // straight at "align" without an empty-config frame.
  const effectiveAlign = alignConfig ?? (studio.doc ? defaultAlignConfig(studio) : null);

  const seedInstruction = useMemo(
    () => (effectiveAlign ? buildAlignInstruction(effectiveAlign, studio) : ""),
    [effectiveAlign, studio],
  );

  const stepIndex = STEP_ORDER.indexOf(step);
  const goNext = () => setStep(STEP_ORDER[Math.min(STEP_ORDER.length - 1, stepIndex + 1)]);
  const goBack = () => setStep(STEP_ORDER[Math.max(0, stepIndex - 1)]);

  const onDownload = async () => {
    const node = previewRef.current;
    if (!node || !studio.doc) return;
    setDownloading(true);
    // Gotenberg is scale-to-zero (Cloud Run) — the first call after idle can take
    // ~20–30s to boot. A persistent, honest loader (not a page-pinned spinner).
    const toastId = toast.loading("Generating your PDF… first run can take ~20–30s while the renderer warms up.");
    try {
      const clone = node.cloneNode(true) as HTMLElement;
      clone.querySelectorAll("[data-rd-control]").forEach((n) => n.remove());
      clone.querySelectorAll(".rd-changed").forEach((n) => (n as HTMLElement).classList.remove("rd-changed"));
      clone.querySelectorAll(".rd-targeted").forEach((n) => (n as HTMLElement).classList.remove("rd-targeted"));
      const html = clone.outerHTML;
      const css = buildResumeCss(studio.doc.style, studio.density);
      const filename = makeFilename(studio.doc);

      const blob = await resumeStudioAPI.renderPdf({ html, css, filename });
      const ext = blob.type.includes("pdf") ? "pdf" : "html";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      if (ext === "pdf") toast.success("PDF downloaded — identical to the preview.", { id: toastId });
      else toast("Downloaded a print-ready preview (mock mode).", { id: toastId, icon: "ℹ️", duration: 5000 });
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      toast.error(e?.response?.data?.error || e?.message || "Could not generate the PDF — please try again.", { id: toastId });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="w-full">
      {/* Action row — autosave status (review only) + Download (always). */}
      <div className="flex items-center justify-end gap-3 mb-4">
        {step === "review" && <AutosaveIndicator state={studio.saveState} at={studio.lastSavedAt} />}
        <button
          onClick={onDownload}
          disabled={downloading || !studio.doc}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-primary hover:bg-primary/90 rounded-lg disabled:opacity-50 shadow-sm"
          title="Download a PDF identical to the live preview"
        >
          {downloading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} strokeWidth={2} />}
          {downloading ? "Generating…" : "Download"}
        </button>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2 mb-6">
        {STEP_ORDER.map((s, i) => {
          const done = i < stepIndex;
          const active = i === stepIndex;
          return (
            <div key={s} className="flex items-center gap-2">
              <button
                onClick={() => (i <= stepIndex ? setStep(s) : undefined)}
                disabled={i > stepIndex}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  active ? "bg-primary text-primary-foreground"
                    : done ? "bg-primary/10 text-primary hover:bg-primary/15"
                    : "bg-muted text-muted-foreground cursor-default"
                }`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${active ? "bg-white/20" : done ? "bg-primary/20" : "bg-muted-foreground/15"}`}>
                  {done ? <Check size={12} strokeWidth={3} /> : i + 1}
                </span>
                {STEP_LABEL[s]}
              </button>
              {i < STEP_ORDER.length - 1 && <ArrowRight size={14} className="text-muted-foreground/50" />}
            </div>
          );
        })}
      </div>

      {/* Step content */}
      {step === "gap" && <GapStep studio={studio} />}
      {step === "align" && effectiveAlign && (
        <AlignStep studio={studio} config={effectiveAlign} setConfig={setAlignConfig} />
      )}
      {step === "review" && <ReviewStep studio={studio} previewRef={previewRef} seedInstruction={seedInstruction} />}

      {/* Wizard nav (hidden on review — the work happens in the tabs there). */}
      {step !== "review" && (
        <div className="flex items-center justify-between mt-6 pt-5 border-t border-border">
          <button
            onClick={goBack}
            disabled={stepIndex === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium border border-border rounded-lg text-secondary-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ArrowLeft size={15} strokeWidth={2} /> Back
          </button>
          <button
            onClick={goNext}
            disabled={step === "gap" && (!studio.gap || studio.gapLoading)}
            title={step === "gap" && !studio.gap ? "Analyze the gap first" : undefined}
            className="inline-flex items-center gap-1.5 px-5 py-2 text-sm font-semibold text-white bg-primary hover:bg-primary/90 rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {step === "gap" ? "Choose what to tailor" : "Review & edit"}
            <ArrowRight size={15} strokeWidth={2} />
          </button>
        </div>
      )}
    </div>
  );
}
