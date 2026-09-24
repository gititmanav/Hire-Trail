/** Column model for the full-width table list.
 *
 *  Width is the whole point of this design, so columns appear by priority as
 *  the container grows (`minWidth` is the container width at which a column
 *  starts to show) and users can hide any optional column under Display.
 *  "role" and "stage" always show — they identify the row. */

export type ColumnId =
  | "role" | "stage" | "inStage" | "fit" | "next" | "resume"
  | "applied" | "location" | "salary" | "source";

export interface ColumnDef {
  id: ColumnId;
  label: string;
  /** CSS grid track. */
  track: string;
  /** Container width (px) at which the column becomes visible. */
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

export type TableGrouping = "stage" | "company" | "none";
