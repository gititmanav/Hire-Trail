/** One stack for every dismissable floating layer — modals, popovers, menus,
 *  selects, the date picker. Escape applies to the TOP layer only, so pressing
 *  Escape in an open dropdown closes the dropdown, not the modal underneath.
 *
 *  Outside clicks are decided by containment, not by stack position: a layer
 *  ignores a click only when it landed inside itself or inside a layer opened
 *  on top of it (a Select's list inside the Filters panel). Anything else —
 *  including another dropdown's trigger — closes it. (Stack position alone got
 *  this wrong: the dropdown being opened registers before the click reaches
 *  the document, so the one already open thought it wasn't on top and stayed.) */
interface Layer { id: symbol; el?: () => HTMLElement | null }

const layers: Layer[] = [];

/** `el` returns the layer's panel, so layers below can tell a click inside it. */
export function pushLayer(label = "layer", el?: () => HTMLElement | null): symbol {
  const id = Symbol(label);
  layers.push({ id, el });
  return id;
}

export function popLayer(id: symbol): void {
  const i = layers.findIndex((l) => l.id === id);
  if (i !== -1) layers.splice(i, 1);
}

export function isTopLayer(id: symbol): boolean {
  return layers[layers.length - 1]?.id === id;
}

/** Is `node` inside a layer stacked above `id`? */
export function isInsideLayerAbove(id: symbol, node: Node): boolean {
  const i = layers.findIndex((l) => l.id === id);
  if (i === -1) return false;
  return layers.slice(i + 1).some((l) => l.el?.()?.contains(node));
}

export function layerCount(): number {
  return layers.length;
}
