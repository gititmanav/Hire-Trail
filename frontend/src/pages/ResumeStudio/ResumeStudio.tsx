/**
 * Resume Studio — tailoring + editing centerpiece (route /resume-studio).
 *
 * A 3-step wizard: (1) See the gap → (2) Align → (3) Review. The Review step
 * holds three tabs (AI Rewrite · Editor · Style) over ONE shared ResumeDocument
 * whose live preview IS the print template. Download serializes that preview's
 * HTML + CSS to /api/resumes/render-pdf so the PDF equals the preview.
 *
 * Edits autosave (debounced) via PUT /resumes/:id/document; the tailored result
 * is tracked as a resume variant (surfaced on the Resumes page).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Link } from "react-router-dom";
import {
  AlertCircle, ArrowLeft, ArrowRight, Check, CloudOff, Download, FileText, Loader2, Sparkles,
} from "lucide-react";
import toast from "react-hot-toast";
import "./ResumeStudio.css";
import { useStudioDocument } from "./useStudioDocument.ts";
import GapStep from "./steps/GapStep.tsx";
import AlignStep, { defaultAlignConfig, buildAlignInstruction, type AlignConfig } from "./steps/AlignStep.tsx";
import ReviewStep from "./steps/ReviewStep.tsx";
import { buildResumeCss } from "./preview/resumeCss.ts";
import { resumeStudioAPI } from "../../utils/studioApi.ts";
import { useDemoGate } from "../../hooks/useDemoGate.tsx";
import type { ResumeDocument } from "../../utils/resumeDocument.ts";

const DEFAULT_JD =
  "Senior Software Engineer — build and operate event-driven backend services. Requirements: TypeScript, GraphQL, Kubernetes, observability, Terraform, Postgres, strong testing and CI/CD practices, mentoring.";

type Step = "gap" | "align" | "review";
const STEP_ORDER: Step[] = ["gap", "align", "review"];
const STEP_LABEL: Record<Step, string> = { gap: "See the gap", align: "Align", review: "Review" };

function sanitize(s: string): string {
  return s.replace(/[^a-zA-Z0-9-]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "").slice(0, 60) || "resume";
}
function makeFilename(doc: ResumeDocument): string {
  return `hiretrail-${sanitize(doc.meta.name || "resume")}`;
}

function AutosaveIndicator({ state, at }: { state: ReturnType<typeof useStudioDocument>["saveState"]; at: Date | null }) {
  if (state === "saving") return <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2 size={13} className="animate-spin" /> Saving…</span>;
  if (state === "error") return <span className="inline-flex items-center gap-1.5 text-xs text-red-500"><CloudOff size={13} /> Save failed — retrying</span>;
  if (state === "saved") return <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400"><Check size={13} strokeWidth={2.5} /> Saved{at ? ` ${at.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : ""}</span>;
  return <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">All changes saved automatically</span>;
}

export default function ResumeStudio() {
  const [params] = useSearchParams();
  const resumeId = params.get("resume") || "studio-demo";
  const initialJd = params.get("jd") || DEFAULT_JD;
  const { isDemo } = useDemoGate();

  const studio = useStudioDocument(resumeId, initialJd);
  const [step, setStep] = useState<Step>("gap");
  const [alignConfig, setAlignConfig] = useState<AlignConfig | null>(null);
  const [downloading, setDownloading] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  // Initialize the align config once the document + gap are available.
  useEffect(() => {
    if (!alignConfig && studio.doc && !studio.gapLoading) {
      setAlignConfig(defaultAlignConfig(studio));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studio.doc, studio.gapLoading]);

  const seedInstruction = useMemo(
    () => (alignConfig ? buildAlignInstruction(alignConfig, studio) : ""),
    [alignConfig, studio],
  );

  const stepIndex = STEP_ORDER.indexOf(step);
  const goNext = () => setStep(STEP_ORDER[Math.min(STEP_ORDER.length - 1, stepIndex + 1)]);
  const goBack = () => setStep(STEP_ORDER[Math.max(0, stepIndex - 1)]);

  const onDownload = async () => {
    const node = previewRef.current;
    if (!node || !studio.doc) return;
    setDownloading(true);
    try {
      // Serialize the EXACT preview DOM, minus screen-only affordances.
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
      if (ext === "pdf") toast.success("PDF downloaded — identical to the preview.");
      else toast("Downloaded a print-ready preview. PDF rendering wires up at backend integration.", { icon: "ℹ️", duration: 5000 });
    } catch {
      toast.error("Could not generate the file.");
    } finally {
      setDownloading(false);
    }
  };

  if (studio.loading) {
    return (
      <div className="max-w-2xl mx-auto pt-20 flex flex-col items-center text-center">
        <Sparkles size={28} strokeWidth={1.6} className="text-primary mb-3" />
        <p className="text-sm text-muted-foreground">Loading Resume Studio…</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
        <div className="min-w-0">
          <Link to="/resumes" className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground mb-2">
            <ArrowLeft size={13} strokeWidth={2} /> Back to Documents
          </Link>
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-primary text-white shadow-sm">
              <Sparkles size={18} strokeWidth={1.9} />
            </div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Resume Studio</h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {step === "review" && <AutosaveIndicator state={studio.saveState} at={studio.lastSavedAt} />}
          <button
            onClick={onDownload}
            disabled={downloading}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-primary hover:bg-primary/90 rounded-lg disabled:opacity-50 shadow-sm"
            title="Download a PDF identical to the live preview"
          >
            {downloading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} strokeWidth={2} />}
            Download
          </button>
        </div>
      </div>

      {/* Tracked-variant note */}
      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 mb-5 text-xs text-muted-foreground">
        <FileText size={14} strokeWidth={1.8} className="text-primary shrink-0" />
        <span>
          Edits save automatically as a <strong className="text-foreground font-medium">tracked variant</strong> — it appears under{" "}
          <Link to="/resumes" className="text-primary hover:underline">Tailored variants</Link> in Documents, with its own response metrics.
        </span>
        {isDemo && (
          <span className="ml-auto inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
            <AlertCircle size={13} /> Demo — AI edits prompt sign-up
          </span>
        )}
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
      {step === "align" && alignConfig && <AlignStep studio={studio} config={alignConfig} setConfig={setAlignConfig} />}
      {step === "review" && <ReviewStep studio={studio} previewRef={previewRef} seedInstruction={seedInstruction} />}

      {/* Wizard nav (hidden on review — the work happens in the tabs there) */}
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
            className="inline-flex items-center gap-1.5 px-5 py-2 text-sm font-semibold text-white bg-primary hover:bg-primary/90 rounded-lg shadow-sm"
          >
            {step === "gap" ? "Choose what to tailor" : "Review & edit"}
            <ArrowRight size={15} strokeWidth={2} />
          </button>
        </div>
      )}
    </div>
  );
}
