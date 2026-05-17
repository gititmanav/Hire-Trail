/** Stage badge used on Applications + Kanban + anywhere else we render an app's stage.
 *
 *  Special-cases the "Drafting" stage: if the application has a linked tailor session,
 *  the chip becomes clickable and navigates to /tailor?session=<id>. For every other
 *  stage it's a plain span. */
import { useNavigate } from "react-router-dom";
import type { Stage } from "../../types";
import { STAGE_BADGE_CLASS } from "../../utils/stageStyles.ts";

interface Props {
  stage: Stage;
  /** When present and stage === "Drafting", the chip links to the tailor session. */
  tailorSessionId?: string | null;
  /** Extra classes appended after the stage tone classes. */
  className?: string;
  /** Optional smaller variant for dense tables. */
  size?: "sm" | "md";
}

export default function StageChip({ stage, tailorSessionId, className = "", size = "md" }: Props) {
  const navigate = useNavigate();
  const sizeClasses = size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-0.5 text-xs";
  const baseClass = `inline-block ${sizeClasses} font-medium rounded-full ${STAGE_BADGE_CLASS[stage]} ${className}`;

  if (stage === "Drafting" && tailorSessionId) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          navigate(`/tailor?session=${tailorSessionId}`);
        }}
        className={`${baseClass} cursor-pointer hover:ring-2 hover:ring-primary/30 transition-shadow`}
        title="Open in AI Tailor"
      >
        {stage}
      </button>
    );
  }
  return <span className={baseClass}>{stage}</span>;
}
