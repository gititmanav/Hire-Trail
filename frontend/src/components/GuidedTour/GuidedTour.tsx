import { useState, useEffect, useCallback } from "react";
import type { User } from "../../types";

interface Step {
  target: string;
  title: string;
  content: string;
  /** Optional CTA button on the step — overrides "Next" when set. Lets the
   *  final step launch the user into the action we want them to take next. */
  cta?: { label: string; href: string };
}

/** First-run tour. Lives only on the Dashboard, so every target must resolve
 *  on that page (sidebar links + dashboard chrome). Steps are ordered from
 *  highest-context → most actionable so the user always knows where they are.
 *
 *  Keeping the tour Dashboard-only is a deliberate scope choice: cross-page
 *  tours need router-aware state and break when the user navigates away
 *  mid-tour. The CTA on the last step provides the bridge to the next page
 *  without owning navigation. */
const STEPS: Step[] = [
  { target: ".dashboard-grid", title: "Your Dashboard", content: "Every card here is a widget you can drag, resize, or hide. We'll show you how to customize it." },
  { target: "[data-tour='widgets-btn']", title: "Add or remove widgets", content: "Click Widgets to pick what shows up here. The grid persists per account." },
  { target: "[data-tour='lock-btn']", title: "Lock when you're happy", content: "Lock the layout so you don't accidentally drag a widget while skimming." },
  { target: "a[href='/applications']", title: "Applications", content: "Every tracked job lives here. Filter by stage, search, and click a row for the full detail panel + AI fit." },
  { target: "a[href='/kanban']", title: "Visual pipeline", content: "Drag applications between stages on the Kanban board. The strip color on each card matches the stage." },
  { target: "a[href='/resumes']", title: "Resumes", content: "Set a Primary resume so the browser extension attaches it on Apply-clicks. Each resume shows response / OA / interview / offer rates so you know what works." },
  // Profile lives inside the user-menu dropdown (avatar button, top-right of
  // Header) — there's no sidebar Profile link to anchor against. Targeting
  // the avatar via `data-tour="user-menu"` so the highlight + tooltip line
  // up with how users actually reach the page.
  { target: "[data-tour='user-menu']", title: "Master Profile", content: "Click your avatar to open Profile. Upload a PDF resume once — HireTrail extracts your experience, projects, education, and skills automatically. The Skill cloud shows which keywords appear most.", cta: { label: "Build my profile", href: "/profile" } },
];

interface Props {
  user: User;
  onComplete: () => void;
}

export default function GuidedTour({ user, onComplete }: Props) {
  const [active, setActive] = useState(-1);
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (user.tourCompleted) return;
    const timer = setTimeout(() => setActive(0), 800);
    return () => clearTimeout(timer);
  }, [user.tourCompleted]);

  const updateRect = useCallback((step: number) => {
    if (step < 0 || step >= STEPS.length) return;
    const el = document.querySelector(STEPS[step].target);
    if (el) {
      setRect(el.getBoundingClientRect());
    } else {
      setRect(null);
    }
  }, []);

  useEffect(() => {
    updateRect(active);
  }, [active, updateRect]);

  const finish = useCallback(() => {
    setActive(-1);
    onComplete();
  }, [onComplete]);

  const next = useCallback(() => {
    if (active >= STEPS.length - 1) { finish(); return; }
    setActive((s) => s + 1);
  }, [active, finish]);

  const prev = useCallback(() => {
    setActive((s) => Math.max(0, s - 1));
  }, []);

  if (active < 0) return null;

  const step = STEPS[active];
  const isLast = active === STEPS.length - 1;
  const padding = 8;

  return (
    <div className="fixed inset-0 z-[100]">
      <div className="absolute inset-0 bg-black/50" onClick={finish} />

      {rect && (
        <div
          className="absolute border-2 border-primary rounded-lg pointer-events-none"
          style={{
            top: rect.top - padding,
            left: rect.left - padding,
            width: rect.width + padding * 2,
            height: rect.height + padding * 2,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.5)",
          }}
        />
      )}

      <div
        className="absolute bg-card text-card-foreground rounded-xl p-5 shadow-2xl max-w-[320px] animate-in"
        style={{
          top: rect ? Math.min(rect.bottom + 16, window.innerHeight - 200) : "50%",
          left: rect ? Math.min(Math.max(rect.left, 16), window.innerWidth - 340) : "50%",
          transform: rect ? undefined : "translate(-50%, -50%)",
        }}
      >
        <h3 className="text-sm font-semibold text-foreground mb-1">{step.title}</h3>
        <p className="text-[13px] text-muted-foreground mb-4">{step.content}</p>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground tabular-nums">{active + 1} / {STEPS.length}</span>
          <div className="flex items-center gap-2">
            <button onClick={finish} className="text-xs text-muted-foreground hover:text-foreground">Skip</button>
            {active > 0 && (
              <button onClick={prev} className="px-3 py-1.5 text-xs font-medium border border-border text-secondary-foreground rounded-lg hover:bg-muted">
                Back
              </button>
            )}
            {isLast && step.cta ? (
              // Last step's CTA bridges to the action we want the user to take
              // next. anchor + onClick (instead of router Link) keeps the
              // tour from owning routing — the parent already records
              // completion via onComplete().
              <a
                href={step.cta.href}
                onClick={finish}
                className="px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90 no-underline"
              >
                {step.cta.label}
              </a>
            ) : (
              <button onClick={next} className="px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90">
                {isLast ? "Done" : "Next"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
