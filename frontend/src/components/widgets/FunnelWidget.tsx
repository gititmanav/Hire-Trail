import { Bar } from "react-chartjs-2";
import "../../utils/chartSetup.ts";
import type { AnalyticsData, Stage } from "../../types";
const STAGES: Stage[] = ["Applied", "OA", "Interview", "Offer"];
const COLORS = ["#378ADD", "#EF9F27", "#7F77DD", "#1D9E75"];
interface Props { data: AnalyticsData; }
export default function FunnelWidget({ data }: Props) {
  const chartData = { labels: STAGES, datasets: [{ data: STAGES.map((s) => data.funnel[s] || 0), backgroundColor: COLORS, borderRadius: 6, borderSkipped: false as const, barThickness: 40 }] };
  const options = { plugins: { tooltip: { backgroundColor: "rgba(0,0,0,0.8)", padding: 10, cornerRadius: 8 }, datalabels: { display: true, anchor: "end" as const, align: "top" as const, font: { weight: "bold" as const, size: 12 }, color: "#6b7280" } }, scales: { x: { grid: { display: false }, ticks: { color: "#9ca3af" }, border: { display: false } }, y: { grid: { color: "rgba(0,0,0,0.06)" }, ticks: { color: "#9ca3af" }, border: { display: false } } } };
  return <div className="h-full w-full p-1"><Bar data={chartData} options={options} /></div>;
}
