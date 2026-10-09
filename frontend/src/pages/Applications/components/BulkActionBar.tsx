/** The selection bar: rises from the bottom when rows are selected and sinks
 *  away when the selection clears (it stays mounted, so both ways move —
 *  the last count stays on it while it leaves). Pinned to the viewport so it
 *  stays in reach while you scroll a long list. */
import { memo, useLayoutEffect, useRef } from "react";
import { X } from "lucide-react";
import Tooltip from "../../../components/ui/Tooltip.tsx";

interface Props {
  count: number;
  /** Rows in view — offers "Select all N" while the selection is partial. */
  total: number;
  archived: boolean;
  onSelectAll: () => void;
  onArchive: () => void;
  onUnarchive: () => void;
  onDelete: () => void;
  onClear: () => void;
}

const btn = "h-7 px-2.5 inline-flex items-center rounded-md text-[13px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-background/60";

function BulkActionBarImpl({ count, total, archived, onSelectAll, onArchive, onUnarchive, onDelete, onClear }: Props) {
  const shown = count > 0;
  const last = useRef(count);
  if (shown) last.current = count;
  const n = shown ? count : last.current;
  // Leaving, it's a picture — no focus, no clicks.
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => { ref.current?.toggleAttribute("inert", !shown); }, [shown]);
  return (
    <div
      ref={ref}
      role="region"
      aria-label={`${n} application${n === 1 ? "" : "s"} selected`}
      aria-hidden={!shown}
      className={`fixed bottom-6 left-1/2 z-30 flex items-center gap-1 pl-3.5 pr-1.5 h-11 rounded-xl bg-foreground text-background shadow-floating transition-[transform,opacity] duration-200 ease-smooth motion-reduce:transition-none ${
        shown ? "opacity-100 -translate-x-1/2 translate-y-0" : "opacity-0 -translate-x-1/2 translate-y-[calc(100%+1.5rem)] pointer-events-none"
      }`}
    >
      <span className="text-[13px] font-semibold tabular-nums whitespace-nowrap mr-1">{n} selected</span>
      {n < total && (
        <button type="button" onClick={onSelectAll} className={`${btn} text-background/75 hover:text-background hover:bg-background/10`}>
          Select all {total.toLocaleString()}
        </button>
      )}
      <span className="w-px h-5 bg-background/20 mx-1" aria-hidden />
      <button type="button" onClick={archived ? onUnarchive : onArchive} className={`${btn} hover:bg-background/10`}>
        {archived ? "Restore" : "Archive"}
      </button>
      <button type="button" onClick={onDelete} className={`${btn} text-red-300 dark:text-red-600 hover:bg-red-500/15`}>
        Delete
      </button>
      <span className="w-px h-5 bg-background/20 mx-1" aria-hidden />
      <Tooltip label="Clear selection" shortcut="Esc" side="top">
        <button type="button" onClick={onClear} aria-label="Clear selection" className={`${btn} w-7 px-0 justify-center text-background/70 hover:text-background hover:bg-background/10`}>
          <X size={15} strokeWidth={2} aria-hidden />
        </button>
      </Tooltip>
    </div>
  );
}

export default memo(BulkActionBarImpl);
