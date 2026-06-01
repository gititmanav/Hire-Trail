/**
 * Persistent bottom-right stack of in-flight + recently-completed background tasks.
 * Renders for any route, since it's mounted above <Routes /> in App.tsx.
 *
 * Visual: each card shows an animated "AI sparkle" while running (the same star
 * glyph used by the AI Tailor sidebar item, with a subtle rotate + breathe),
 * a check on success, a red dot on error. Successful cards auto-dismiss in 6s;
 * errors stick until acknowledged.
 */
import { useEffect } from "react";
import { X, Check, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import AiPulse from "../AiIndicator/AiPulse.tsx";
import { useBackgroundTasks, type BackgroundTask, type StartTaskInput, type TaskStatus } from "../../hooks/useBackgroundTasks.tsx";
import { buildEmailScanTask } from "../../utils/emailScanTask.ts";
import "./BackgroundTaskCenter.css";

const KIND_LABEL_FALLBACK: Record<BackgroundTask["kind"], string> = {
  resume_parse: "Parsing resume",
  profile_sync: "Updating profile",
  tailor_analyze: "Analyzing JD",
  pdf_render: "Rendering PDF",
  email_scan: "Scanning your inbox",
};

const MAX_VISIBLE = 4;

export default function BackgroundTaskCenter() {
  const { tasks, dismissTask, registerRecovery } = useBackgroundTasks();
  const navigate = useNavigate();

  // Recovery handler for the email scan — registered here (always-mounted)
  // rather than in Settings, because a refresh mid-scan should resume polling
  // no matter what page the user lands on. The provider replays persisted
  // recovery entries through this handler exactly once on mount.
  useEffect(() => {
    return registerRecovery({
      kind: "email_scan",
      // Cast: rebuild returns StartTaskInput<unknown> (invariant T), so the
      // ScanJob-typed task gets widened at the boundary. Same pattern Tailor
      // uses for tailor_analyze recovery — cast at the seam, type internally.
      rebuild: (recovery, _label, sublabel) =>
        buildEmailScanTask({ jobId: recovery.resourceId, sublabel }) as unknown as StartTaskInput<unknown>,
    });
  }, [registerRecovery]);

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
          <X size={12} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

function StatusGlyph({ status }: { status: TaskStatus }) {
  if (status === "success") return <Check className="glyph-success" size={20} strokeWidth={2.4} aria-hidden />;
  if (status === "error") return <AlertCircle className="glyph-error" size={20} strokeWidth={2.2} aria-hidden />;
  // Running — the shared AI pulse glyph (unified across all AI surfaces).
  return <AiPulse size={22} />;
}
