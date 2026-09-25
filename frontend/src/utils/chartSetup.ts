/** Shared Chart.js registration, defaults, and theme-aware color helpers. */
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend, Filler } from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";
ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend, Filler, ChartDataLabels);
ChartJS.defaults.font.family = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
ChartJS.defaults.font.size = 12;
ChartJS.defaults.plugins.legend.display = false;
if (ChartJS.defaults.plugins.datalabels) {
  ChartJS.defaults.plugins.datalabels.display = false;
}
ChartJS.defaults.responsive = true;
ChartJS.defaults.maintainAspectRatio = false;
export { ChartJS };

/* Canvas can't resolve CSS variables, so charts read the live token values
 * at draw time (and re-read when the theme changes). No literals here — every
 * color comes from App.css or a Custom theme. */
function readVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** A theme token (HSL triplet) as a color string, optionally translucent. */
export function tokenColor(name: string, alpha = 1): string {
  const v = readVar(name);
  return alpha === 1 ? `hsl(${v})` : `hsl(${v} / ${alpha})`;
}

/** A palette color (App.css `--palette-*`, RGB triplet), e.g. "blue-500". */
export function paletteColor(name: string, alpha = 1): string {
  const [r, g, b] = readVar(`--palette-${name}`).split(/\s+/);
  return alpha === 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** The five chart colors, optionally translucent. */
export function chartColors(alpha = 1): string[] {
  return ["--chart-1", "--chart-2", "--chart-3", "--chart-4", "--chart-5"].map((t) => tokenColor(t, alpha));
}

function isDarkMode(): boolean {
  return document.documentElement.classList.contains("dark");
}

/** Stage → palette color (the 500s in light, the 400s in dark). */
const STAGE_PALETTE: Record<string, string> = {
  applied: "blue",
  oa: "amber",
  interview: "violet",
  offer: "emerald",
  rejected: "rose",
};

/** Semantic stage colors to keep analytics meaning consistent across charts. */
export function stageColor(stage: string): string {
  const family = STAGE_PALETTE[stage.toLowerCase()];
  if (!family) return chartColors()[0];
  return paletteColor(`${family}-${isDarkMode() ? 400 : 500}`);
}

/** Get the primary color from CSS variables, optionally translucent. */
export function primaryColor(alpha = 1): string {
  return tokenColor("--primary", alpha);
}

/** Get muted-foreground for axis labels, grid lines, etc. */
export function mutedFgColor(): string {
  return tokenColor("--muted-foreground");
}

/** Get border color for grid lines. */
export function borderColor(): string {
  return tokenColor("--border");
}

/** Get card color for tooltip backgrounds. */
export function cardColor(): string {
  return tokenColor("--card");
}

/** Get foreground color. */
export function fgColor(): string {
  return tokenColor("--foreground");
}

/** Chart tooltip background — the scrim at 80%. */
export function tooltipColor(): string {
  return tokenColor("--scrim", 0.8);
}
