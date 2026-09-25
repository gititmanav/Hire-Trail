/** Shared switch control — the one toggle used across the app.
 *  Button-based (role="switch") so keyboard and screen-reader behavior come
 *  from real semantics, not a hidden-checkbox hack. */
interface Props {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  /** Accessible name — required because the visual label usually lives in a
   *  sibling SettingsRow, not inside the control. */
  label: string;
}

export default function Toggle({ checked, onChange, disabled, label }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed ${
        checked ? "bg-primary border-primary" : "bg-muted border-border"
      }`}
    >
      <span
        aria-hidden
        className={`inline-block h-5 w-5 rounded-full shadow-sm transition-transform duration-200 ${
          checked ? "translate-x-[22px] bg-primary-foreground" : "translate-x-[2px] bg-paper"
        }`}
      />
    </button>
  );
}
