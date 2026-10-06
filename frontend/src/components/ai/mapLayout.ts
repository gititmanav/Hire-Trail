/** The AI map's geometry — pure and deterministic (same data, same picture).
 *
 *  One cluster per hub (a key, Included, My assistant, Off): the hub at the
 *  centre, its features on an orbit. Clusters pack left→right and wrap by the
 *  measured stage width; each box hugs its satellites' actual extent, so a
 *  lone feature east of its hub doesn't reserve a whole empty arc above it.
 *  Ported from Sora's AI map v2 (the web). */

export interface Geometry {
  hubR: number;
  satR: number;
  minOrbit: number;
  gap: number;
  /** Half the width a node's label needs under its circle. */
  labelHalf: number;
}

/** Full size, and a tighter set for phones. */
export function geometryFor(stageWidth: number): Geometry {
  return stageWidth < 520
    ? { hubR: 28, satR: 23, minOrbit: 86, gap: 10, labelHalf: 44 }
    : { hubR: 34, satR: 28, minOrbit: 110, gap: 16, labelHalf: 54 };
}

export interface ClusterInput {
  id: string;
  satIds: string[];
}

export interface PlacedCluster {
  id: string;
  cx: number;
  cy: number;
  orbit: number;
  /** Drop-target radius around the hub. */
  haloR: number;
  sats: { id: string; x: number; y: number }[];
}

export interface Layout {
  clusters: PlacedCluster[];
  height: number;
  geo: Geometry;
}

function angle(i: number, n: number): number {
  // One satellite sits east; more go round from the top. An even count is
  // turned half a step so none sits straight below the hub, where its edge
  // would run through the hub's label (two sit west and east).
  const step = 360 / n;
  const start = n === 1 ? 0 : n % 2 === 0 ? -90 - step / 2 : -90;
  return ((start + i * step) * Math.PI) / 180;
}

export function layoutClusters(inputs: ClusterInput[], stageWidth: number): Layout {
  const geo = geometryFor(stageWidth);
  const { hubR, satR, minOrbit, gap, labelHalf } = geo;

  const metrics = inputs.map((c) => {
    const n = c.satIds.length;
    const orbit = n ? Math.max(minOrbit, (n * (2 * satR + 14)) / (2 * Math.PI)) : 0;
    let minX = -Math.max(hubR, labelHalf);
    let maxX = Math.max(hubR, labelHalf);
    let minY = -hubR;
    let maxY = hubR;
    for (let i = 0; i < n; i++) {
      const a = angle(i, n);
      const sx = orbit * Math.cos(a);
      const sy = orbit * Math.sin(a);
      minX = Math.min(minX, sx - labelHalf);
      maxX = Math.max(maxX, sx + labelHalf);
      minY = Math.min(minY, sy - satR);
      maxY = Math.max(maxY, sy + satR);
    }
    const leftW = -minX + 6;
    // Room under the lowest circle for its label (one or two lines).
    return { c, orbit, leftW, topH: -minY + 10, boxW: leftW + maxX + 6, botH: maxY + 46, cx: 0, cy: 0 };
  });

  const rows: (typeof metrics)[] = [];
  let row: typeof metrics = [];
  let rowW = 0;
  for (const m of metrics) {
    const next = rowW + (row.length ? gap : 0) + m.boxW;
    if (row.length && next > stageWidth) {
      rows.push(row);
      row = [m];
      rowW = m.boxW;
    } else {
      row.push(m);
      rowW = next;
    }
  }
  if (row.length) rows.push(row);

  let y = 6;
  for (const r of rows) {
    const top = Math.max(...r.map((m) => m.topH));
    const bot = Math.max(...r.map((m) => m.botH));
    const w = r.reduce((s, m) => s + m.boxW, 0) + gap * (r.length - 1);
    let x = Math.max(0, (stageWidth - w) / 2);
    for (const m of r) {
      m.cx = x + m.leftW;
      m.cy = y + top;
      x += m.boxW + gap;
    }
    y += top + bot + gap;
  }

  return {
    geo,
    height: Math.max(y + 6, 240),
    clusters: metrics.map((m) => ({
      id: m.c.id,
      cx: m.cx,
      cy: m.cy,
      orbit: m.orbit,
      haloR: m.c.satIds.length ? m.orbit + satR + 10 : hubR + 22,
      sats: m.c.satIds.map((id, i) => {
        const a = angle(i, m.c.satIds.length);
        return { id, x: m.cx + m.orbit * Math.cos(a), y: m.cy + m.orbit * Math.sin(a) };
      }),
    })),
  };
}

/** Gap between an edge's end and the circle it meets. */
const EDGE_GAP = 5;

/** A straight edge from the hub's rim to the satellite's rim, stopping just
 *  short of each circle — nothing is ever drawn under a node (Sora's web).
 *  Empty when the circles are too close to leave a line between them. */
export function edgePath(x1: number, y1: number, r1: number, x2: number, y2: number, r2: number): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.hypot(dx, dy);
  const from = r1 + EDGE_GAP;
  const to = r2 + EDGE_GAP;
  if (dist <= from + to) return "";
  const ux = dx / dist;
  const uy = dy / dist;
  return `M ${x1 + ux * from} ${y1 + uy * from} L ${x2 - ux * to} ${y2 - uy * to}`;
}

/** Edge width from a week's calls: 1.5px quiet, up to 4px busy. */
export function edgeWidth(calls7d: number): number {
  return 1.5 + Math.min(2.5, Math.sqrt(calls7d) * 0.55);
}

/** The cluster under a point (stage coordinates), nearest hub first. */
export function hitCluster(clusters: PlacedCluster[], x: number, y: number): PlacedCluster | null {
  let best: PlacedCluster | null = null;
  let bestD = Infinity;
  for (const c of clusters) {
    const d = Math.hypot(c.cx - x, c.cy - y);
    if (d <= c.haloR + 6 && d < bestD) {
      best = c;
      bestD = d;
    }
  }
  return best;
}
