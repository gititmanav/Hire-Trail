/** The checkbox mark — a token-drawn box with a check, for rows that act as
 *  checkboxes (the row is the control: role="checkbox" + aria-checked). No
 *  native checkbox in product surfaces. */
import { Check } from "lucide-react";

export function CheckboxMark({ checked, className = "" }: { checked: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-grid place-items-center w-4 h-4 rounded-[5px] border transition-colors duration-150 ${
        checked ? "bg-primary border-primary text-primary-foreground" : "bg-background border-input"
      } ${className}`}
    >
      <Check size={11} strokeWidth={3} className={`transition-opacity duration-150 ${checked ? "opacity-100" : "opacity-0"}`} />
    </span>
  );
}
