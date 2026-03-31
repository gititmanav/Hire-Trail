import { useContext } from "react";
import { Bar } from "react-chartjs-2";
import { ThemeContext } from "../../App.tsx";
import { chartColors, mutedFgColor, borderColor } from "../../utils/chartSetup.ts";
import type { AnalyticsData, Stage } from "../../types";
const STAGES: Stage[] = ["Applied", "OA", "Interview", "Offer"];
interface Props { data: AnalyticsData; }
export default function FunnelWidget({ data }: Props) {
  const { themeId } = useContext(ThemeContext);
  const colors = chartColors();
  const muted = mutedFgColor();
  const grid = borderColor();
  const chartData = { labels: STAGES, datasets: [{ data: STAGES.map((s) => data.funnel[s] || 0), backgroundColor: colors.slice(0, 4), borderRadius: 6, borderSkipped: false as const, barThickness: 40 }] };
  const options = { plugins: { tooltip: { backgroundColor: "rgba(0,0,0,0.8)", padding: 10, cornerRadius: 8 }, datalabels: { display: true, anchor: "end" as const, align: "top" as const, font: { weight: "bold" as const, size: 12 }, color: muted } }, scales: { x: { grid: { display: false }, ticks: { color: muted }, border: { display: false } }, y: { grid: { color: grid }, ticks: { color: muted }, border: { display: false } } } };
  return <div className="h-full w-full p-1" key={themeId}><Bar data={chartData} options={options} /></div>;
}
