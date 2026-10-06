/** A short text value as a chip — Location, Salary, Job type in a dialog.
 *  A real input inside the shared chip, exactly as wide as its text (the
 *  `size` attribute, so it works everywhere), the icon leading. Empty, it
 *  reads as its placeholder in the muted ink. */
import type { ReactNode } from "react";

import { chipCls } from "./fieldLook.ts";

export default function ChipInput({ icon, value, onChange, placeholder, ariaLabel, type = "text", maxLength = 80 }: {
  icon?: ReactNode;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  ariaLabel?: string;
  type?: "text" | "url";
  maxLength?: number;
}) {
  return (
    <label className={`${chipCls} pl-2.5 pr-3 cursor-text focus-within:border-muted-foreground/40 focus-within:ring-2 focus-within:ring-ring/25`}>
      {icon && <span className="shrink-0 text-muted-foreground inline-flex">{icon}</span>}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        maxLength={maxLength}
        size={Math.max(2, (value || placeholder).length)}
        className="min-w-0 max-w-[16rem] bg-transparent font-medium text-foreground placeholder:text-muted-foreground placeholder:font-medium outline-none"
      />
    </label>
  );
}
