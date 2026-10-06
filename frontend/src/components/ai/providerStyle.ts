/** Each AI provider's colour on screen — the map's edges and the legend.
 *  Close to the brand's own colour, taken from the palette so themes re-tint
 *  it; the monochrome brands (OpenAI, xAI) use the foreground ink. (The mark
 *  itself is the real logo: BrandLogo.) */
import { cssPalette } from "../../utils/palette.ts";
import type { AiProviderId } from "../../utils/aiApi.ts";

/** Palette name ("blue-500"), or null for the ink brands. */
const PALETTE: Record<AiProviderId, string | null> = {
  google: "blue-500",
  anthropic: "orange-400",
  openai: null,
  xai: null,
  deepseek: "indigo-500",
  mistral: "amber-500",
  groq: "rose-500",
  openrouter: "violet-500",
};

export function providerColor(id: AiProviderId | null | undefined, alpha?: number): string {
  const palette = id ? PALETTE[id] : null;
  if (!palette) return alpha == null ? "hsl(var(--foreground))" : `hsl(var(--foreground) / ${alpha})`;
  return cssPalette(palette, alpha);
}
