/**
 * Right-side "next action" panel rendered inside ApplicationRow.
 *
 * Uniform frame on every card: stage chip on top, age in middle, CTA at the
 * bottom. Only the CTA label varies between stages — the layout, width, and
 * button geometry are identical so the eye still pattern-matches across rows.
 */
import { memo } from "react";
import { useNavigate } from "react-router-dom";
import StageChip from "../../../components/StageChip/StageChip.tsx";
import type { AppHealth, NextAction } from "../../../utils/applicationHealth.ts";
import type { Application } from "../../../types";

interface Props {
  app: Application;
  health: AppHealth;
  action: NextAction;
  onOpen: () => void;
}

function ApplicationStatusPanelImpl({ app, health, action, onOpen }: Props) {
  const navigate = useNavigate();

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (action.kind === "tailor" && app.tailorSessionId) {
      navigate(`/applications?tailor=${app._id}`);
      return;
    }
    onOpen();
  };

  return (
    <div
      className="w-[200px] shrink-0 flex flex-col gap-2 p-3 border-l border-border bg-muted/30"
      role="group"
      aria-label={`${app.stage} — ${health.longLabel}`}
    >
      <div className="flex items-center">
        <StageChip stage={app.stage} tailorSessionId={app.tailorSessionId} size="sm" />
      </div>

      <div className="flex-1 min-h-0">
        {action.hint ? (
          <p className="text-[11px] text-muted-foreground leading-tight line-clamp-2" title={action.hint}>
            {action.hint}
          </p>
        ) : (
          <p className="text-[11px] text-muted-foreground/70 leading-tight line-clamp-2">
            {health.longLabel}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={handleClick}
        className={`w-full px-2.5 py-1.5 text-[12px] font-medium rounded-md border transition-colors ${
          action.urgent
            ? "bg-primary text-primary-foreground border-primary hover:brightness-105"
            : "bg-card text-foreground border-border hover:bg-muted"
        }`}
      >
        {action.label}
      </button>
    </div>
  );
}

export default memo(ApplicationStatusPanelImpl);
