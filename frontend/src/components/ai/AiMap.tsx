/** The AI map — a web of where each AI feature runs.
 *
 *  One cluster per hub (Included, each AI key, My assistant, Off): the hub in
 *  the centre, the features it runs on an orbit around it. Every visual
 *  channel is a fact, decoded by the page's legend: edge colour = provider,
 *  thickness = this week's volume, a flowing dash = used in the last day, a
 *  still dash = borrowed from a default, red = failing.
 *
 *  Everything explains itself in a card (hover, keyboard focus, or a tap) —
 *  the card is also where the keyboard/touch alternative to dragging lives.
 *  With a mouse or pen, a feature can be dragged onto another cluster to move
 *  it there: past a 6px threshold a ghost follows the pointer, clusters that
 *  can take it ring up, the rest fade; Escape or a miss returns it.
 *
 *  HTML nodes over one SVG edge layer; the geometry is pure (mapLayout.ts).
 *  Ported from Sora's AI map v2. */
import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";

import Popover from "../ui/Popover.tsx";
import { prefersReducedMotion } from "../../utils/motion.ts";
import { edgePath, hitCluster, layoutClusters } from "./mapLayout.ts";

export interface MapCardContext {
  close: () => void;
  /** Keep the card open while something inside it needs the pointer (an
   *  open model picker, an unsaved choice). */
  setSticky: (sticky: boolean) => void;
}

export interface MapNodeSpec {
  id: string;
  /** One word under the circle; the card carries the full story. */
  face: string;
  sub?: string;
  glyph: ReactNode;
  ariaLabel: string;
  /** Dashed outline — a neutral hub rather than a key. */
  hub?: boolean;
  failing?: boolean;
  /** Faded on its own (off, unavailable). */
  muted?: boolean;
  card: (ctx: MapCardContext) => ReactNode;
  cardWidth?: number;
}

export interface MapSatSpec extends MapNodeSpec {
  draggable: boolean;
  edge: { color: string; width: number; dashed: boolean; pulse: boolean };
}

export interface MapClusterSpec {
  id: string;
  hub: MapNodeSpec;
  sats: MapSatSpec[];
  /** Can this feature be dropped on this cluster? */
  accepts: (satId: string) => boolean;
}

interface DragState {
  satId: string;
  fromCluster: string;
  glyph: ReactNode;
  face: string;
  x: number;
  y: number;
  originX: number;
  originY: number;
  valid: Set<string>;
  over: string | null;
  returning: boolean;
}

const OPEN_DELAY = 160;
const CLOSE_DELAY = 120;
const DRAG_THRESHOLD = 6;

export default function AiMap({ clusters, onDrop, focusId = null, ariaLabel }: {
  clusters: MapClusterSpec[];
  onDrop: (satId: string, clusterId: string) => void;
  /** Dim everything not connected to this node ("What this key affects"). */
  focusId?: string | null;
  ariaLabel: string;
}) {
  /* ---------- the stage (measured; the observer re-attaches on remount) ---------- */
  const [stageW, setStageW] = useState(0);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const observer = useRef<ResizeObserver | null>(null);
  // The callback ref alone owns the observer: React calls it with null on
  // unmount (disconnect) and with the element on every mount (attach). An
  // effect cleanup would disconnect it on StrictMode's rehearsal unmount and
  // nothing would re-attach it.
  const setStage = useCallback((el: HTMLDivElement | null) => {
    observer.current?.disconnect();
    observer.current = null;
    stageRef.current = el;
    if (!el) return;
    setStageW(el.clientWidth);
    observer.current = new ResizeObserver(() => setStageW(el.clientWidth));
    observer.current.observe(el);
  }, []);

  const layout = useMemo(
    () => (stageW ? layoutClusters(clusters.map((c) => ({ id: c.id, satIds: c.sats.map((s) => s.id) })), Math.max(300, stageW)) : null),
    [clusters, stageW],
  );

  const nodes = useMemo(() => {
    const out: { spec: MapNodeSpec | MapSatSpec; x: number; y: number; r: number; clusterId: string; sat: boolean }[] = [];
    if (!layout) return out;
    clusters.forEach((c, i) => {
      const placed = layout.clusters[i];
      out.push({ spec: c.hub, x: placed.cx, y: placed.cy, r: layout.geo.hubR, clusterId: c.id, sat: false });
      c.sats.forEach((s, j) => out.push({ spec: s, x: placed.sats[j].x, y: placed.sats[j].y, r: layout.geo.satR, clusterId: c.id, sat: true }));
    });
    return out;
  }, [clusters, layout]);

  /* ---------- hover / focus dimming (the related set = edge neighbours) ---------- */
  const [hovered, setHovered] = useState<string | null>(null);
  const active = hovered ?? focusId;
  const related = useMemo(() => {
    if (!active) return null;
    const set = new Set<string>([active]);
    for (const c of clusters) {
      if (c.hub.id === active) c.sats.forEach((s) => set.add(s.id));
      if (c.sats.some((s) => s.id === active)) set.add(c.hub.id);
    }
    return set.size > 1 || nodes.some((n) => n.spec.id === active) ? set : null;
  }, [active, clusters, nodes]);

  /* ---------- the node card (one at a time; a drag suppresses it) ---------- */
  const [openId, setOpenId] = useState<string | null>(null);
  const [pinned, setPinned] = useState(false); // opened by click/tap/keyboard: leave doesn't close it
  const sticky = useRef(false);
  const anchorRef = useRef<HTMLElement>(null) as React.MutableRefObject<HTMLElement | null>;
  const nodeEls = useRef(new Map<string, HTMLButtonElement>());
  const timer = useRef<number | undefined>(undefined);
  const clearTimer = () => window.clearTimeout(timer.current);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const openCard = (id: string, byClick: boolean) => {
    clearTimer();
    anchorRef.current = nodeEls.current.get(id) ?? null;
    setOpenId(id);
    setPinned(byClick);
  };
  const closeCard = useCallback(() => {
    clearTimer();
    sticky.current = false;
    setOpenId(null);
    setPinned(false);
  }, []);
  const scheduleClose = () => {
    if (pinned) return;
    clearTimer();
    timer.current = window.setTimeout(() => {
      if (!sticky.current) closeCard();
    }, CLOSE_DELAY);
  };
  const cardCtx = useMemo<MapCardContext>(() => ({
    close: closeCard,
    setSticky: (v) => {
      sticky.current = v;
      if (v) clearTimer();
    },
  }), [closeCard]);

  // The node a card belongs to can leave the map (it moved); close with it.
  useEffect(() => {
    if (openId && !nodes.some((n) => n.spec.id === openId)) closeCard();
  }, [nodes, openId, closeCard]);

  /* ---------- drag to move (mouse/pen; touch and keyboard use the card) ---------- */
  const [drag, setDragState] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const setDrag = useCallback((d: DragState | null) => {
    dragRef.current = d;
    setDragState(d);
  }, []);
  const armed = useRef<{ satId: string; clusterId: string; startX: number; startY: number; el: HTMLElement } | null>(null);
  const justDragged = useRef(false);
  const returnTimer = useRef<number | undefined>(undefined);
  // The window listeners subscribe once and read the latest data through refs.
  const latest = useRef({ clusters, layout, onDrop });
  latest.current = { clusters, layout, onDrop };

  const endDrag = useCallback(() => {
    window.clearTimeout(returnTimer.current);
    armed.current = null;
    setDrag(null);
  }, [setDrag]);

  const softReturn = useCallback(() => {
    const d = dragRef.current;
    if (!d || prefersReducedMotion()) return endDrag();
    setDrag({ ...d, returning: true, x: d.originX, y: d.originY, over: null });
    window.clearTimeout(returnTimer.current);
    returnTimer.current = window.setTimeout(endDrag, 170);
  }, [endDrag, setDrag]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const a = armed.current;
      if (!a) return;
      const { clusters: cs, layout: lay } = latest.current;
      const d = dragRef.current;
      if (!d) {
        if (Math.hypot(e.clientX - a.startX, e.clientY - a.startY) <= DRAG_THRESHOLD) return;
        const spec = cs.find((c) => c.id === a.clusterId)?.sats.find((s) => s.id === a.satId);
        if (!spec) return;
        const rect = a.el.getBoundingClientRect();
        closeCard();
        setHovered(null);
        setDrag({
          satId: a.satId,
          fromCluster: a.clusterId,
          glyph: spec.glyph,
          face: spec.face,
          x: e.clientX,
          y: e.clientY,
          originX: rect.left + rect.width / 2,
          originY: rect.top + rect.height / 2,
          valid: new Set(cs.filter((c) => c.id !== a.clusterId && c.accepts(a.satId)).map((c) => c.id)),
          over: null,
          returning: false,
        });
        return;
      }
      if (d.returning) return;
      e.preventDefault();
      const stage = stageRef.current?.getBoundingClientRect();
      const hit = stage && lay ? hitCluster(lay.clusters, e.clientX - stage.left, e.clientY - stage.top) : null;
      setDrag({ ...d, x: e.clientX, y: e.clientY, over: hit && d.valid.has(hit.id) ? hit.id : null });
    };
    const onUp = () => {
      const a = armed.current;
      armed.current = null;
      const d = dragRef.current;
      if (!a || !d || d.returning) return;
      // The click that follows a drag must not open the node's card.
      justDragged.current = true;
      window.setTimeout(() => { justDragged.current = false; }, 0);
      if (d.over) {
        setDrag(null);
        latest.current.onDrop(d.satId, d.over);
      } else {
        softReturn();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || (!armed.current && !dragRef.current)) return;
      e.preventDefault();
      e.stopPropagation();
      armed.current = null;
      softReturn();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("keydown", onKey, true);
      window.clearTimeout(returnTimer.current);
    };
  }, [closeCard, setDrag, softReturn]);

  /* ---------- rendering ---------- */
  const dimmed = (id: string, clusterId: string, own?: boolean) => {
    if (drag) return id !== drag.satId && !drag.valid.has(clusterId) && clusterId !== drag.fromCluster;
    return (related ? !related.has(id) : false) || !!own;
  };
  const edgeOpacity = (hubId: string, satId: string, clusterId: string) => {
    if (drag) return drag.valid.has(clusterId) || clusterId === drag.fromCluster ? 0.6 : 0.12;
    if (related) return related.has(hubId) && related.has(satId) ? 0.7 : 0.1;
    return 0.6;
  };
  const openSpec = openId ? nodes.find((n) => n.spec.id === openId)?.spec : undefined;

  return (
    <div
      ref={setStage}
      role="group"
      aria-label={ariaLabel}
      className={`relative w-full select-none ${drag ? "cursor-grabbing" : ""}`}
      style={{ height: layout?.height ?? 260 }}
      onPointerLeave={() => setHovered(null)}
    >
      {layout && (
        <>
          <svg className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden>
            {clusters.map((c, i) => {
              const placed = layout.clusters[i];
              return c.sats.map((s, j) => (
                <path
                  key={`${c.id}:${s.id}`}
                  d={edgePath(placed.cx, placed.cy, placed.sats[j].x, placed.sats[j].y)}
                  fill="none"
                  stroke={s.edge.color}
                  strokeWidth={s.edge.width}
                  strokeLinecap="round"
                  strokeDasharray={s.edge.dashed && !s.edge.pulse ? "4 5" : undefined}
                  className={`ai-map-edge ${s.edge.pulse ? "ai-edge-pulse" : ""}`}
                  style={{ opacity: edgeOpacity(c.hub.id, s.id, c.id) }}
                />
              ));
            })}
          </svg>

          {/* Drop targets — only while dragging. */}
          {drag && layout.clusters.map((c) => drag.valid.has(c.id) && (
            <div
              key={`halo:${c.id}`}
              aria-hidden
              className={`absolute rounded-full pointer-events-none transition-colors duration-150 ${
                drag.over === c.id ? "border-2 border-primary bg-primary/[0.04]" : "border-2 border-dashed border-primary/30"
              }`}
              style={{ left: c.cx - c.haloR, top: c.cy - c.haloR, width: c.haloR * 2, height: c.haloR * 2 }}
            />
          ))}

          {nodes.map(({ spec, x, y, r, clusterId, sat }) => {
            const draggable = sat && (spec as MapSatSpec).draggable;
            const isDim = dimmed(spec.id, clusterId, spec.muted);
            const lifted = drag?.satId === spec.id;
            return (
              <button
                key={spec.id}
                ref={(el) => { if (el) nodeEls.current.set(spec.id, el); else nodeEls.current.delete(spec.id); }}
                type="button"
                aria-label={spec.ariaLabel}
                aria-haspopup="dialog"
                aria-expanded={openId === spec.id}
                className={`ai-map-node absolute grid place-items-center rounded-full bg-card shadow-panel border outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                  spec.hub ? "border-dashed border-border" : spec.failing ? "border-red-400/70 dark:border-red-500/60" : "border-border"
                } ${(hovered === spec.id || openId === spec.id) && !drag ? "ring-2 ring-ring/40" : ""} ${
                  draggable && !drag ? "cursor-grab" : ""
                }`}
                style={{
                  left: x - r,
                  top: y - r,
                  width: r * 2,
                  height: r * 2,
                  opacity: lifted ? 0.25 : isDim ? 0.4 : 1,
                }}
                onPointerEnter={(e) => {
                  if (e.pointerType !== "mouse" || drag) return;
                  setHovered(spec.id);
                  if (openId === spec.id) { clearTimer(); return; }
                  if (pinned && openId) return; // a clicked-open card stays put
                  clearTimer();
                  timer.current = window.setTimeout(() => openCard(spec.id, false), OPEN_DELAY);
                }}
                onPointerLeave={(e) => {
                  if (e.pointerType !== "mouse") return;
                  setHovered((h) => (h === spec.id ? null : h));
                  if (openId === spec.id) scheduleClose();
                  else clearTimer();
                }}
                onPointerDown={(e) => {
                  if (!draggable || e.button !== 0 || e.pointerType === "touch") return;
                  armed.current = { satId: spec.id, clusterId, startX: e.clientX, startY: e.clientY, el: e.currentTarget };
                }}
                onClick={() => {
                  if (justDragged.current) return;
                  if (openId === spec.id && pinned) closeCard();
                  else openCard(spec.id, true);
                }}
              >
                {spec.glyph}
                {spec.failing && (
                  <span aria-hidden className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-red-500 ring-2 ring-card" />
                )}
                {/* Backed by the card colour, so an edge passing under a label never cuts through its text. */}
                <span className="pointer-events-none absolute left-1/2 top-full -translate-x-1/2 mt-1 flex flex-col items-center w-max rounded-md bg-card/90 px-1 py-px">
                  <span className={`max-w-[6.75rem] truncate text-[11.5px] font-medium leading-tight ${isDim ? "text-muted-foreground" : "text-foreground"}`}>
                    {spec.face}
                  </span>
                  {spec.sub && <span className="max-w-[7.5rem] truncate text-[10.5px] leading-tight text-muted-foreground">{spec.sub}</span>}
                </span>
              </button>
            );
          })}
        </>
      )}

      <Popover
        open={!!openSpec && !drag}
        onOpenChange={(o) => { if (!o) closeCard(); }}
        anchorRef={anchorRef as React.RefObject<HTMLElement>}
        width={openSpec?.cardWidth ?? 296}
        autoFocus={pinned}
        ariaLabel={openSpec?.ariaLabel}
        onPointerEnter={clearTimer}
        onPointerLeave={scheduleClose}
      >
        {/* Interacting with a card pins it: a picker inside it can open its own
            list without the hover timer closing the card underneath. */}
        <div onPointerDownCapture={() => setPinned(true)} onKeyDownCapture={() => setPinned(true)}>
          {openSpec?.card(cardCtx)}
        </div>
      </Popover>

      {/* The ghost: direct manipulation, so it follows the pointer even under reduced motion. */}
      {drag && (
        <div
          aria-hidden
          className="fixed left-0 top-0 z-[80] pointer-events-none"
          style={{
            transform: `translate3d(${drag.x - 28}px, ${drag.y - 28}px, 0)`,
            transition: drag.returning ? "transform 160ms cubic-bezier(0.16,1,0.3,1)" : undefined,
          }}
        >
          <div className="w-14 h-14 rounded-full grid place-items-center bg-card border border-border shadow-floating">{drag.glyph}</div>
          <div className="mt-1 text-center text-[11.5px] font-medium text-foreground">{drag.face}</div>
        </div>
      )}
    </div>
  );
}
