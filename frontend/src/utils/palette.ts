/** A palette color (App.css `--palette-*`) as a CSS value. It resolves live,
 *  so presets render Tailwind's exact color and a Custom theme re-tints it.
 *  For canvas (charts), use chartSetup's `paletteColor`, which resolves now. */
export function cssPalette(name: string, alpha?: number): string {
  return alpha == null ? `rgb(var(--palette-${name}))` : `rgb(var(--palette-${name}) / ${alpha})`;
}
