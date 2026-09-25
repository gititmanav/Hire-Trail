/** Small DOM helpers the scroll scenes share: find the marked parts of a
 *  composition once, measure them in its own coordinates, and write styles
 *  per frame without touching React. */

export interface Box { x: number; y: number; w: number; h: number }

/** An element's box in `root`'s own (untransformed) coordinates. */
export function boxWithin(el: HTMLElement | null | undefined, root: HTMLElement): Box {
  if (!el) return { x: 0, y: 0, w: 0, h: 0 };
  let x = 0;
  let y = 0;
  let node: HTMLElement | null = el;
  while (node && node !== root) {
    x += node.offsetLeft;
    y += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return { x, y, w: el.offsetWidth, h: el.offsetHeight };
}

export const center = (b: Box) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });

export type Els = Record<string, HTMLElement>;

/** Every `[data-lp]` inside `root`, by name (the first of each name). */
export function collect(root: HTMLElement): Els {
  const map: Els = {};
  root.querySelectorAll<HTMLElement>("[data-lp]").forEach((el) => {
    const key = el.dataset.lp!;
    if (!(key in map)) map[key] = el;
  });
  return map;
}

export function css(el: HTMLElement | null | undefined, props: Record<string, string | number>) {
  if (!el) return;
  for (const [k, v] of Object.entries(props)) {
    const value = String(v);
    if (k.startsWith("--")) el.style.setProperty(k, value);
    else (el.style as unknown as Record<string, string>)[k] = value;
  }
}

export function setText(el: HTMLElement | null | undefined, text: string) {
  if (el && el.textContent !== text) el.textContent = text;
}

export function setState(el: HTMLElement | null | undefined, state: string) {
  if (el && el.dataset.state !== state) el.dataset.state = state;
}

export const round = (v: number, d = 3) => Math.round(v * 10 ** d) / 10 ** d;
