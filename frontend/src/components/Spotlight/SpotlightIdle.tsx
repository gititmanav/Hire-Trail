/** The search bar at rest, drawn without the motion engine — what the header
 *  paints while Spotlight.tsx (springs, results, the dock) loads alongside.
 *  Pixel-for-pixel the idle Spotlight, so the swap can't be seen. */
import { Search } from "lucide-react";

import { BAR_H } from "./geometry.ts";

export default function SpotlightIdle({ width }: { width: number }) {
  return (
    <div className="relative" style={{ width, height: BAR_H }} aria-hidden>
      <div className="spotlight-silhouette pointer-events-none absolute inset-0">
        <div className="absolute inset-0 rounded-full bg-popover" />
      </div>
      <Search size={15} strokeWidth={2} className="pointer-events-none absolute left-[14px] top-1/2 -translate-y-1/2 text-muted-foreground" />
      <span className="pointer-events-none absolute left-[35px] top-1/2 -translate-y-1/2 text-[16px] sm:text-[14px] leading-none text-muted-foreground">Search</span>
    </div>
  );
}
