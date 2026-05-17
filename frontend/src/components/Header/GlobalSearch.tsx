/**
 * Global cmd+K palette. Indexes applications, companies, contacts, deadlines
 * on open, filters client-side, and navigates with arrow keys + enter.
 *
 * Trade-off: client-side filter is fine up to a few thousand records.
 * If usage grows past that, swap in a backend /search endpoint.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { applicationsAPI, companiesAPI, contactsAPI, deadlinesAPI } from "../../utils/api.ts";
import type { Application, Company, Contact, Deadline } from "../../types";

type ResultKind = "application" | "company" | "contact" | "deadline";

interface Result {
  kind: ResultKind;
  id: string;
  title: string;
  subtitle: string;
  route: string;
}

const KIND_LABEL: Record<ResultKind, string> = {
  application: "Application",
  company: "Company",
  contact: "Contact",
  deadline: "Deadline",
};

const KIND_TONE: Record<ResultKind, string> = {
  application: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  company: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200",
  contact: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  deadline: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200",
};

function isMac(): boolean {
  return typeof navigator !== "undefined" && /Mac/.test(navigator.platform);
}

export default function GlobalSearch() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState<Result[]>([]);
  const [loadingIndex, setLoadingIndex] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const openPalette = useCallback(() => setOpen(true), []);
  const closePalette = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActiveIdx(0);
  }, []);

  // Global cmd+K / ctrl+K shortcut
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape" && open) {
        closePalette();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, closePalette]);

  // Build the index when the palette opens
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadingIndex(true);

    (async () => {
      try {
        const empty = { data: [], pagination: { page: 1, limit: 0, total: 0, pages: 0 } };
        const [appsRes, companiesRes, contactsRes, deadlines] = await Promise.all([
          applicationsAPI.getAll({ limit: 500 }).catch(() => empty),
          companiesAPI.getAll({ limit: 500 }).catch(() => empty),
          contactsAPI.getAll({ limit: 500 }).catch(() => empty),
          deadlinesAPI.getAllAggregated({ status: "all" }).catch(() => [] as Deadline[]),
        ]);
        if (cancelled) return;

        const apps: Result[] = (appsRes.data as Application[]).map((a) => ({
          kind: "application",
          id: a._id,
          title: `${a.role} · ${a.company}`,
          subtitle: `${a.stage} · ${new Date(a.applicationDate).toLocaleDateString()}`,
          route: `/applications?focus=${a._id}`,
        }));

        const cos: Result[] = (companiesRes.data as Company[]).map((c) => ({
          kind: "company",
          id: c._id,
          title: c.name,
          subtitle: c.domain || c.website || "Company",
          route: `/companies?focus=${c._id}`,
        }));

        const cts: Result[] = (contactsRes.data as Contact[]).map((c) => ({
          kind: "contact",
          id: c._id,
          title: c.name,
          subtitle: [c.role, c.company].filter(Boolean).join(" · ") || c.linkedinUrl || "Contact",
          route: `/contacts?focus=${c._id}`,
        }));

        const dls: Result[] = (deadlines || []).map((d) => ({
          kind: "deadline",
          id: d._id,
          title: d.notes || d.type,
          subtitle: `Due ${new Date(d.dueDate).toLocaleDateString()}`,
          route: `/deadlines?focus=${d._id}`,
        }));

        setIndex([...apps, ...cos, ...cts, ...dls]);
      } finally {
        if (!cancelled) setLoadingIndex(false);
      }
    })();

    return () => { cancelled = true; };
  }, [open]);

  // Focus the input once mounted
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return index.slice(0, 30);
    return index
      .filter((r) => r.title.toLowerCase().includes(q) || r.subtitle.toLowerCase().includes(q))
      .slice(0, 30);
  }, [index, query]);

  // Reset active index when filter changes
  useEffect(() => { setActiveIdx(0); }, [query]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      const sel = filtered[activeIdx];
      if (sel) {
        navigate(sel.route);
        closePalette();
      }
    }
  };

  // Keep active row in view
  useEffect(() => {
    const node = listRef.current?.children[activeIdx] as HTMLElement | undefined;
    node?.scrollIntoView({ block: "nearest" });
  }, [activeIdx, filtered.length]);

  const shortcutLabel = isMac() ? "⌘K" : "Ctrl K";

  return (
    <>
      <button
        type="button"
        onClick={openPalette}
        className="hidden md:flex items-center gap-2 px-3 h-9 rounded-lg border border-border text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors min-w-[200px]"
        title="Search applications, companies, contacts, deadlines"
        aria-label="Open global search"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <span className="flex-1 text-left">Search…</span>
        <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">
          {shortcutLabel}
        </kbd>
      </button>

      {/* Mobile icon trigger */}
      <button
        type="button"
        onClick={openPalette}
        className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-secondary-foreground"
        title="Search"
        aria-label="Open search"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[80] bg-background/60 backdrop-blur-sm flex items-start justify-center pt-[12vh] px-4"
          onClick={closePalette}
        >
          <div
            className="w-full max-w-[560px] bg-card border border-border rounded-xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 px-4 h-12 border-b border-border">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                <circle cx="11" cy="11" r="7" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Search applications, companies, contacts, deadlines…"
                className="flex-1 bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground"
              />
              <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">esc</kbd>
            </div>

            <div className="max-h-[420px] overflow-y-auto">
              {loadingIndex && index.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">Loading…</p>
              ) : filtered.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                  {query ? "No matches." : "Start typing to search."}
                </p>
              ) : (
                <ul ref={listRef} className="py-1">
                  {filtered.map((r, i) => (
                    <li
                      key={`${r.kind}:${r.id}`}
                      onMouseEnter={() => setActiveIdx(i)}
                      onClick={() => { navigate(r.route); closePalette(); }}
                      className={`px-4 py-2 flex items-center gap-3 cursor-pointer ${i === activeIdx ? "bg-muted/60" : ""}`}
                    >
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${KIND_TONE[r.kind]}`}>
                        {KIND_LABEL[r.kind]}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-foreground truncate">{r.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{r.subtitle}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="px-4 py-2 border-t border-border bg-muted/30 flex items-center justify-between text-[10px] text-muted-foreground">
              <span>↑↓ to navigate · ↵ to open</span>
              <span>{filtered.length} {filtered.length === 1 ? "result" : "results"}</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
