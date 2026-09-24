/** Page toolbar: title (+ quiet meta) on the left, page actions on the right.
 *  Sticks flush beneath the global header (--app-header-h, published by
 *  Header) and bleeds to the content edges so its hairline spans the page.
 *  Every page adopts this during its revamp so the whole app reads as one. */
import { ReactNode } from "react";

export default function PageHeader({ title, meta, actions, titleAs: TitleTag = "h1" }: {
  title: ReactNode;
  /** "div" when the page's real heading lives below (e.g. a detail page whose
   *  header carries a breadcrumb). */
  titleAs?: "h1" | "div";
  /** Muted, tabular detail next to the title — e.g. "23 active". */
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div
      className="sticky z-20 -mx-4 md:-mx-6 -mt-4 md:-mt-6 mb-5 px-4 md:px-6 bg-background border-b border-border"
      style={{ top: "var(--app-header-h, 0px)" }}
    >
      <div className="min-h-14 py-2.5 flex items-center gap-3 flex-wrap">
        <div className="flex items-baseline gap-2 min-w-0">
          <TitleTag className="text-[15px] font-semibold text-foreground truncate">{title}</TitleTag>
          {meta && <span className="text-[13px] text-muted-foreground tabular-nums whitespace-nowrap">{meta}</span>}
        </div>
        {actions && <div className="ml-auto flex items-center gap-1.5 flex-wrap justify-end">{actions}</div>}
      </div>
    </div>
  );
}
