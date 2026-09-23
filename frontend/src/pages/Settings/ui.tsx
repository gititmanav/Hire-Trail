/** Shared building blocks for the settings area — one card/row/field idiom so
 *  every settings page reads as a single hand. Rows are label-left,
 *  control-right (Sora/Linear style) and stack on small screens. */
import type { ReactNode } from "react";

export const inputCls =
  "w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring transition-shadow";

/** Page header: title + one-line description. */
export function SettingsHeader({ title, description, badge }: { title: string; description?: ReactNode; badge?: ReactNode }) {
  return (
    <header className="mb-6">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-semibold text-foreground">{title}</h1>
        {badge}
      </div>
      {description && <p className="text-sm text-muted-foreground mt-1 leading-relaxed max-w-2xl">{description}</p>}
    </header>
  );
}

/** Section label above a card (small, quiet). */
export function SettingsSection({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-8 first:mt-0">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {description && <p className="text-xs text-muted-foreground mt-0.5 mb-3 leading-relaxed max-w-2xl">{description}</p>}
      {!description && <div className="mb-3" />}
      {children}
    </section>
  );
}

/** A bordered card whose children are divided rows. */
export function SettingsCard({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">{children}</div>;
}

/** One setting: label + optional description on the left, control on the right.
 *  `stack` renders the control full-width under the label (textareas, pickers). */
export function SettingsRow({
  title, description, children, stack,
}: {
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  stack?: boolean;
}) {
  if (stack) {
    return (
      <div className="px-5 py-4">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description && <p className="text-xs text-muted-foreground mt-1 leading-relaxed max-w-2xl">{description}</p>}
        <div className="mt-3">{children}</div>
      </div>
    );
  }
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-6 px-5 py-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description && <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{description}</p>}
      </div>
      {children && <div className="w-full sm:w-auto sm:max-w-[55%] min-w-0 flex sm:justify-end">{children}</div>}
    </div>
  );
}
