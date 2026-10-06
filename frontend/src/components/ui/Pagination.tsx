/** The one numbered pager (Applications' Classic list, Contacts, Deadlines):
 *  "1–20 of 220" on the left; Previous · five page numbers · Next on the
 *  right. It lays out by its own width (App.css "Pagination") — narrower
 *  than the full set, it becomes ‹ Page 3 of 11 ›, so it never runs off a
 *  phone. Renders nothing for a single page. */
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Pagination as PageInfo } from "../../types";

const btn = "h-8 inline-flex items-center justify-center text-[13px] border border-border rounded-lg text-secondary-foreground hover:bg-muted disabled:opacity-30 disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** The five page numbers around the current one. */
function window5(page: number, pages: number): number[] {
  const n = Math.min(pages, 5);
  const start = pages <= 5 ? 1 : page <= 3 ? 1 : page >= pages - 2 ? pages - 4 : page - 2;
  return Array.from({ length: n }, (_, i) => start + i);
}

export default function Pagination({ page, pag, onPage, className = "" }: {
  page: number;
  pag: PageInfo;
  onPage: (page: number) => void;
  className?: string;
}) {
  if (pag.pages <= 1) return null;
  const from = (pag.page - 1) * pag.limit + 1;
  const to = Math.min(pag.page * pag.limit, pag.total);
  return (
    <nav aria-label="Pages" className={`pager ${className}`}>
      <div className="pager-row">
        <span className="text-[13px] text-muted-foreground tabular-nums whitespace-nowrap">{from}–{to} of {pag.total}</span>
        <div className="flex items-center gap-1">
          <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page" className={`${btn} pager-step`}>
            <span className="pager-word">Previous</span>
            <ChevronLeft size={15} strokeWidth={2} className="pager-chevron" aria-hidden />
          </button>
          <span className="pager-pages gap-1">
            {window5(page, pag.pages).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => onPage(p)}
                aria-current={p === page ? "page" : undefined}
                className={`w-8 h-8 text-[13px] rounded-lg tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  p === page ? "bg-primary text-primary-foreground" : "border border-border text-secondary-foreground hover:bg-muted"
                }`}
              >
                {p}
              </button>
            ))}
          </span>
          <span className="pager-of text-[13px] text-muted-foreground tabular-nums whitespace-nowrap px-1.5">Page {page} of {pag.pages}</span>
          <button type="button" disabled={page >= pag.pages} onClick={() => onPage(page + 1)} aria-label="Next page" className={`${btn} pager-step`}>
            <span className="pager-word">Next</span>
            <ChevronRight size={15} strokeWidth={2} className="pager-chevron" aria-hidden />
          </button>
        </div>
      </div>
    </nav>
  );
}
