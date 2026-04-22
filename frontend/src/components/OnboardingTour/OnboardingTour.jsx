import { useState, useEffect, useRef, useCallback } from "react";
import PropTypes from "prop-types";
import "./OnboardingTour.css";

const STORAGE_KEY = "hiretrail:onboarding-completed-v1";
const DEMO_EMAILS = ["demo@hiretrail.com"];

export function shouldShowTour(user) {
  if (!user) return false;
  if (DEMO_EMAILS.includes((user.email || "").toLowerCase())) return true;
  try {
    return localStorage.getItem(STORAGE_KEY) !== "1";
  } catch {
    return false;
  }
}

function markComplete() {
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    /* ignore */
  }
}

function resolveTargetRect(selector) {
  if (!selector) return null;
  const el = document.querySelector(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  // Values are viewport-relative so they work inside the fixed overlay.
  return {
    top: r.top,
    left: r.left,
    width: r.width,
    height: r.height,
  };
}

function OnboardingTour({ steps, onClose }) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState(null);
  const overlayRef = useRef(null);
  const step = steps[index];

  const updateRect = useCallback(() => {
    setRect(resolveTargetRect(step?.target));
  }, [step]);

  useEffect(() => {
    updateRect();
    const el = step?.target ? document.querySelector(step.target) : null;
    if (el && typeof el.scrollIntoView === "function") {
      el.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "center",
      });
    }
    const handle = () => updateRect();
    window.addEventListener("resize", handle);
    window.addEventListener("scroll", handle, true);
    const timer = setTimeout(updateRect, 250);
    return () => {
      window.removeEventListener("resize", handle);
      window.removeEventListener("scroll", handle, true);
      clearTimeout(timer);
    };
  }, [index, step, updateRect]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") finish();
      if (e.key === "ArrowRight" || e.key === "Enter") next();
      if (e.key === "ArrowLeft") back();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  useEffect(() => {
    overlayRef.current?.focus();
  }, [index]);

  const next = () => {
    if (index >= steps.length - 1) {
      finish();
    } else {
      setIndex(index + 1);
    }
  };

  const back = () => {
    if (index > 0) setIndex(index - 1);
  };

  const finish = () => {
    markComplete();
    onClose();
  };

  if (!step) return null;

  // Tooltip position — viewport-relative since it lives inside a fixed overlay.
  const tooltipStyle = {};
  const PAD = 12;
  const TOOLTIP_MAX_W = 360;
  const TOOLTIP_EST_H = 240;
  if (rect) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const spaceRight = vw - (rect.left + rect.width) - PAD;
    const spaceBelow = vh - (rect.top + rect.height) - PAD;
    const spaceAbove = rect.top - PAD;

    const tall = rect.height > vh * 0.55; // sidebar-like targets
    let placement;
    if (tall) {
      placement = spaceRight >= TOOLTIP_MAX_W ? "right" : "left";
    } else if (spaceBelow >= TOOLTIP_EST_H) {
      placement = "below";
    } else if (spaceAbove >= TOOLTIP_EST_H) {
      placement = "above";
    } else if (spaceRight >= TOOLTIP_MAX_W) {
      placement = "right";
    } else {
      placement = "left";
    }

    if (placement === "below") {
      tooltipStyle.top = rect.top + rect.height + PAD;
      tooltipStyle.left = rect.left;
    } else if (placement === "above") {
      tooltipStyle.top = rect.top - PAD - TOOLTIP_EST_H;
      tooltipStyle.left = rect.left;
    } else if (placement === "right") {
      tooltipStyle.left = rect.left + rect.width + PAD;
      tooltipStyle.top = rect.top + rect.height / 2 - TOOLTIP_EST_H / 2;
    } else {
      tooltipStyle.left = rect.left - TOOLTIP_MAX_W - PAD;
      tooltipStyle.top = rect.top + rect.height / 2 - TOOLTIP_EST_H / 2;
    }

    // Clamp inside viewport so nothing gets cut off.
    const maxLeft = vw - TOOLTIP_MAX_W - 16;
    tooltipStyle.left = Math.max(16, Math.min(tooltipStyle.left, maxLeft));
    const maxTop = vh - TOOLTIP_EST_H - 16;
    tooltipStyle.top = Math.max(16, Math.min(tooltipStyle.top, maxTop));
  } else {
    tooltipStyle.top = window.innerHeight / 2 - 120;
    tooltipStyle.left = window.innerWidth / 2 - 180;
  }

  return (
    <div
      className="onboarding-overlay"
      ref={overlayRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={`Onboarding step ${index + 1} of ${steps.length}`}
    >
      {rect && (
        <div
          className="onboarding-spotlight"
          style={{
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
          }}
          aria-hidden="true"
        />
      )}
      <div
        className="onboarding-tooltip"
        style={tooltipStyle}
        role="alertdialog"
        aria-labelledby={`onboarding-title-${index}`}
        aria-describedby={`onboarding-body-${index}`}
      >
        <div className="onboarding-tooltip-header">
          <span className="onboarding-progress">
            Step {index + 1} / {steps.length}
          </span>
          <button
            type="button"
            className="onboarding-skip"
            onClick={finish}
            aria-label="Skip onboarding"
          >
            Skip
          </button>
        </div>
        <h2 id={`onboarding-title-${index}`} className="onboarding-title">
          {step.title}
        </h2>
        <p id={`onboarding-body-${index}`} className="onboarding-body">
          {step.body}
        </p>
        <div className="onboarding-actions">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={back}
            disabled={index === 0}
          >
            Back
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={next}
          >
            {index === steps.length - 1 ? "Finish" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}

OnboardingTour.propTypes = {
  steps: PropTypes.arrayOf(
    PropTypes.shape({
      target: PropTypes.string,
      title: PropTypes.string.isRequired,
      body: PropTypes.string.isRequired,
    }),
  ).isRequired,
  onClose: PropTypes.func.isRequired,
};

export default OnboardingTour;
