import { useRef, useEffect, useContext } from "react";
import { Line } from "react-chartjs-2";
import { ThemeContext } from "../../App.tsx";
import { primaryColor, mutedFgColor, borderColor } from "../../utils/chartSetup.ts";
import type { AnalyticsData } from "../../types";
import type { Chart as ChartJS } from "chart.js";

interface Props { data: AnalyticsData; }

export default function TrendWidget({ data }: Props) {
  const { themeId } = useContext(ThemeContext);
  const chartRef = useRef<ChartJS<"line">>(null);

  if (data.weeklyTrend.length < 2) return <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Not enough data yet</div>;

  const primary = primaryColor();
  const muted = mutedFgColor();
  const grid = borderColor();
  const fillBg = primary.replace("hsl(", "hsla(").replace(")", " / 0.08)");

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const p = primaryColor();
    const m = mutedFgColor();
    const g = borderColor();
    const fill = p.replace("hsl(", "hsla(").replace(")", " / 0.08)");
    const ds = chart.data.datasets[0];
    ds.borderColor = p;
    ds.backgroundColor = fill;
    ds.pointBackgroundColor = p;
    if (chart.options.scales?.x?.ticks) (chart.options.scales.x.ticks as any).color = m;
    if (chart.options.scales?.y?.ticks) (chart.options.scales.y.ticks as any).color = m;
    if (chart.options.scales?.y?.grid) (chart.options.scales.y.grid as any).color = g;
    chart.update("none");
  }, [themeId]);

  const labels = data.weeklyTrend.map((w) => new Date(w.firstDate).toLocaleDateString("en-US", { month: "short", day: "numeric" }));
  const values = data.weeklyTrend.map((w) => w.count);
  const chartData = { labels, datasets: [{ data: values, borderColor: primary, backgroundColor: fillBg, fill: true, tension: 0.3, pointRadius: 3, pointHoverRadius: 6, pointBackgroundColor: primary, borderWidth: 2 }] };
  const options = { plugins: { tooltip: { backgroundColor: "rgba(0,0,0,0.8)", padding: 10, cornerRadius: 8 } }, scales: { x: { grid: { display: false }, ticks: { color: muted, font: { size: 10 }, maxTicksLimit: 8 }, border: { display: false } }, y: { grid: { color: grid }, ticks: { color: muted, precision: 0 }, border: { display: false }, beginAtZero: true } } };

  return <div className="h-full w-full p-1"><Line ref={chartRef} data={chartData} options={options} /></div>;
}
