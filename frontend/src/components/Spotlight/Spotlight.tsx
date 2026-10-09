/** The header search — a Spotlight bar (owner reference: samitkapoor's "Apple
 *  Spotlight", 2026-10-05), centred in the header.
 *
 *  One liquid surface. The pill, the quick-link circles and both panels are
 *  plain shapes in a goo-filtered layer (an SVG blur + alpha threshold), so
 *  they melt into each other as they move; the crisp content — the input,
 *  icons, rows — rides an unfiltered layer on top, animated with the very
 *  same springs from the very same numbers, so the two never drift.
 *
 *    idle     the pill
 *    dock     hover (or focus while empty): the pill shortens and the quick
 *             links bud off its right end; hovering one names it in the pill
 *    results  typing: the pill grows into the results panel and swallows the
 *             circles; ↑ ↓ move, Enter opens, Esc closes
 *    edit     "+": the links jiggle and the catalogue drips out of "+";
 *             drag a page onto the bar or off it, or click to add / remove
 *
 *  Geometry is the reference's, scaled to a 36px pill (66 → 36): circles
 *  inset 1px, 9px apart, the dock filling exactly what the pill gives up.
 *
 *  The same bar serves the app and Admin; a `scope` (scope.ts) says what it
 *  finds and which pages it can pin. */
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, type Transition } from "motion/react";
import { Check, ChevronRight, Minus, Plus, Search } from "lucide-react";

import { isInsideLayerAbove, isTopLayer, popLayer, pushLayer } from "../ui/layers.ts";
import { useFeatureFlags } from "../../hooks/useFeatureFlags.tsx";
import { QUICK_LINK_MAX } from "../../utils/preferences.ts";
import { rankResults, type SearchResult } from "./searchIndex.ts";
import { BAR_H, DOCK_MIN_WIDTH } from "./geometry.ts";
import type { QuickLink, SpotlightScope } from "./scope.ts";

/* ─── Geometry (CSS px) ─── */
const H = BAR_H;            // the pill
const D = 34;               // a circle
const G = 9;                // between circles (and pill → first circle)
const INSET = (H - D) / 2;  // circles sit 1px inside the pill's height
const ROW = 44;             // a result row
const LIST_GAP = 4;         // input row → first result
const LIST_PAD = 6;         // under the last result
const MAX_ROWS = 7;
const PANEL_R = 16;
const EDITOR_GAP = 10;      // the bar → the catalogue
/** Room around the shapes for the goo filter to draw into. */
const GOO_PAD = 24;

/* ─── Motion (measured off the reference: ~130ms to most of the way, ~1% overshoot) ─── */
const SHAPE: Transition = { type: "spring", stiffness: 460, damping: 34, mass: 0.9 };
const LIFT: Transition = { type: "spring", stiffness: 520, damping: 32 };

type DragFrom = "dock" | "catalog";
interface DragView { id: string; from: DragFrom; overDock: boolean; insert: number; overCatalog: boolean; landing: boolean }

export default function Spotlight({ width, panel, scope }: {
  /** The bar's width (the header measures what's free). */
  width: number;
  /** The results panel's left edge and width, relative to the bar — wider than
   *  the bar on phones, where it spans the screen. */
  panel: { x: number; width: number };
  /** What this bar finds and pins — constant for a mounted bar. */
  scope: SpotlightScope;
}) {
  const uid = useId().replace(/:/g, "");
  const navigate = useNavigate();
  const location = useLocation();
  const reduced = useReducedMotion();
  const { isEnabled } = useFeatureFlags();
  const { links, available, setLinks } = scope.useLinks();
  const badges = scope.useBadges();
  const linkById = useMemo(() => new Map(scope.catalog.map((l) => [l.id, l])), [scope.catalog]);
  const quickLink = (id: string): QuickLink => linkById.get(id)!;

  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const tileRefs = useRef(new Map<string, HTMLElement>());

  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(false);
  const [peek, setPeek] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const [used, setUsed] = useState(false);
  const [editorH, setEditorH] = useState(220);
  const [shake, setShake] = useState(0);
  const [drag, setDrag] = useState<DragView | null>(null);
  const [notice, setNotice] = useState("");

  const dockFits = width >= DOCK_MIN_WIDTH;
  const q = query.trim();
  const resultsOpen = focused && q.length > 0 && !editing;
  const dockOpen = dockFits && (editing || (!resultsOpen && (hovered || (focused && !q))));
  const spring = (t: Transition): Transition => (reduced ? { duration: 0 } : t);

  /* ─── Results ─── */
  const records = scope.useRecords(used, q);
  const pages = useMemo(() => scope.pages.filter((p) => !p.flag || isEnabled(p.flag)), [scope.pages, isEnabled]);
  const results = useMemo(() => rankResults(q, [...pages, ...(records.data ?? [])]), [q, pages, records.data]);
  const searching = records.isPending && used;
  const rowCount = Math.min(MAX_ROWS, Math.max(1, results.length + (searching ? 1 : 0)));
  const panelH = H + LIST_GAP + rowCount * ROW + LIST_PAD;
  useEffect(() => setActive(0), [q]);

  /* ─── The dock, as drawn: the saved links, or a drag's preview ─── */
  const dockIds = useMemo<{ id: string; ghost: boolean }[]>(() => {
    const plain = links.map((id) => ({ id, ghost: false }));
    if (!drag || drag.landing) return plain;
    const base = drag.from === "dock" ? links.filter((id) => id !== drag.id) : [...links];
    if (!drag.overDock) return base.map((id) => ({ id, ghost: false }));
    const out = base.map((id) => ({ id, ghost: false }));
    const at = Math.max(0, Math.min(drag.insert, out.length));
    if (drag.from === "catalog" && out.length >= QUICK_LINK_MAX) out.splice(Math.min(at, out.length - 1), 1, { id: drag.id, ghost: true });
    else out.splice(at, 0, { id: drag.id, ghost: true });
    return out;
  }, [links, drag]);

  const n = dockIds.length + 1;                       // + the "+" circle
  const dockStart = width - n * (D + G);              // where the pill ends when the dock is out
  const slotX = (i: number) => dockStart + G + i * (D + G);
  const tuckX = resultsOpen ? panel.x + panel.width - D - 6 : width - D - 6;
  const pillShape = resultsOpen
    ? { x: panel.x, y: 0, width: panel.width, height: panelH, borderRadius: PANEL_R }
    : { x: 0, y: 0, width: dockOpen ? dockStart : width, height: H, borderRadius: H / 2 };
  const circleX = (i: number) => (dockOpen ? slotX(i) : tuckX);
  // Out: nearest first; back in: farthest first.
  const bud = (i: number): Transition => spring({ type: "spring", stiffness: 420, damping: 31, delay: dockOpen ? i * 0.035 : (n - 1 - i) * 0.022 });
  const plusX = circleX(n - 1);
  // Everything any shape can reach, in bar coordinates.
  const span = {
    left: Math.min(0, panel.x),
    width: Math.max(width, panel.x + panel.width) - Math.min(0, panel.x),
    height: Math.max(H + LIST_GAP + MAX_ROWS * ROW + LIST_PAD, H + EDITOR_GAP + editorH),
  };
  const editorShape = editing
    ? { x: 0, y: H + EDITOR_GAP, width, height: editorH, borderRadius: PANEL_R }
    : { x: plusX, y: INSET, width: D, height: D, borderRadius: D / 2 };

  /* ─── Open / close ─── */
  const close = useCallback(() => {
    setEditing(false);
    setPeek(null);
    inputRef.current?.blur();
  }, []);

  // A new page: everything folds away (the query too — it found what it was for).
  useEffect(() => {
    setEditing(false);
    setQuery("");
    setPeek(null);
    inputRef.current?.blur();
  }, [location.pathname]);

  // ⌘K / Ctrl K — into the bar (or out of it).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "k" || e.altKey || e.shiftKey) return;
      e.preventDefault();
      if (document.activeElement === inputRef.current) inputRef.current?.blur();
      else { inputRef.current?.focus(); inputRef.current?.select(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // While a panel is out it's a layer: Escape and outside clicks close it.
  const layered = resultsOpen || editing;
  useEffect(() => {
    if (!layered) return;
    const layer = pushLayer("spotlight", () => rootRef.current);
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || isInsideLayerAbove(layer, t)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || !isTopLayer(layer)) return;
      e.stopPropagation();
      if (editing) setEditing(false);
      else close();
    };
    document.addEventListener("pointerdown", onClick, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      popLayer(layer);
      document.removeEventListener("pointerdown", onClick, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [layered, editing, close]);

  // Hover leaves with a short grace, so crossing a gap doesn't fold the dock.
  const leaveTimer = useRef<number>();
  const onEnter = () => { window.clearTimeout(leaveTimer.current); setHovered(true); };
  const onLeave = () => {
    window.clearTimeout(leaveTimer.current);
    leaveTimer.current = window.setTimeout(() => { setHovered(false); setPeek(null); }, 140);
  };
  useEffect(() => () => window.clearTimeout(leaveTimer.current), []);

  const open = (r: SearchResult) => {
    navigate(r.route);
    setQuery("");
    close();
  };

  const onInputKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!resultsOpen || !results.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => (i + 1) % results.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => (i - 1 + results.length) % results.length); }
    else if (e.key === "Enter") { e.preventDefault(); const r = results[active]; if (r) open(r); }
  };
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-row="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  /* ─── The catalogue's height (measured, so the shape fits it exactly) ─── */
  const editorObserver = useRef<ResizeObserver | null>(null);
  const editorBody = useCallback((el: HTMLDivElement | null) => {
    editorObserver.current?.disconnect();
    if (!el) return;
    const measure = () => setEditorH(el.offsetHeight);
    measure();
    editorObserver.current = new ResizeObserver(measure);
    editorObserver.current.observe(el);
  }, []);

  /* ─── Edit: add, remove, and the "full" shake ─── */
  const say = (s: string) => { setNotice(""); requestAnimationFrame(() => setNotice(s)); };
  const add = (id: string) => {
    if (links.includes(id)) return;
    if (links.length >= QUICK_LINK_MAX) {
      setShake((k) => k + 1);
      say(`The bar holds ${QUICK_LINK_MAX} — take one off first.`);
      return;
    }
    setLinks([...links, id]);
    say(`${quickLink(id).label} added to the bar.`);
  };
  const remove = (id: string) => {
    setLinks(links.filter((x) => x !== id));
    say(`${quickLink(id).label} taken off the bar.`);
  };
  const nudge = (id: string, by: -1 | 1) => {
    const i = links.indexOf(id);
    const j = i + by;
    if (i < 0 || j < 0 || j >= links.length) return;
    const next = [...links];
    [next[i], next[j]] = [next[j], next[i]];
    setLinks(next);
  };

  /* ─── Drag between the bar and the catalogue (pointer events) ─── */
  const fx = useMotionValue(0);
  const fy = useMotionValue(0);
  const press = useRef<{ id: string; from: DragFrom; pointerId: number; sx: number; sy: number; ox: number; oy: number; active: boolean } | null>(null);
  const justDragged = useRef(false);
  const dragRef = useRef<DragView | null>(null);
  dragRef.current = drag;

  /** Where a dock slot or a catalogue tile sits, in bar coordinates. */
  const originOf = (id: string, from: DragFrom): { x: number; y: number } => {
    if (from === "dock") {
      const i = links.indexOf(id);
      return { x: slotX(Math.max(0, i)) - 2, y: INSET - 2 };
    }
    const root = rootRef.current?.getBoundingClientRect();
    const tile = tileRefs.current.get(id)?.querySelector("[data-tile-circle]")?.getBoundingClientRect();
    if (!root || !tile) return { x: 0, y: H + EDITOR_GAP };
    return { x: tile.left - root.left - 2 + (tile.width - 40) / 2, y: tile.top - root.top - 2 + (tile.height - 40) / 2 };
  };

  const startPress = (e: ReactPointerEvent, id: string, from: DragFrom) => {
    if (!editing || e.button !== 0) return;
    if ((e.target as HTMLElement).closest("[data-no-drag]")) return;
    const o = originOf(id, from);
    press.current = { id, from, pointerId: e.pointerId, sx: e.clientX, sy: e.clientY, ox: o.x, oy: o.y, active: false };
  };

  useEffect(() => {
    if (!editing) return;
    const hit = (clientX: number, clientY: number) => {
      const root = rootRef.current!.getBoundingClientRect();
      const x = clientX - root.left;
      const y = clientY - root.top;
      const p = press.current!;
      const overDock = x >= -8 && x <= width + 8 && y >= -14 && y <= H + 8;
      const overCatalog = !overDock && x >= 0 && x <= width && y >= H + EDITOR_GAP - 4 && y <= H + EDITOR_GAP + editorH + 8;
      // Slot centres for the dock as it would be with this item in it.
      const base = p.from === "dock" ? links.filter((id) => id !== p.id) : links;
      const k = p.from === "catalog" && base.length >= QUICK_LINK_MAX ? base.length : base.length + 1;
      const start = width - (k + 1) * (D + G) + G;
      const centre = (i: number) => start + i * (D + G) + D / 2;
      let insert = 0;
      if (p.from === "catalog" && base.length >= QUICK_LINK_MAX) {
        // Full: the drop swaps with whichever link is nearest.
        for (let i = 1; i < k; i++) if (Math.abs(x - centre(i)) < Math.abs(x - centre(insert))) insert = i;
      } else {
        for (let i = 0; i < k; i++) if (x > centre(i)) insert = i + 1;
        insert = Math.min(insert, k - 1);
      }
      return { x, y, overDock, overCatalog, insert };
    };
    const onMove = (e: PointerEvent) => {
      const p = press.current;
      if (!p || e.pointerId !== p.pointerId) return;
      if (!p.active) {
        if (Math.hypot(e.clientX - p.sx, e.clientY - p.sy) < 4) return;
        p.active = true;
        setPeek(null);
        fx.set(p.ox);
        fy.set(p.oy);
      }
      fx.set(p.ox + (e.clientX - p.sx));
      fy.set(p.oy + (e.clientY - p.sy));
      const h = hit(e.clientX, e.clientY);
      const prev = dragRef.current;
      if (!prev || prev.overDock !== h.overDock || prev.insert !== h.insert || prev.overCatalog !== h.overCatalog) {
        setDrag({ id: p.id, from: p.from, overDock: h.overDock, overCatalog: h.overCatalog, insert: h.insert, landing: false });
      }
    };
    const land = (to: { x: number; y: number }, done: () => void) => {
      const opts = spring(LIFT);
      Promise.all([animate(fx, to.x, opts), animate(fy, to.y, opts)]).then(done, done);
    };
    const onUp = (e: PointerEvent) => {
      const p = press.current;
      if (!p || e.pointerId !== p.pointerId) return;
      press.current = null;
      if (!p.active) return;
      setPeek(null);
      justDragged.current = true;
      window.setTimeout(() => { justDragged.current = false; }, 0);
      const d = dragRef.current;
      const finish = () => setDrag(null);
      if (d?.overDock) {
        const base = p.from === "dock" ? links.filter((id) => id !== p.id) : [...links];
        const at = Math.max(0, Math.min(d.insert, base.length));
        let next: string[];
        if (p.from === "catalog" && base.length >= QUICK_LINK_MAX) {
          const swap = Math.min(at, base.length - 1);
          next = [...base]; next[swap] = p.id;
        } else {
          next = [...base]; next.splice(at, 0, p.id);
        }
        setLinks(next);
        setDrag({ ...d, landing: true });
        const i = next.indexOf(p.id);
        const k = next.length + 1;
        land({ x: width - k * (D + G) + G + i * (D + G) - 2, y: INSET - 2 }, finish);
      } else if (d?.overCatalog && p.from === "dock") {
        remove(p.id);
        setDrag({ ...d, landing: true, overDock: false });
        requestAnimationFrame(() => land(originOf(p.id, "catalog"), finish));
      } else {
        setDrag(d ? { ...d, overDock: false, overCatalog: false, landing: true } : null);
        land({ x: p.ox, y: p.oy }, finish);
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    // The handlers read the latest links/geometry each time they're attached.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, links, width, editorH]);

  /* ─── Render ─── */
  const swapping = drag && !drag.landing && drag.from === "catalog" && drag.overDock && links.length >= QUICK_LINK_MAX ? links[Math.min(drag.insert, links.length - 1)] : null;
  const dropHint = !drag || drag.landing ? null
    : swapping ? `Swap with ${quickLink(swapping).label}`
    : drag.overDock ? (drag.from === "dock" ? "Drop to move" : "Drop to add")
    : drag.overCatalog && drag.from === "dock" ? "Drop to take it off"
    : "Drag onto the bar";
  const placeholder = dropHint ?? peek ?? (editing ? "Drag pages on or off the bar" : "Search");
  const goo = `goo-${uid}`;
  // Alternating keyframes, so every "full" shake is a new target and replays.
  const shakeX = shake === 0 ? 0 : shake % 2 ? [0, -6, 6, -4, 4, 0] : [0, 6, -6, 4, -4, 0];

  return (
    <div
      ref={rootRef}
      // Over the page (its sticky bars, the bulk bar), under every dialog's backdrop (z-50).
      className="spotlight relative z-40"
      style={{ width, height: H }}
      onPointerEnter={(e) => { if (e.pointerType === "mouse") onEnter(); }}
      onPointerLeave={(e) => { if (e.pointerType === "mouse") onLeave(); }}
    >
      <svg width="0" height="0" className="absolute" aria-hidden focusable="false">
        <defs>
          <filter id={goo} x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
            <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
            <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -9" result="goo" />
            <feComposite in="SourceGraphic" in2="goo" operator="over" />
          </filter>
        </defs>
      </svg>

      {/* ── The liquid: shapes only, under the goo filter; the silhouette gets the hairline.
             A filter renders only inside its element's box, so the box spans every shape. ── */}
      <div aria-hidden className={`spotlight-silhouette pointer-events-none absolute ${layered ? "is-open" : ""}`} style={{ left: span.left - GOO_PAD, top: -GOO_PAD, width: span.width + GOO_PAD * 2, height: span.height + GOO_PAD * 2 }}>
        <div className="absolute inset-0" style={{ filter: `url(#${goo})` }}>
          <div className="absolute" style={{ left: GOO_PAD - span.left, top: GOO_PAD }}>
          <motion.div className="absolute left-0 top-0 bg-popover" initial={false} animate={pillShape} transition={spring(SHAPE)} />
          <motion.div className="absolute left-0 top-0" initial={false} animate={{ x: shakeX }} transition={{ duration: 0.36 }}>
            {dockFits && dockIds.map((s, i) => (
              <motion.div
                key={s.id}
                className="absolute left-0 top-0 rounded-full bg-popover"
                style={{ width: D, height: D }}
                initial={false}
                animate={{ x: circleX(i), y: INSET, scale: s.ghost ? 0 : 1 }}
                transition={bud(i)}
              />
            ))}
            {dockFits && (
              <motion.div className="absolute left-0 top-0 rounded-full bg-popover" style={{ width: D, height: D }} initial={false} animate={{ x: plusX, y: INSET }} transition={bud(n - 1)} />
            )}
          </motion.div>
          {dockFits && <motion.div className="absolute left-0 top-0 bg-popover" initial={false} animate={editorShape} transition={spring(SHAPE)} />}
          </div>
        </div>
      </div>

      {/* ── The bar's content ── */}
      <motion.div
        className="absolute left-0 top-0 flex items-center"
        style={{ height: H }}
        initial={false}
        animate={{ x: resultsOpen ? panel.x : 0, width: resultsOpen ? panel.width : dockOpen ? dockStart : width }}
        transition={spring(SHAPE)}
      >
        <Search size={15} strokeWidth={2} className="pointer-events-none absolute left-[14px] top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-label={scope.label}
          aria-expanded={resultsOpen}
          aria-controls={`${uid}-list`}
          aria-activedescendant={resultsOpen && results[active] ? `${uid}-row-${active}` : undefined}
          aria-autocomplete="list"
          autoComplete="off"
          spellCheck={false}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setUsed(true); }}
          onFocus={() => { setFocused(true); setUsed(true); }}
          onBlur={() => setFocused(false)}
          onKeyDown={onInputKey}
          className="peer h-full w-full min-w-0 bg-transparent pl-[35px] pr-3 text-[16px] sm:text-[14px] text-foreground outline-none rounded-full"
        />
        {!query && (
          <span className="pointer-events-none absolute left-[35px] right-3 top-1/2 -translate-y-1/2 overflow-hidden whitespace-nowrap text-[16px] sm:text-[14px] leading-none text-muted-foreground" aria-hidden>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={placeholder}
                className="inline-block"
                initial={reduced ? false : { opacity: 0, y: 3, filter: "blur(3px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={reduced ? undefined : { opacity: 0, y: -3, filter: "blur(3px)" }}
                transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              >
                {placeholder}
              </motion.span>
            </AnimatePresence>
          </span>
        )}
      </motion.div>

      {/* ── The dock ── */}
      {dockFits && (
        <motion.nav
          aria-label="Quick links"
          className="absolute inset-0 pointer-events-none"
          initial={false}
          animate={{ x: shakeX }}
          transition={{ duration: 0.36 }}
        >
          {dockIds.map((s, i) => {
            const l = quickLink(s.id);
            // The icon steps aside while it's in the air (or landing); the drop slot is a dashed ring.
            const hidden = s.ghost || drag?.id === s.id;
            return (
              <motion.div
                key={s.id}
                className="absolute left-0 top-0"
                style={{ width: D, height: D }}
                initial={false}
                animate={{ x: circleX(i), y: INSET, opacity: dockOpen ? 1 : 0, scale: dockOpen ? 1 : 0.55 }}
                transition={bud(i)}
              >
                {s.ghost && (
                  <span aria-hidden className="absolute inset-0 rounded-full border-[1.5px] border-dashed border-foreground/25" />
                )}
                <div
                  className={`relative h-full w-full transition-opacity duration-100 ${hidden ? "opacity-0" : ""} ${editing && !hidden ? "spotlight-jiggle" : ""}`}
                  style={editing ? { animationDelay: `${-0.09 * i}s`, animationDuration: `${0.26 + (i % 3) * 0.03}s` } : undefined}
                >
                  <Link
                    to={l.path}
                    aria-label={editing ? `${l.label} — drag to move, or off the bar` : badges[s.id] ? `${l.label}, ${badges[s.id]}` : l.label}
                    tabIndex={dockOpen ? 0 : -1}
                    draggable={false}
                    onClick={(e) => { if (editing || justDragged.current) e.preventDefault(); }}
                    onPointerDown={(e) => startPress(e, s.id, "dock")}
                    onKeyDown={(e) => {
                      if (!editing || !e.altKey) return;
                      if (e.key === "ArrowLeft") { e.preventDefault(); nudge(s.id, -1); }
                      if (e.key === "ArrowRight") { e.preventDefault(); nudge(s.id, 1); }
                    }}
                    onMouseEnter={() => { if (!press.current?.active) setPeek(l.label); }}
                    onMouseLeave={() => setPeek(null)}
                    onFocus={() => setPeek(l.label)}
                    onBlur={() => setPeek(null)}
                    className={`pointer-events-auto relative grid h-full w-full place-items-center rounded-full text-muted-foreground transition-colors duration-150 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${editing ? "cursor-grab touch-none active:cursor-grabbing" : ""} ${location.pathname === l.path ? "text-foreground" : ""}`}
                  >
                    <l.Icon size={16} strokeWidth={1.8} aria-hidden />
                    {badges[s.id] && !editing && (
                      <span className="absolute right-[7px] top-[7px] h-[7px] w-[7px] rounded-full bg-primary ring-2 ring-popover" aria-hidden />
                    )}
                  </Link>
                  <AnimatePresence>
                    {editing && !hidden && (
                      <motion.button
                        type="button"
                        data-no-drag
                        aria-label={`Take ${l.label} off the bar`}
                        onClick={() => remove(s.id)}
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={spring({ type: "spring", stiffness: 600, damping: 30 })}
                        className="pointer-events-auto absolute -left-1 -top-1 grid h-[15px] w-[15px] place-items-center rounded-full bg-foreground text-background shadow-panel focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <Minus size={9} strokeWidth={3} aria-hidden />
                      </motion.button>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            );
          })}
          <motion.div
            className="absolute left-0 top-0"
            style={{ width: D, height: D }}
            initial={false}
            animate={{ x: plusX, y: INSET, opacity: dockOpen ? 1 : 0, scale: dockOpen ? 1 : 0.55 }}
            transition={bud(n - 1)}
          >
            <button
              type="button"
              aria-label={editing ? "Done editing quick links" : "Edit quick links"}
              aria-expanded={editing}
              tabIndex={dockOpen ? 0 : -1}
              onClick={() => { setEditing((v) => !v); setPeek(null); }}
              onMouseEnter={() => setPeek(editing ? "Done" : "Edit quick links")}
              onMouseLeave={() => setPeek(null)}
              className="pointer-events-auto grid h-full w-full place-items-center rounded-full text-muted-foreground transition-colors duration-150 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={editing ? "done" : "plus"}
                  initial={reduced ? false : { opacity: 0, rotate: -90, scale: 0.6 }}
                  animate={{ opacity: 1, rotate: 0, scale: 1 }}
                  exit={reduced ? undefined : { opacity: 0, rotate: 90, scale: 0.6 }}
                  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                  className="grid place-items-center"
                >
                  {editing ? <Check size={16} strokeWidth={2.2} aria-hidden /> : <Plus size={16} strokeWidth={1.9} aria-hidden />}
                </motion.span>
              </AnimatePresence>
            </button>
          </motion.div>
        </motion.nav>
      )}

      {/* ── Results ── */}
      <motion.div
        className="absolute left-0 overflow-hidden"
        style={{ top: H, pointerEvents: resultsOpen ? "auto" : "none" }}
        initial={false}
        animate={{ x: panel.x, width: panel.width, height: resultsOpen ? panelH - H : 0, opacity: resultsOpen ? 1 : 0 }}
        transition={resultsOpen ? spring(SHAPE) : spring({ type: "spring", stiffness: 520, damping: 40 })}
      >
        <div
          ref={listRef}
          id={`${uid}-list`}
          role="listbox"
          aria-label="Results"
          className="overflow-y-auto overscroll-contain px-1.5"
          style={{ maxHeight: MAX_ROWS * ROW + LIST_PAD + LIST_GAP, paddingTop: LIST_GAP, paddingBottom: LIST_PAD }}
          onPointerDown={(e) => e.preventDefault() /* keep focus in the input */}
        >
          {results.map((r, i) => (
            <div
              key={`${r.kind}:${r.id}`}
              id={`${uid}-row-${i}`}
              data-row={i}
              role="option"
              aria-selected={i === active}
              onMouseMove={() => { if (i !== active) setActive(i); }}
              onClick={() => open(r)}
              className="relative flex cursor-pointer items-center gap-3 rounded-[11px] px-2.5"
              style={{ height: ROW }}
            >
              {i === active && (
                <motion.span layoutId={`${uid}-hl`} className="absolute inset-0 rounded-[11px] bg-control" transition={spring({ type: "spring", stiffness: 700, damping: 48 })} />
              )}
              <r.Icon size={16} strokeWidth={1.7} className="relative shrink-0 text-foreground/75" aria-hidden />
              <span className="relative min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium leading-tight text-foreground">{r.title}</span>
                <span className="block truncate text-[11.5px] leading-tight text-muted-foreground mt-0.5">{r.subtitle}</span>
              </span>
              {i === active && <ChevronRight size={14} strokeWidth={2} className="relative shrink-0 text-muted-foreground" aria-hidden />}
            </div>
          ))}
          {searching && (
            <div className="flex items-center gap-3 px-2.5 text-[12.5px] text-muted-foreground" style={{ height: ROW }}>
              <span className="h-4 w-4 shrink-0 rounded-full bg-control animate-pulse motion-reduce:animate-none" aria-hidden />
              {scope.searchingText}
            </div>
          )}
          {!searching && results.length === 0 && (
            <div className="flex items-center px-2.5 text-[12.5px] text-muted-foreground" style={{ height: ROW }}>
              No results for “{q}”
            </div>
          )}
        </div>
      </motion.div>

      {/* ── The catalogue (edit) ── */}
      {dockFits && (
        <motion.div
          className="absolute left-0"
          style={{ top: H + EDITOR_GAP, width, pointerEvents: editing ? "auto" : "none" }}
          initial={false}
          animate={{ opacity: editing ? 1 : 0, y: editing ? 0 : -6 }}
          transition={editing ? { duration: 0.22, delay: reduced ? 0 : 0.08, ease: [0.16, 1, 0.3, 1] } : { duration: 0.1 }}
          aria-hidden={!editing}
        >
          <div ref={editorBody} className={`rounded-2xl transition-shadow duration-150 ${drag?.overCatalog && drag.from === "dock" ? "ring-2 ring-inset ring-foreground/15" : ""}`}>
            <div className="flex items-start justify-between gap-3 px-4 pt-3.5 pb-1.5">
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-foreground">Quick links</p>
                <p className="mt-0.5 text-[11.5px] leading-snug text-muted-foreground">
                  {drag?.from === "dock" && !drag.landing ? "Drop here to take it off the bar." : `Drag a page onto the bar, or off it — up to ${QUICK_LINK_MAX}.`}
                </p>
              </div>
              <button
                type="button"
                tabIndex={editing ? 0 : -1}
                onClick={() => setEditing(false)}
                className="h-7 shrink-0 rounded-full bg-primary px-3 text-[12px] font-medium text-primary-foreground transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-popover"
              >
                Done
              </button>
            </div>
            <div className="grid grid-cols-4 px-2 pb-2.5">
              {scope.catalog.filter((l) => available(l.id)).map((l) => {
                const inBar = links.includes(l.id);
                const lifted = drag?.id === l.id;
                return (
                  <button
                    key={l.id}
                    ref={(el) => { if (el) tileRefs.current.set(l.id, el); else tileRefs.current.delete(l.id); }}
                    type="button"
                    tabIndex={editing ? 0 : -1}
                    aria-pressed={inBar}
                    aria-label={inBar ? `${l.label} — on the bar. Take it off` : `${l.label} — add to the bar`}
                    onPointerDown={(e) => { if (!inBar) startPress(e, l.id, "catalog"); }}
                    onClick={() => { if (justDragged.current) return; if (inBar) remove(l.id); else add(l.id); }}
                    className={`group flex flex-col items-center gap-1.5 rounded-xl py-2 transition-colors duration-150 hover:bg-control/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${inBar ? "" : "cursor-grab touch-none active:cursor-grabbing"}`}
                  >
                    <span
                      data-tile-circle
                      className={`relative grid h-10 w-10 place-items-center rounded-full transition-[opacity,transform] duration-200 ${
                        inBar ? "border-[1.5px] border-dashed border-border text-muted-foreground/45" : "bg-background text-foreground/80 shadow-panel ring-1 ring-inset ring-border group-hover:scale-105"
                      } ${lifted ? "opacity-0" : ""}`}
                    >
                      <l.Icon size={17} strokeWidth={1.7} aria-hidden />
                      {inBar && (
                        <span className="absolute -right-0.5 -top-0.5 grid h-[15px] w-[15px] place-items-center rounded-full bg-foreground text-background" aria-hidden>
                          <Check size={9} strokeWidth={3} />
                        </span>
                      )}
                    </span>
                    <span className={`max-w-full truncate px-1 text-[11.5px] font-medium ${inBar ? "text-muted-foreground" : "text-foreground"}`}>{l.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </motion.div>
      )}

      {/* ── The one being dragged ── */}
      {drag && (
        <motion.div
          className="pointer-events-none absolute left-0 top-0 z-10 grid h-[38px] w-[38px] place-items-center rounded-full bg-popover text-foreground shadow-floating ring-1 ring-border"
          style={{ x: fx, y: fy }}
          initial={{ scale: 1 }}
          animate={{ scale: drag.landing ? 1 : 1.12, rotate: drag.landing ? 0 : -4 }}
          transition={spring(LIFT)}
        >
          {(() => { const Icon = quickLink(drag.id).Icon; return <Icon size={17} strokeWidth={1.8} aria-hidden />; })()}
        </motion.div>
      )}

      <p className="sr-only" aria-live="polite">{notice}</p>
    </div>
  );
}
