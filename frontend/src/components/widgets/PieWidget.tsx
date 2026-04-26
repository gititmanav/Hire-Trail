import { useRef, useEffect, useContext } from "react";
import { Doughnut } from "react-chartjs-2";
import { ThemeContext } from "../../App.tsx";
import { stageColor, mutedFgColor } from "../../utils/chartSetup.ts";
import type { AnalyticsData, Stage } from "../../types";
import type { Chart as ChartJS } from "chart.js";

const STAGES: Stage[] = ["Applied", "OA", "Interview", "Offer", "Rejected"];
interface Props { data: AnalyticsData; }

export default function PieWidget({ data }: Props) {
  const { themeId } = useContext(ThemeContext);
  const chartRef = useRef<ChartJS<"doughnut">>(null);
  const { funnel: f, total } = data;

  const colors = STAGES.map((s) => stageColor(s));
  const muted = mutedFgColor();

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const c = STAGES.map((s) => stageColor(s));
    const m = mutedFgColor();
    chart.data.datasets[0].backgroundColor = c;
    if (chart.options.plugins?.legend?.labels) (chart.options.plugins.legend.labels as any).color = m;
    chart.update("none");
  }, [themeId]);

  const chartData = { labels: STAGES, datasets: [{ data: STAGES.map((s) => f[s] || 0), backgroundColor: colors, borderWidth: 0, hoverOffset: 6 }] };
  const options = { cutout: "60%", plugins: { tooltip: { backgroundColor: "rgba(0,0,0,0.8)", padding: 10, cornerRadius: 8, callbacks: { label: (ctx: any) => { const pct = total > 0 ? Math.round((ctx.parsed / total) * 100) : 0; return ` ${ctx.label}: ${ctx.parsed} (${pct}%)`; } } }, legend: { display: true, position: "bottom" as const, labels: { boxWidth: 10, boxHeight: 10, borderRadius: 2, useBorderRadius: true, padding: 12, font: { size: 11 }, color: muted } } } };

  return <div className="h-full w-full flex items-center justify-center p-2"><Doughnut ref={chartRef} data={chartData} options={options} /></div>;
}
