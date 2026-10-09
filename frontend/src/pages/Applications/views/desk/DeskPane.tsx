/** The Desk's right pane: the open application, whole — the same view as its
 *  page (detail/ApplicationDetail) under a slim toolbar: where you are in the
 *  list (J/K), Edit, Tailor, More, and Expand ⇄ Shrink. A new application
 *  eases in (it never blinks); the pane scrolls back to the top for it. */
import { useLayoutEffect, useRef } from "react";
import { ArrowLeft, ChevronDown, ChevronUp, Ellipsis, Maximize2, Minimize2, Pencil, Sparkles } from "lucide-react";
import Button from "../../../../components/ui/Button.tsx";
import Menu from "../../../../components/ui/Menu.tsx";
import Tooltip from "../../../../components/ui/Tooltip.tsx";
import ApplicationDetail, { ApplicationDetailSkeleton } from "../../detail/ApplicationDetail.tsx";
import { useDetailActions } from "../../detail/useDetailActions.tsx";
import { useApplication } from "../../data/queries.ts";
import type { Application } from "../../../../types";

const iconButton = "w-8 h-8 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-control disabled:opacity-40 disabled:pointer-events-none transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export default function DeskPane({ id, full, split, position, onExpand, onShrink, onStep, onEdit, onDeleted }: {
  id: string | null;
  /** The pane has the page (expanded, or single-pane on a narrow screen). */
  full: boolean;
  split: boolean;
  position: { n: number; of: number } | null;
  onExpand: () => void;
  onShrink: () => void;
  onStep: (delta: 1 | -1) => void;
  onEdit: (app: Application) => void;
  /** The open application was deleted — open a neighbour. */
  onDeleted: () => void;
}) {
  const { data: app, isPending, isError, isPlaceholderData } = useApplication(id ?? undefined);
  const actions = useDetailActions(app, { onDeleted });
  const scrollRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => { scrollRef.current?.scrollTo(0, 0); }, [id]);

  return (
    <section aria-label={app ? `${app.role} at ${app.company}` : "Application"} className="desk-pane flex-1 min-w-0 min-h-0 flex flex-col bg-background">
      <div className="h-12 shrink-0 flex items-center gap-1 pl-3 pr-3 border-b border-border">
        {!split ? (
          <Button size="xs" variant="ghost" onClick={onShrink}><ArrowLeft size={14} strokeWidth={2} aria-hidden />Applications</Button>
        ) : position && (
          <div className="flex items-center gap-0.5">
            <Tooltip label="Previous" shortcut="K">
              <button type="button" onClick={() => onStep(-1)} disabled={position.n <= 1} aria-label="Previous application" className={iconButton}>
                <ChevronUp size={16} strokeWidth={2} aria-hidden />
              </button>
            </Tooltip>
            <Tooltip label="Next" shortcut="J">
              <button type="button" onClick={() => onStep(1)} disabled={position.n >= position.of} aria-label="Next application" className={iconButton}>
                <ChevronDown size={16} strokeWidth={2} aria-hidden />
              </button>
            </Tooltip>
            <span className="ml-1.5 text-[12.5px] text-muted-foreground tabular-nums">{position.n} of {position.of}</span>
          </div>
        )}
        <div className="ml-auto flex items-center gap-1">
          {app && (
            <>
              <Button size="xs" variant="ghost" onClick={() => onEdit(app)}><Pencil size={13} strokeWidth={2} aria-hidden />Edit</Button>
              <Button size="xs" variant="ghost" onClick={actions.tailor}><Sparkles size={13} strokeWidth={2} aria-hidden />Tailor resume</Button>
              <Menu
                ariaLabel="More actions"
                align="end"
                items={actions.moreItems}
                trigger={<button type="button" aria-label="More actions" className={iconButton}><Ellipsis size={16} strokeWidth={2} aria-hidden /></button>}
              />
            </>
          )}
          {split && app && (
            <Tooltip label={full ? "Shrink — back to the list" : "Expand to the full page"} shortcut={full ? "Esc" : "↵"}>
              <button type="button" onClick={full ? onShrink : onExpand} aria-label={full ? "Shrink" : "Expand"} aria-pressed={full} className={iconButton}>
                {full ? <Minimize2 size={15} strokeWidth={2} aria-hidden /> : <Maximize2 size={15} strokeWidth={2} aria-hidden />}
              </button>
            </Tooltip>
          )}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto">
        <div className={`px-6 py-6 ${full ? "max-w-[1180px] mx-auto" : ""}`}>
          {!id ? (
            <p className="py-24 text-center text-[13.5px] text-muted-foreground">Choose an application on the left.</p>
          ) : isPending ? (
            <ApplicationDetailSkeleton />
          ) : isError || !app ? (
            <div className="py-24 text-center">
              <p className="text-[15px] font-semibold text-foreground">This application isn't here</p>
              <p className="mt-1 text-[13.5px] text-muted-foreground">It may have been deleted, or the link is out of date.</p>
            </div>
          ) : (
            <div key={app._id} className="desk-pane-in">
              <ApplicationDetail app={app} jdLoading={isPlaceholderData} compact onEdit={() => onEdit(app)} onTailor={actions.tailor} onPreviewResume={actions.previewResume} />
            </div>
          )}
        </div>
      </div>
      {actions.dialogs}
    </section>
  );
}
