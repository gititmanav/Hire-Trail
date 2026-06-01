/**
 * AiStepper — a horizontal row of process boxes for multi-phase AI work.
 *
 * The active box gets a pulsing theme-blue border + a shimmering label and a
 * breathing sparkle; completed boxes settle into a calm blue-tinted state with
 * a check; the connector line leaving the active box "draws" toward the next.
 * When `done` is set, a FaceID-style circle-check lands beneath the row.
 *
 * Pure presentational — the caller maps its own job/session status to
 * `activeIndex` + `done`.
 */
import { Fragment } from "react";
import { Check, type LucideIcon } from "lucide-react";
import "./AiIndicator.css";

export interface AiStep {
  key: string;
  label: string;
  /** Optional lucide icon for the box; defaults to a dot/Check by state. */
  icon?: LucideIcon;
}

interface AiStepperProps {
  steps: AiStep[];
  /** Index of the in-progress step. Steps before it render as completed. */
  activeIndex: number;
  /** All phases finished — renders the success badge and marks every box done. */
  done?: boolean;
  /** Label under the success badge. Default "Done". */
  doneLabel?: string;
  className?: string;
}

export default function AiStepper({ steps, activeIndex, done = false, doneLabel = "Done", className = "" }: AiStepperProps) {
  return (
    <div className={`ai-stepper ${className}`} role="group" aria-label="AI progress">
      <div className="ai-stepper__track">
        {steps.map((step, i) => {
          const isDone = done || i < activeIndex;
          const isActive = !done && i === activeIndex;
          const Icon = step.icon;
          const stateClass = isDone ? "is-done" : isActive ? "is-active" : "is-pending";
          // Connector after this step: filled if this step is done, drawing if
          // this is the active step (work is flowing to the next box).
          const lineClass = done || i < activeIndex ? "is-done" : i === activeIndex ? "is-drawing" : "";
          return (
            <Fragment key={step.key}>
              <div className={`ai-stepper__step ${stateClass}`}>
                <div className="ai-stepper__box">
                  <span className="ai-stepper__box-icon" aria-hidden>
                    {isDone ? (
                      <Check size={18} strokeWidth={2.6} />
                    ) : Icon ? (
                      <Icon size={18} strokeWidth={1.9} />
                    ) : (
                      <span style={{ width: 7, height: 7, borderRadius: 999, background: "currentColor", display: "inline-block" }} />
                    )}
                  </span>
                  <span className="ai-stepper__box-label">{step.label}</span>
                </div>
              </div>
              {i < steps.length - 1 && (
                <div className={`ai-stepper__line ${lineClass}`} aria-hidden>
                  <span className="ai-stepper__line-fill" />
                </div>
              )}
            </Fragment>
          );
        })}
      </div>

      {done && (
        <div className="ai-stepper__done">
          <span className="ai-stepper__done-badge" aria-hidden>
            <Check size={20} strokeWidth={3} />
          </span>
          <span className="ai-stepper__done-label">{doneLabel}</span>
        </div>
      )}
    </div>
  );
}
