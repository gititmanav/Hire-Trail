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

/** Read a CSS variable as an hsl() string from the root element. */
function cssVar(name: string): string {
  const val = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return val ? `hsl(${val})` : "";
}

/** Get the 5 tweakcn chart colors resolved from CSS variables. */
export function chartColors(): string[] {
  return [
    cssVar("--chart-1") || "#378ADD",
    cssVar("--chart-2") || "#EF9F27",
    cssVar("--chart-3") || "#7F77DD",
    cssVar("--chart-4") || "#1E3A8A",
    cssVar("--chart-5") || "#E24B4A",
  ];
}

function isDarkMode(): boolean {
  return document.documentElement.classList.contains("dark");
}

const STAGE_COLORS_LIGHT: Record<string, string> = {
  applied: "#3b82f6",
  oa: "#f59e0b",
  interview: "#8b5cf6",
  offer: "#10b981",
  rejected: "#f43f5e",
};

const STAGE_COLORS_DARK: Record<string, string> = {
  applied: "#60a5fa",
  oa: "#fbbf24",
  interview: "#a78bfa",
  offer: "#34d399",
  rejected: "#fb7185",
};

/** Semantic stage colors to keep analytics meaning consistent across charts. */
export function stageColor(stage: string): string {
  const key = stage.toLowerCase();
  const palette = isDarkMode() ? STAGE_COLORS_DARK : STAGE_COLORS_LIGHT;
  return palette[key] || chartColors()[0];
}

/** Get the primary color from CSS variables. */
export function primaryColor(): string {
  return cssVar("--primary") || "#378ADD";
}

/** Get muted-foreground for axis labels, grid lines, etc. */
export function mutedFgColor(): string {
  return cssVar("--muted-foreground") || "#9ca3af";
}

/** Get border color for grid lines. */
export function borderColor(): string {
  return cssVar("--border") || "rgba(0,0,0,0.06)";
}

/** Get card color for tooltip backgrounds. */
export function cardColor(): string {
  return cssVar("--card") || "#ffffff";
}

/** Get foreground color. */
export function fgColor(): string {
  return cssVar("--foreground") || "#111827";
}
