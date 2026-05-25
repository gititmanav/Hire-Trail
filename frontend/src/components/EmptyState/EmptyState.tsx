/**
 * Branded empty-state shell. Two intents:
 *
 *   - `welcome`  → user has no data yet. Big illustration, encouraging copy,
 *     primary "do this first" CTA + 1-2 alternates ("install extension", "import").
 *   - `filtered` → list is empty because of an active filter / search. Compact,
 *     gentler illustration, "Clear filters" CTA.
 *
 * One reusable component used everywhere — keeps the visual language consistent
 * across Applications, Contacts, Companies, Deadlines, Resumes.
 */
import { memo, ReactNode } from "react";
import { Link } from "react-router-dom";

export type EmptyStateAction = {
  label: string;
  onClick?: () => void;
  href?: string;
  variant?: "primary" | "secondary";
  icon?: ReactNode;
};

interface Props {
  intent?: "welcome" | "filtered";
  /** Inline SVG illustration. Defaults to a generic "open-folder" mark. */
  illustration?: ReactNode;
  title: string;
  description?: string;
  actions?: EmptyStateAction[];
  className?: string;
}

function DefaultIllustration() {
  return (
    <svg width="120" height="96" viewBox="0 0 240 192" fill="none" aria-hidden>
      <defs>
        <linearGradient id="es-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.18" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.04" />
        </linearGradient>
      </defs>
      <rect x="40" y="56" width="160" height="100" rx="10" fill="url(#es-grad)" stroke="hsl(var(--border))" strokeWidth="1.5" />
      <rect x="56" y="40" width="68" height="20" rx="4" fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth="1.5" />
      <line x1="60" y1="86" x2="180" y2="86" stroke="hsl(var(--border))" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="60" y1="106" x2="160" y2="106" stroke="hsl(var(--border))" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="60" y1="126" x2="140" y2="126" stroke="hsl(var(--border))" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="195" cy="55" r="14" fill="hsl(var(--primary))" />
      <path d="M195 49v12M189 55h12" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function FilteredIllustration() {
  return (
    <svg width="96" height="80" viewBox="0 0 192 160" fill="none" aria-hidden>
      <circle cx="80" cy="76" r="36" stroke="hsl(var(--border))" strokeWidth="3" />
      <line x1="106" y1="102" x2="138" y2="134" stroke="hsl(var(--border))" strokeWidth="3" strokeLinecap="round" />
      <path d="M62 76h36M80 58v36" stroke="hsl(var(--muted-foreground))" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function EmptyStateImpl({ intent = "welcome", illustration, title, description, actions, className = "" }: Props) {
  const isWelcome = intent === "welcome";
  return (
    <div
      role="status"
      className={`bg-card border border-border rounded-xl ${isWelcome ? "px-6 py-12 md:py-16" : "px-6 py-10"} flex flex-col items-center text-center ${className}`}
    >
      <div className={`${isWelcome ? "mb-5" : "mb-4"} opacity-90`}>
        {illustration ?? (isWelcome ? <DefaultIllustration /> : <FilteredIllustration />)}
      </div>
      <h3 className={`${isWelcome ? "text-lg" : "text-base"} font-semibold text-foreground mb-1.5 tracking-tight`}>
        {title}
      </h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-md mb-5 leading-relaxed">{description}</p>
      )}
      {actions && actions.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {actions.map((a, i) => {
            const cls = a.variant === "secondary"
              ? "btn-secondary"
              : "btn-accent";
            const inner = (
              <>
                {a.icon && <span className="mr-1.5 inline-flex">{a.icon}</span>}
                {a.label}
              </>
            );
            if (a.href) {
              // External href (http(s)://) → plain anchor with new-tab. Internal
              // routes use react-router-dom <Link> so navigating doesn't trigger
              // a full-page reload that throws away client state.
              const isExternal = /^https?:\/\//i.test(a.href);
              if (isExternal) {
                return (
                  <a key={i} href={a.href} target="_blank" rel="noopener noreferrer" className={`${cls} inline-flex items-center`}>
                    {inner}
                  </a>
                );
              }
              return (
                <Link key={i} to={a.href} className={`${cls} inline-flex items-center`}>
                  {inner}
                </Link>
              );
            }
            return (
              <button key={i} type="button" onClick={a.onClick} className={`${cls} inline-flex items-center`}>
                {inner}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default memo(EmptyStateImpl);
