/** Page toolbar: title (+ quiet meta) on the left, page actions on the right.
 *  It is the main section's sub-header: pinned to the top of the scrolling
 *  card and bled to its edges so the hairline spans the page. Publishes its
 *  live height as --page-header-h so sticky bars below it (list group strips)
 *  pin flush beneath it at any wrap state.
 *  Every page adopts this during its revamp so the whole app reads as one. */
import { ReactNode, useLayoutEffect, useRef } from "react";

export default function PageHeader({ title, meta, actions, titleAs: TitleTag = "h1" }: {
  title: ReactNode;
  /** "div" when the page's real heading lives below (e.g. a detail page whose
   *  header carries a breadcrumb). */
  titleAs?: "h1" | "div";
  /** Muted, tabular detail next to the title — e.g. "23 active". */
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement;
    // Only on a real change: a custom property on <html> restyles the whole
    // document, and width-only resizes (the sidebar animating) must stay cheap.
    let last = -1;
    const publish = () => {
      const h = el.offsetHeight;
      if (h === last) return;
      last = h;
      root.style.setProperty("--page-header-h", `${h}px`);
    };
    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    return () => { ro.disconnect(); root.style.removeProperty("--page-header-h"); };
  }, []);

  return (
    <div ref={ref} className="sticky top-0 z-20 -mx-4 md:-mx-6 -mt-4 md:-mt-6 mb-5 px-4 md:px-6 bg-background border-b border-border">
      <div className="min-h-14 py-2.5 flex items-center gap-3 flex-wrap">
        <div className="flex items-baseline gap-2 min-w-0">
          <TitleTag className="text-base font-semibold text-foreground truncate">{title}</TitleTag>
          {meta && <span className="text-[13px] text-muted-foreground tabular-nums whitespace-nowrap">{meta}</span>}
        </div>
        {actions && <div className="ml-auto flex items-center gap-1.5 flex-wrap justify-end">{actions}</div>}
      </div>
    </div>
  );
}
