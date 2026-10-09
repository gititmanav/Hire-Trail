/** Display → Columns (Table design only): a dropdown of the optional columns.
 *  Each row is a drag handle (reorder), the column's name and a checkbox
 *  (show / hide). The order is also what fits first on a narrow screen
 *  (views/ledger/columns.ts). Reordering works from the keyboard too: focus a
 *  handle, Space to lift, arrows to move, Space to drop, Escape to cancel. */
import { useRef, useState } from "react";
import { ChevronDown, GripVertical } from "lucide-react";
import {
  DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Popover, { PopoverLabel } from "../../../../components/ui/Popover.tsx";
import { CheckboxMark } from "../../../../components/ui/Checkbox.tsx";
import { COLUMNS, normalizeColumnOrder, type ColumnId } from "./columns.ts";

const LABEL = new Map(COLUMNS.map((c) => [c.id, c.label]));

export default function ColumnsMenu({ order, hidden, onOrderChange, onHiddenChange }: {
  order: ColumnId[];
  hidden: ColumnId[];
  onOrderChange: (order: ColumnId[]) => void;
  onHiddenChange: (hidden: ColumnId[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const ids = normalizeColumnOrder(order);
  const shown = ids.filter((id) => !hidden.includes(id)).length;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    onOrderChange(arrayMove(ids, ids.indexOf(active.id as ColumnId), ids.indexOf(over.id as ColumnId)));
  };
  const toggle = (id: ColumnId) => onHiddenChange(hidden.includes(id) ? hidden.filter((h) => h !== id) : [...hidden, id]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Columns: ${shown} of ${ids.length} shown`}
        className="h-7 pl-3 pr-2 text-[13px] inline-flex items-center gap-1.5 rounded-full bg-control border border-border text-foreground font-medium hover:border-muted-foreground/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
      >
        <span className="tabular-nums">{shown} of {ids.length}</span>
        <ChevronDown size={13} strokeWidth={1.8} aria-hidden className={`shrink-0 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      <Popover open={open} onOpenChange={setOpen} anchorRef={triggerRef} align="end" width={248} ariaLabel="Columns" className="p-1.5">
        <PopoverLabel>Columns</PopoverLabel>
        <p className="px-2.5 -mt-1 pb-1.5 text-[11.5px] text-muted-foreground">Drag to reorder. Role and stage always come first.</p>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <ul className="flex flex-col">
              {ids.map((id) => (
                <ColumnRow key={id} id={id} label={LABEL.get(id) ?? id} checked={!hidden.includes(id)} onToggle={() => toggle(id)} />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      </Popover>
    </>
  );
}

function ColumnRow({ id, label, checked, onToggle }: { id: ColumnId; label: string; checked: boolean; onToggle: () => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`relative flex items-center gap-1 rounded-lg ${isDragging ? "z-10 bg-popover shadow-floating" : ""}`}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Reorder ${label}`}
        className={`w-6 h-8 shrink-0 grid place-items-center rounded-md text-muted-foreground/60 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring touch-none ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
      >
        <GripVertical size={14} strokeWidth={1.8} aria-hidden />
      </button>
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        onClick={onToggle}
        className="flex-1 min-w-0 flex items-center justify-between gap-2 h-8 pl-1 pr-2 rounded-lg text-[13px] text-left hover:bg-control focus:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
      >
        <span className={`truncate ${checked ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
        <CheckboxMark checked={checked} />
      </button>
    </li>
  );
}
