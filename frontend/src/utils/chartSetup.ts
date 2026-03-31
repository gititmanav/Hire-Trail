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
    cssVar("--chart-4") || "#1D9E75",
    cssVar("--chart-5") || "#E24B4A",
  ];
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
