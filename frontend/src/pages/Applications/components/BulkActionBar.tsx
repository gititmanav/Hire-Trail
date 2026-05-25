/**
 * Floating bulk-action bar that slides in when one or more rows are selected.
 * Pinned to the bottom of the viewport so it stays in reach while scrolling
 * through a long list.
 */
import { memo } from "react";

interface Props {
  count: number;
  archived: boolean;
  onArchive: () => void;
  onUnarchive: () => void;
  onDelete: () => void;
  onClear: () => void;
}

function BulkActionBarImpl({ count, archived, onArchive, onUnarchive, onDelete, onClear }: Props) {
  return (
    <div
      role="region"
      aria-label={`${count} application${count === 1 ? "" : "s"} selected`}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-3 py-2 rounded-xl bg-foreground text-background shadow-2xl ring-1 ring-black/10 animate-in"
    >
      <span className="text-sm font-medium tabular-nums">
        {count} selected
      </span>
      <span className="w-px h-5 bg-background/20 mx-1" aria-hidden />
      <button
        onClick={archived ? onUnarchive : onArchive}
        className="px-3 py-1 text-sm rounded-md hover:bg-background/10"
      >
        {archived ? "Unarchive" : "Archive"}
      </button>
      <button
        onClick={onDelete}
        className="px-3 py-1 text-sm rounded-md text-red-300 hover:bg-red-500/15"
      >
        Delete
      </button>
      <span className="w-px h-5 bg-background/20 mx-1" aria-hidden />
      <button
        onClick={onClear}
        className="px-2 py-1 text-xs rounded-md text-background/70 hover:bg-background/10"
        aria-label="Clear selection"
      >
        Clear (Esc)
      </button>
    </div>
  );
}

export default memo(BulkActionBarImpl);
