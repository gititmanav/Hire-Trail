/** Shared button. One place decides height, focus ring, and the loading state
 *  so every dialog footer reads identically. */
import { ButtonHTMLAttributes, ReactNode, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-primary text-primary-foreground hover:bg-primary/90 border border-transparent",
  secondary: "bg-transparent text-foreground border border-border hover:bg-muted",
  ghost: "bg-transparent text-muted-foreground border border-transparent hover:text-foreground hover:bg-muted",
  danger: "bg-red-600 text-white hover:bg-red-700 border border-transparent",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "sm" | "md";
  loading?: boolean;
  children: ReactNode;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", loading = false, disabled, className = "", children, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={`relative inline-flex items-center justify-center gap-1.5 font-medium rounded-lg transition-colors select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed ${
        size === "sm" ? "h-8 px-3 text-[13px]" : "h-9 px-4 text-sm"
      } ${VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {loading && (
        <span
          aria-hidden
          className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin"
        />
      )}
      {children}
    </button>
  );
});

export default Button;
