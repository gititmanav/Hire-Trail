/** How each AI provider reads on screen: its colour (map edges, the mark's
 *  tint) and its monogram. Colours come from the palette so themes re-tint
 *  them; the two monochrome brands (OpenAI, xAI) use the foreground ink. */
import { cssPalette } from "../../utils/palette.ts";
import type { AiProviderId } from "../../utils/aiApi.ts";

interface ProviderStyle {
  /** Palette name ("blue-500"), or null for the ink brands. */
  palette: string | null;
  monogram: string;
}

const STYLES: Record<AiProviderId, ProviderStyle> = {
  google: { palette: "blue-500", monogram: "G" },
  anthropic: { palette: "orange-400", monogram: "A" },
  openai: { palette: null, monogram: "O" },
  xai: { palette: null, monogram: "x" },
  deepseek: { palette: "indigo-500", monogram: "D" },
  mistral: { palette: "amber-500", monogram: "M" },
  groq: { palette: "rose-500", monogram: "g" },
  openrouter: { palette: "violet-500", monogram: "R" },
};

export function providerColor(id: AiProviderId | null | undefined, alpha?: number): string {
  const s = id ? STYLES[id] : null;
  if (!s?.palette) return alpha == null ? "hsl(var(--foreground))" : `hsl(var(--foreground) / ${alpha})`;
  return cssPalette(s.palette, alpha);
}

export function providerMonogram(id: AiProviderId): string {
  return STYLES[id]?.monogram ?? id.charAt(0).toUpperCase();
}
