import { Line } from "react-chartjs-2";
import "../../utils/chartSetup.ts";
import type { AnalyticsData } from "../../types";
interface Props { data: AnalyticsData; }
export default function TrendWidget({ data }: Props) {
  if (data.weeklyTrend.length < 2) return <div className="h-full flex items-center justify-center text-sm text-gray-400">Not enough data yet</div>;
  const labels = data.weeklyTrend.map((w) => new Date(w.firstDate).toLocaleDateString("en-US", { month: "short", day: "numeric" }));
  const values = data.weeklyTrend.map((w) => w.count);
  const chartData = { labels, datasets: [{ data: values, borderColor: "#378ADD", backgroundColor: "rgba(55,138,221,0.08)", fill: true, tension: 0.3, pointRadius: 3, pointHoverRadius: 6, pointBackgroundColor: "#378ADD", borderWidth: 2 }] };
  const options = { plugins: { tooltip: { backgroundColor: "rgba(0,0,0,0.8)", padding: 10, cornerRadius: 8 } }, scales: { x: { grid: { display: false }, ticks: { color: "#9ca3af", font: { size: 10 }, maxTicksLimit: 8 }, border: { display: false } }, y: { grid: { color: "rgba(0,0,0,0.06)" }, ticks: { color: "#9ca3af", precision: 0 }, border: { display: false }, beginAtZero: true } } };
  return <div className="h-full w-full p-1"><Line data={chartData} options={options} /></div>;
}
