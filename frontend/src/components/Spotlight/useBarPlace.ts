/** Where the header's search goes — shared by the app's header and Admin's.
 *  Centred in the row when there's room for the dock; otherwise filling the
 *  space between the clusters (search only). On a narrow bar the results
 *  panel spans the screen with 16px gutters. */
import { useLayoutEffect, useRef, useState } from "react";

import { DOCK_MIN_WIDTH } from "./geometry.ts";

/** The search's widest, and the room kept between it and the clusters either side. */
const BAR_MAX = 420;
const BAR_GAP = 16;
/** Narrower than this there's no useful bar. */
const BAR_MIN = 120;

interface BarPlace { left: number; width: number; panel: { x: number; width: number } }

export function useBarPlace() {
  const rowRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<BarPlace | null>(null);
  useLayoutEffect(() => {
    const row = rowRef.current, start = startRef.current, end = endRef.current;
    if (!row || !start || !end) return;
    const measure = () => {
      const r = row.getBoundingClientRect();
      const cs = getComputedStyle(row);
      const padL = parseFloat(cs.paddingLeft);
      const inner = r.width - padL - parseFloat(cs.paddingRight);
      const L = start.offsetWidth, R = end.offsetWidth;
      const centred = inner - 2 * Math.max(L, R) - 2 * BAR_GAP;
      const width = Math.floor(centred >= DOCK_MIN_WIDTH ? Math.min(BAR_MAX, centred) : Math.min(BAR_MAX, inner - L - R - 2 * BAR_GAP));
      if (width < BAR_MIN) { setPlace(null); return; }
      const left = Math.round(centred >= DOCK_MIN_WIDTH ? (r.width - width) / 2 : padL + L + BAR_GAP);
      const roomy = width >= 360;
      const vw = document.documentElement.clientWidth;
      const panel = roomy ? { x: 0, width } : { x: 16 - (r.left + left), width: Math.min(BAR_MAX, vw - 32) };
      setPlace((p) => (p && p.left === left && p.width === width && p.panel.x === panel.x && p.panel.width === panel.width ? p : { left, width, panel }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(row);
    ro.observe(start);
    ro.observe(end);
    return () => ro.disconnect();
  }, []);
  return { rowRef, startRef, endRef, place };
}
