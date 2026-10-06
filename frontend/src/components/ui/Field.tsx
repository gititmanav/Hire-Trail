/** Form field idiom: label (+ required mark), control, optional hint/error.
 *  On a page the control is a bordered h-10 field; inside a dialog it's plain
 *  text on the surface (ui/fieldLook.ts — ui/Modal switches it). */
import { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes, forwardRef, useId } from "react";

import { boxControlCls, useControlClass, useFieldLook } from "./fieldLook.ts";

/** The bordered field's classes, for the few page controls built by hand. */
export const controlCls = boxControlCls;

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
  const plain = useFieldLook() === "plain";
  return (
    <div className="min-w-0">
      <label htmlFor={htmlFor} className={plain ? "block text-[12.5px] font-medium text-muted-foreground mb-1.5" : "block text-[13px] font-medium text-foreground mb-1.5"}>
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
    const control = useControlClass();
    return <input ref={ref} className={`${control} ${className}`} {...rest} />;
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className = "", rows = 3, ...rest }, ref) {
    const plain = useFieldLook() === "plain";
    const control = useControlClass();
    return (
      <textarea
        ref={ref}
        rows={rows}
        // Plain: grows with its text (field-sizing), from its rows' height.
        className={`${control} h-auto leading-relaxed ${plain ? "py-0 resize-none [field-sizing:content] min-h-[4.5rem]" : "py-2.5 resize-y"} ${className}`}
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

/** Field + Textarea in one, linked the same way. */
export function TextAreaField({
  label, required, hint, error, ...textareaProps
}: {
  label: ReactNode;
  required?: boolean;
  hint?: ReactNode;
  error?: ReactNode;
} & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  return (
    <Field label={label} required={required} hint={hint} error={error} htmlFor={id}>
      <Textarea id={id} required={required} aria-invalid={error ? true : undefined} {...textareaProps} />
    </Field>
  );
}
