import { useContext } from "react";
import { Line } from "react-chartjs-2";
import { ThemeContext } from "../../App.tsx";
import { primaryColor, mutedFgColor, borderColor } from "../../utils/chartSetup.ts";
import type { AnalyticsData } from "../../types";
interface Props { data: AnalyticsData; }
export default function TrendWidget({ data }: Props) {
  const { themeId } = useContext(ThemeContext);
  if (data.weeklyTrend.length < 2) return <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Not enough data yet</div>;
  const primary = primaryColor();
  const muted = mutedFgColor();
  const grid = borderColor();
  const labels = data.weeklyTrend.map((w) => new Date(w.firstDate).toLocaleDateString("en-US", { month: "short", day: "numeric" }));
  const values = data.weeklyTrend.map((w) => w.count);
  const fillBg = primary.replace("hsl(", "hsla(").replace(")", " / 0.08)");
  const chartData = { labels, datasets: [{ data: values, borderColor: primary, backgroundColor: fillBg, fill: true, tension: 0.3, pointRadius: 3, pointHoverRadius: 6, pointBackgroundColor: primary, borderWidth: 2 }] };
  const options = { plugins: { tooltip: { backgroundColor: "rgba(0,0,0,0.8)", padding: 10, cornerRadius: 8 } }, scales: { x: { grid: { display: false }, ticks: { color: muted, font: { size: 10 }, maxTicksLimit: 8 }, border: { display: false } }, y: { grid: { color: grid }, ticks: { color: muted, precision: 0 }, border: { display: false }, beginAtZero: true } } };
  return <div className="h-full w-full p-1" key={themeId}><Line data={chartData} options={options} /></div>;
}
