/** Form field idiom: label (+ required mark), control, optional hint/error.
 *  Inputs are h-10 — roomier than the old h-9 — with one shared focus style. */
import { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes, forwardRef, useId } from "react";

export const controlCls =
  "w-full h-10 px-3 text-sm bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground/60 transition-shadow focus:outline-none focus:ring-2 focus:ring-ring/25 focus:border-ring disabled:opacity-50 disabled:cursor-not-allowed";

export function Field({
  label, required, hint, error, children, htmlFor,
}: {
  label: ReactNode;
  required?: boolean;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={htmlFor} className="block text-[13px] font-medium text-foreground mb-1.5">
        {label}
        {required && <span className="text-muted-foreground/70 ml-0.5" aria-hidden>*</span>}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-red-600 dark:text-red-400 mt-1.5">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{hint}</p>
      ) : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className = "", ...rest }, ref) {
    return <input ref={ref} className={`${controlCls} ${className}`} {...rest} />;
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className = "", rows = 3, ...rest }, ref) {
    return (
      <textarea
        ref={ref}
        rows={rows}
        className={`${controlCls} h-auto py-2.5 resize-y leading-relaxed ${className}`}
        {...rest}
      />
    );
  },
);

/** Convenience: Field + Input in one, with a stable generated id linking them. */
export function TextField({
  label, required, hint, error, ...inputProps
}: {
  label: ReactNode;
  required?: boolean;
  hint?: ReactNode;
  error?: ReactNode;
} & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <Field label={label} required={required} hint={hint} error={error} htmlFor={id}>
      <Input id={id} required={required} aria-invalid={error ? true : undefined} {...inputProps} />
    </Field>
  );
}
