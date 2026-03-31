import { useState, useEffect, useCallback } from "react";
import type { User } from "../../types";

interface Step {
  target: string;
  title: string;
  content: string;
}

const STEPS: Step[] = [
  { target: ".dashboard-grid", title: "Your Dashboard", content: "Each card is a widget you can drag, resize, or hide. Customize it to show what matters to you." },
  { target: "[data-tour='widgets-btn']", title: "Add Widgets", content: "Click here to add or remove widgets from your dashboard." },
  { target: "[data-tour='lock-btn']", title: "Lock Layout", content: "Lock your dashboard to prevent accidental changes to your layout." },
  { target: "a[href='/applications']", title: "Applications", content: "Track all your job applications here. Search, filter, sort, and paginate." },
  { target: "a[href='/kanban']", title: "Kanban Board", content: "Drag applications between stages for a visual pipeline view." },
  { target: "a[href='/jobs']", title: "Job Search", content: "Search for jobs and add them to your tracker with one click." },
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

  if (active < 0) return null;

  const step = STEPS[active];
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
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{active + 1} / {STEPS.length}</span>
          <div className="flex gap-2">
            <button onClick={finish} className="text-xs text-muted-foreground hover:text-foreground">Skip</button>
            <button onClick={next} className="px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90">
              {active === STEPS.length - 1 ? "Done" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
