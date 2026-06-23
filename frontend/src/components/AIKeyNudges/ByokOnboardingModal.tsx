/**
 * BYOK onboarding modal — "Bring your own AI key — free, 30s".
 *
 * Shown once after the first-run tour when the user has no active AI key. A small
 * carousel (placeholder copy + image slots) recommends a free Gemini key; the
 * primary CTA routes to AI settings, "Maybe later" closes. Strictly a nudge —
 * dismissing is always one click away and the choice is remembered.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, KeyRound, ShieldCheck, Sparkles, X } from "lucide-react";

interface Slide {
  /** image slot — replace with a real asset at /public when available. */
  art: "intro" | "free" | "fast";
  badge?: string;
  title: string;
  body: string;
}

const SLIDES: Slide[] = [
  {
    art: "intro",
    badge: "Recommended",
    title: "Bring your own AI key",
    body: "HireTrail's resume tailoring, rewrites, and parsing run on an AI model. Connect your own key and every feature runs on your account — private, and as fast as your provider allows.",
  },
  {
    art: "free",
    badge: "Free",
    title: "Google Gemini is free to start",
    body: "Gemini's free tier has generous daily limits and needs no credit card. It's the fastest way to unlock everything — most people never hit the limit.",
  },
  {
    art: "fast",
    badge: "~30 seconds",
    title: "Three quick steps",
    body: "Open Google AI Studio, click “Create API key”, and paste it into AI settings. We validate it on the spot. That's it — you're ready to tailor.",
  },
];

/** Placeholder illustration per slide — a themed gradient panel with an icon.
 *  Swap for a real <img src> when marketing art lands (the box is the image slot). */
function SlideArt({ art }: { art: Slide["art"] }) {
  const Icon = art === "free" ? ShieldCheck : art === "fast" ? Sparkles : KeyRound;
  return (
    <div
      className="relative h-40 w-full rounded-xl overflow-hidden flex items-center justify-center"
      style={{ background: "linear-gradient(135deg, hsl(var(--primary) / 0.16), hsl(var(--primary) / 0.04))" }}
      aria-hidden
    >
      {/* image slot — drop a screenshot/illustration here at integration */}
      <span className="absolute top-2 left-2 text-[9px] font-medium uppercase tracking-wider text-muted-foreground/70 border border-border/60 rounded px-1.5 py-0.5 bg-card/40">
        Image
      </span>
      <Icon size={44} strokeWidth={1.4} className="text-primary" />
    </div>
  );
}

export default function ByokOnboardingModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [i, setI] = useState(0);
  const slide = SLIDES[i];
  const isLast = i === SLIDES.length - 1;

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && i < SLIDES.length - 1) setI((p) => p + 1);
      if (e.key === "ArrowLeft" && i > 0) setI((p) => p - 1);
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose, i]);

  const goSettings = () => { onClose(); navigate("/settings/ai"); };

  return (
    <div className="fixed inset-0 z-[90] bg-black/55 backdrop-blur-sm flex items-center justify-center px-4 animate-in" onClick={onClose}>
      <div className="w-full max-w-[460px] bg-card border border-border rounded-2xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Bring your own AI key">
        <div className="flex items-center justify-between px-5 pt-4">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-primary">
            <Sparkles size={13} strokeWidth={2} /> Free · 30s
          </span>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted" aria-label="Close">
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        <div className="px-5 pt-3 pb-5">
          <SlideArt art={slide.art} />
          <div className="mt-4 min-h-[112px]">
            {slide.badge && (
              <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 px-1.5 py-0.5 rounded">{slide.badge}</span>
            )}
            <h2 className="text-lg font-semibold text-foreground mt-2">{slide.title}</h2>
            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{slide.body}</p>
          </div>

          {/* dots */}
          <div className="flex items-center justify-center gap-1.5 mt-4">
            {SLIDES.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setI(idx)}
                aria-label={`Go to slide ${idx + 1}`}
                className={`h-1.5 rounded-full transition-all ${idx === i ? "w-5 bg-primary" : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50"}`}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 px-5 py-3.5 border-t border-border bg-muted/20">
          <button onClick={onClose} className="text-xs font-medium text-muted-foreground hover:text-foreground">Maybe later</button>
          <div className="flex items-center gap-2">
            {i > 0 && (
              <button onClick={() => setI((p) => p - 1)} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-border rounded-lg text-secondary-foreground hover:bg-muted">
                <ChevronLeft size={13} strokeWidth={2} /> Back
              </button>
            )}
            {isLast ? (
              <button onClick={goSettings} className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-primary hover:bg-primary/90 rounded-lg">
                <KeyRound size={13} strokeWidth={2} /> Add my free key
              </button>
            ) : (
              <button onClick={() => setI((p) => p + 1)} className="inline-flex items-center gap-1 px-4 py-1.5 text-xs font-semibold text-white bg-primary hover:bg-primary/90 rounded-lg">
                Next <ChevronRight size={13} strokeWidth={2} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
