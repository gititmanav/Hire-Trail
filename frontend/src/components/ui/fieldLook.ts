/** How form controls draw. "box" — on a page: a bordered field. "plain" —
 *  inside a dialog (ui/Modal provides it): Sora's look, text sitting on the
 *  surface with a soft fill only on hover / focus, and selects and dates as
 *  the shared chip. Every field primitive reads this, so a dialog can't get
 *  it wrong. Custom inputs take `useControlClass()`. */
import { createContext, useContext } from "react";

export type FieldLook = "box" | "plain";
export const FieldLookContext = createContext<FieldLook>("box");
export const useFieldLook = (): FieldLook => useContext(FieldLookContext);

/** The bordered field (pages). */
export const boxControlCls =
  "w-full h-10 px-3 text-sm bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground/60 transition-shadow focus:outline-none focus:ring-2 focus:ring-ring/25 focus:border-ring disabled:opacity-50 disabled:cursor-not-allowed";

/** The plain field (dialogs): flush with its label at rest; hover and focus
 *  lay a soft fill under it that reaches 6px past the text (a spread shadow,
 *  so nothing shifts). An invalid field tints red. */
export const plainControlCls =
  "w-full h-8 px-0 bg-transparent text-[14px] text-foreground placeholder:text-muted-foreground/55 rounded-md transition-[background-color,box-shadow] duration-150 " +
  "enabled:hover:bg-control/55 enabled:hover:shadow-[0_0_0_6px_hsl(var(--control)/0.55)] " +
  "focus:outline-none focus:bg-control/85 focus:shadow-[0_0_0_6px_hsl(var(--control)/0.85)] " +
  "aria-[invalid=true]:bg-[rgb(var(--palette-danger)/0.08)] aria-[invalid=true]:shadow-[0_0_0_6px_rgb(var(--palette-danger)/0.08)] " +
  "disabled:opacity-50 disabled:cursor-not-allowed";

/** The chip — a select's or a date's trigger in a dialog (and Select's "pill"). */
export const chipCls =
  "max-w-full h-7 pl-3 pr-2 text-[13px] inline-flex items-center gap-1.5 rounded-full bg-control border border-border text-foreground font-medium transition-colors hover:border-muted-foreground/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:cursor-not-allowed";

export function useControlClass(): string {
  return useFieldLook() === "plain" ? plainControlCls : boxControlCls;
}
