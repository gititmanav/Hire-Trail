/**
 * AiPulse — the atomic "AI is thinking" mark.
 *
 * A sparkle glyph that breathes, slowly rotates, and glows in the theme blue,
 * optionally paired with a shimmering label. Use it inline anywhere the app is
 * generating/parsing/analyzing with AI (replaces ad-hoc Loader2 spinners and
 * pulse-dots so every AI surface speaks the same visual language).
 */
import { Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import "./AiIndicator.css";

interface AiPulseProps {
  /** Glyph size in px. Default 16. */
  size?: number;
  /** Optional shimmering label rendered to the right of the glyph. */
  label?: ReactNode;
  /** Softer glow for dense/inline contexts. */
  tone?: "primary" | "subtle";
  /** Label font size in px. Default 13. */
  labelSize?: number;
  className?: string;
}

export default function AiPulse({ size = 16, label, tone = "primary", labelSize = 13, className = "" }: AiPulseProps) {
  return (
    <span className={`ai-pulse ${tone === "subtle" ? "ai-pulse--subtle" : ""} ${className}`} role="status" aria-live="polite">
      <span className="ai-pulse__glyph" aria-hidden>
        <Sparkles size={size} strokeWidth={1.7} />
      </span>
      {label != null && (
        <span className="ai-pulse__label" style={{ fontSize: labelSize }}>{label}</span>
      )}
    </span>
  );
}
