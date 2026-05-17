/**
 * Persistent bottom-right stack of in-flight + recently-completed background tasks.
 * Renders for any route, since it's mounted above <Routes /> in App.tsx.
 *
 * Visual: each card shows an animated "AI sparkle" while running (the same star
 * glyph used by the AI Tailor sidebar item, with a subtle rotate + breathe),
 * a check on success, a red dot on error. Successful cards auto-dismiss in 6s;
 * errors stick until acknowledged.
 */
import { useNavigate } from "react-router-dom";
import { useBackgroundTasks, type BackgroundTask, type TaskStatus } from "../../hooks/useBackgroundTasks.tsx";
import "./BackgroundTaskCenter.css";

const KIND_LABEL_FALLBACK: Record<BackgroundTask["kind"], string> = {
  resume_parse: "Parsing resume",
  profile_sync: "Updating profile",
  tailor_analyze: "Analyzing JD",
  pdf_render: "Rendering PDF",
};

const MAX_VISIBLE = 4;

export default function BackgroundTaskCenter() {
  const { tasks, dismissTask } = useBackgroundTasks();
  const navigate = useNavigate();

  if (tasks.length === 0) return null;

  const visible = tasks.slice(0, MAX_VISIBLE);
  const hiddenCount = tasks.length - visible.length;

  return (
    <div
      className="bg-task-center"
      role="region"
      aria-label="Background tasks"
    >
      {visible.map((t) => (
        <TaskCard
          key={t.id}
          task={t}
          onDismiss={() => dismissTask(t.id)}
          onCta={() => {
            if (t.ctaPath) navigate(t.ctaPath);
            dismissTask(t.id);
          }}
        />
      ))}
      {hiddenCount > 0 && (
        <div className="bg-task-overflow">+{hiddenCount} more</div>
      )}
    </div>
  );
}

function TaskCard({
  task, onDismiss, onCta,
}: {
  task: BackgroundTask;
  onDismiss: () => void;
  onCta: () => void;
}) {
  const label = task.status === "success" && task.successLabel
    ? task.successLabel
    : task.status === "error"
      ? (task.error || "Failed")
      : task.label || KIND_LABEL_FALLBACK[task.kind];

  return (
    <div className={`bg-task-card status-${task.status}`} role="status" aria-live="polite">
      <div className="bg-task-icon" aria-hidden>
        <StatusGlyph status={task.status} />
      </div>
      <div className="bg-task-body">
        <p className="bg-task-label">{label}</p>
        {task.sublabel && task.status === "running" && (
          <p className="bg-task-sublabel">{task.sublabel}</p>
        )}
        {task.status === "running" && (
          <div className="bg-task-progress">
            <div
              className={`bg-task-progress-bar ${task.progress == null ? "indeterminate" : ""}`}
              style={task.progress != null ? { width: `${Math.round(task.progress * 100)}%` } : undefined}
            />
          </div>
        )}
      </div>
      <div className="bg-task-actions">
        {task.status === "success" && task.ctaLabel && task.ctaPath && (
          <button type="button" className="bg-task-cta" onClick={onCta}>
            {task.ctaLabel}
          </button>
        )}
        <button
          type="button"
          className="bg-task-close"
          onClick={onDismiss}
          aria-label="Dismiss"
          title="Dismiss"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="6" y1="6" x2="18" y2="18" />
            <line x1="18" y1="6" x2="6" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function StatusGlyph({ status }: { status: TaskStatus }) {
  if (status === "success") {
    return (
      <svg className="glyph-success" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <polyline points="5,12 10,17 19,7" />
      </svg>
    );
  }
  if (status === "error") {
    return (
      <svg className="glyph-error" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="12" r="9" />
        <line x1="12" y1="8" x2="12" y2="13" />
        <line x1="12" y1="16" x2="12" y2="16.01" />
      </svg>
    );
  }
  // Running — animated AI sparkle (reuses the star path from the sidebar's AI Tailor item)
  return (
    <span className="glyph-running">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 2l1.6 4.2L18 8l-4.4 1.8L12 14l-1.6-4.2L6 8l4.4-1.8L12 2zm6 11l1 2.5L21.5 16 19 17l-1 2.5L17 15l1-2z" />
      </svg>
    </span>
  );
}
