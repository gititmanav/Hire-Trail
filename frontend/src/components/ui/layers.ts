/** One stack for every dismissable floating layer — modals, select popovers,
 *  calendar popovers. Escape and outside-click always apply to the TOP layer
 *  only, so pressing Escape in an open dropdown closes the dropdown, not the
 *  modal underneath it. */
const layers: symbol[] = [];

export function pushLayer(label = "layer"): symbol {
  const id = Symbol(label);
  layers.push(id);
  return id;
}

export function popLayer(id: symbol): void {
  const i = layers.indexOf(id);
  if (i !== -1) layers.splice(i, 1);
}

export function isTopLayer(id: symbol): boolean {
  return layers[layers.length - 1] === id;
}

export function layerCount(): number {
  return layers.length;
}
