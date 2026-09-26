/** Column model for the full-width table list.
 *
 *  Width is the whole point of this design, so optional columns appear as the
 *  container grows: the 1st optional column fits from 560px, the 2nd from
 *  700px, … (the `minWidth`s below, in default order). Users reorder and hide
 *  optional columns under Display → Columns; their order is also the fit
 *  priority, so the columns they put first are the ones that stay on a
 *  narrow screen. "role" and "stage" always show first — they identify the row. */

export type ColumnId =
  | "role" | "stage" | "inStage" | "fit" | "next" | "resume"
  | "applied" | "location" | "salary" | "source";

export interface ColumnDef {
  id: ColumnId;
  label: string;
  /** CSS grid track. */
  track: string;
  /** Container width (px) at which the column in this POSITION fits (see above). */
  minWidth: number;
  /** Can the user hide it? */
  optional: boolean;
  align?: "right";
}

export const COLUMNS: ColumnDef[] = [
  { id: "role",     label: "Role",      track: "minmax(240px, 2.4fr)", minWidth: 0,    optional: false },
  { id: "stage",    label: "Stage",     track: "118px",                minWidth: 0,    optional: false },
  { id: "inStage",  label: "In stage",  track: "84px",                 minWidth: 560,  optional: true },
  { id: "fit",      label: "Fit",       track: "64px",                 minWidth: 700,  optional: true },
  { id: "next",     label: "Next step", track: "minmax(150px, 1fr)",   minWidth: 860,  optional: true },
  { id: "resume",   label: "Resume",    track: "minmax(140px, 1fr)",   minWidth: 1060, optional: true },
  { id: "applied",  label: "Applied",   track: "92px",                 minWidth: 1200, optional: true },
  { id: "location", label: "Location",  track: "minmax(130px, 0.9fr)", minWidth: 1360, optional: true },
  { id: "salary",   label: "Salary",    track: "minmax(120px, 0.8fr)", minWidth: 1520, optional: true },
  { id: "source",   label: "Source",    track: "96px",                 minWidth: 1640, optional: true },
];

export const OPTIONAL_COLUMNS = COLUMNS.filter((c) => c.optional);

/** Default: every optional column on; the container width decides what fits. */
export const DEFAULT_HIDDEN: ColumnId[] = [];

/** Optional columns in their default order. */
export const DEFAULT_COLUMN_ORDER: ColumnId[] = OPTIONAL_COLUMNS.map((c) => c.id);

const BY_ID = new Map(COLUMNS.map((c) => [c.id, c]));
/** Width at which the 1st, 2nd, … optional column fits. */
const SLOT_WIDTHS = OPTIONAL_COLUMNS.map((c) => c.minWidth);

/** A stored order made whole: unknown ids dropped, duplicates removed, and
 *  optional columns it doesn't mention (added in a later release) appended. */
export function normalizeColumnOrder(order: readonly string[]): ColumnId[] {
  const seen = new Set<ColumnId>();
  for (const id of order) {
    const c = BY_ID.get(id as ColumnId);
    if (c?.optional) seen.add(c.id);
  }
  for (const id of DEFAULT_COLUMN_ORDER) seen.add(id);
  return [...seen];
}

export const isColumnOrder = (v: unknown): v is ColumnId[] => Array.isArray(v) && v.every((x) => typeof x === "string");

/** The columns a table of `width` px shows: role + stage, then the user's
 *  visible optional columns in their order, as many as fit. */
export function tableColumns(order: readonly ColumnId[], hidden: readonly ColumnId[], width: number): ColumnDef[] {
  const fits = SLOT_WIDTHS.filter((w) => width >= w).length;
  const optional = normalizeColumnOrder(order).filter((id) => !hidden.includes(id)).slice(0, fits);
  return [...COLUMNS.filter((c) => !c.optional), ...optional.map((id) => BY_ID.get(id)!)];
}

export type TableGrouping = "stage" | "company" | "none";
