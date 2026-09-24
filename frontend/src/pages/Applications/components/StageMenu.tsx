/** Stage pill that opens a "Move to" menu. The move is optimistic (see
 *  useMoveStage) — the pill changes the instant you pick. */
import { ChevronDown } from "lucide-react";
import Menu from "../../../components/ui/Menu.tsx";
import { STAGES, STAGE_BADGE_CLASS, STAGE_STRIPE_CLASS } from "../../../utils/stageStyles.ts";
import type { Application, Stage } from "../../../types";

export default function StageMenu({ app, onMove, size = "sm" }: {
  app: Application;
  onMove: (app: Application, stage: Stage) => void;
  size?: "sm" | "md";
}) {
  return (
    <Menu
      ariaLabel={`Move ${app.role} to stage`}
      width={184}
      items={STAGES.map((s) => ({
        label: s,
        icon: <span className={`w-2 h-2 rounded-full ${STAGE_STRIPE_CLASS[s]}`} />,
        checked: s === app.stage,
        onSelect: () => onMove(app, s),
      }))}
      trigger={
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className={`group/stage inline-flex items-center gap-1 rounded-full font-medium whitespace-nowrap transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-ring hover:ring-1 hover:ring-current/30 ${
            size === "sm" ? "h-6 pl-2.5 pr-1.5 text-[12px]" : "h-7 pl-3 pr-2 text-[13px]"
          } ${STAGE_BADGE_CLASS[app.stage]}`}
        >
          {app.stage}
          <ChevronDown size={size === "sm" ? 12 : 13} strokeWidth={2} className="opacity-50 group-hover/stage:opacity-90 transition-opacity" aria-hidden />
        </button>
      }
    />
  );
}
