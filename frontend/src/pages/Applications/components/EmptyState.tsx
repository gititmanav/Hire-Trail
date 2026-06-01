/**
 * Rich empty state for the Applications list. Two flavors:
 *   - "welcome": user has zero applications total — show the funnel + 3
 *     quick-start CTAs (add manually, install the extension, import CSV).
 *   - "filtered": user has applications, but current filters return nothing —
 *     suggest clearing the filter.
 *
 * Inline SVG, no asset dependencies — survives a clean-room install.
 */

import { Search, Plus, Puzzle, Upload } from "lucide-react";

interface Props {
  mode: "welcome" | "filtered";
  onAddManually: () => void;
  onImport: () => void;
  onClearFilters?: () => void;
  extensionUrl?: string;
}

export default function EmptyState({ mode, onAddManually, onImport, onClearFilters, extensionUrl = "/" }: Props) {
  if (mode === "filtered") {
    return (
      <div className="card-premium card-no-lift p-10 text-center mt-4">
        <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
          <Search size={20} strokeWidth={1.8} aria-hidden />
        </div>
        <h3 className="text-base font-semibold text-foreground mb-1">No matches for these filters</h3>
        <p className="text-sm text-muted-foreground mb-4">Try clearing your search or stage filter.</p>
        {onClearFilters && (
          <button onClick={onClearFilters} className="btn-secondary">Clear filters</button>
        )}
      </div>
    );
  }

  return (
    <div className="card-premium card-no-lift p-8 mt-4 fade-up overflow-hidden">
      <div className="grid grid-cols-1 md:grid-cols-[1fr_220px] gap-6 items-center">
        <div>
          <span className="inline-block text-[11px] font-semibold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-full mb-3">
            Welcome to HireTrail
          </span>
          <h2 className="text-xl font-bold text-foreground tracking-tight mb-1.5">
            Let's track your first application
          </h2>
          <p className="text-sm text-muted-foreground max-w-md mb-5 leading-relaxed">
            Add a job manually, or save the back-and-forth — install the browser extension and one click captures the JD from LinkedIn, Indeed, Greenhouse, Lever, Glassdoor and Workday.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onAddManually}
              className="btn-accent"
            >
              <Plus size={14} strokeWidth={2} aria-hidden />
              Add application
            </button>
            <a
              href={extensionUrl}
              className="btn-secondary"
              target={extensionUrl.startsWith("http") ? "_blank" : undefined}
              rel={extensionUrl.startsWith("http") ? "noopener noreferrer" : undefined}
            >
              <Puzzle size={14} strokeWidth={1.8} aria-hidden />
              Install extension
            </a>
            <button
              type="button"
              onClick={onImport}
              className="btn-secondary"
            >
              <Upload size={14} strokeWidth={1.8} aria-hidden />
              Import CSV
            </button>
          </div>
        </div>

        {/* Decorative funnel illustration */}
        <div className="hidden md:flex justify-center">
          <svg width="200" height="160" viewBox="0 0 200 160" fill="none" aria-hidden>
            <defs>
              <linearGradient id="funnelGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
              </linearGradient>
            </defs>
            {/* Funnel bands */}
            <rect x="20" y="20" width="160" height="22" rx="4" fill="#94a3b8" opacity="0.18" />
            <rect x="38" y="50" width="124" height="22" rx="4" fill="#3B82F6" opacity="0.25" />
            <rect x="58" y="80" width="84"  height="22" rx="4" fill="#F59E0B" opacity="0.25" />
            <rect x="76" y="110" width="48" height="22" rx="4" fill="#8B5CF6" opacity="0.30" />
            {/* Apex offer band */}
            <rect x="88" y="140" width="24" height="14" rx="3" fill="#10B981" opacity="0.45" />
            {/* Stage dots on the right */}
            <circle cx="195" cy="31" r="3" fill="#94a3b8" />
            <circle cx="195" cy="61" r="3" fill="#3B82F6" />
            <circle cx="195" cy="91" r="3" fill="#F59E0B" />
            <circle cx="195" cy="121" r="3" fill="#8B5CF6" />
            <circle cx="195" cy="147" r="3" fill="#10B981" />
            {/* Ambient glow */}
            <rect x="0" y="0" width="200" height="160" fill="url(#funnelGrad)" />
          </svg>
        </div>
      </div>
    </div>
  );
}
