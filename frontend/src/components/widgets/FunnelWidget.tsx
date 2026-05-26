/**
 * Dashboard funnel chart — Applied → OA → Interview → Offer (+ Rejected).
 *
 * Clicking a bar navigates to /applications?stage=<stage> so the user can
 * jump straight to that slice. Chart.js's default animation handles count
 * updates; we just shorten the duration so a re-fetched count "snaps" rather
 * than drifts for a second. Cursor flips to pointer on hover for affordance.
 */
import { useCallback, useContext, useEffect, useRef } from "react";
import { Bar } from "react-chartjs-2";
import { useNavigate } from "react-router-dom";
import { ThemeContext } from "../../App.tsx";
import { stageColor, mutedFgColor, borderColor } from "../../utils/chartSetup.ts";
import { FUNNEL_STAGES } from "../../utils/stageStyles.ts";
import type { AnalyticsData } from "../../types";
import type { Chart as ChartJS } from "chart.js";

interface Props { data: AnalyticsData; }

export default function FunnelWidget({ data }: Props) {
  const { themeId } = useContext(ThemeContext);
  const chartRef = useRef<ChartJS<"bar">>(null);
  const navigate = useNavigate();

  const colors = FUNNEL_STAGES.map((s) => stageColor(s));
  const muted = mutedFgColor();
  const grid = borderColor();

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const c = FUNNEL_STAGES.map((s) => stageColor(s));
    const m = mutedFgColor();
    const g = borderColor();
    chart.data.datasets[0].backgroundColor = c;
    if (chart.options.plugins?.datalabels) (chart.options.plugins.datalabels as any).color = m;
    if (chart.options.scales?.x?.ticks) (chart.options.scales.x.ticks as any).color = m;
    if (chart.options.scales?.y?.ticks) (chart.options.scales.y.ticks as any).color = m;
    if (chart.options.scales?.y?.grid) (chart.options.scales.y.grid as any).color = g;
    chart.update("none");
  }, [themeId]);

  const handleBarClick = useCallback(
    (_e: unknown, elements: { index: number }[]) => {
      if (elements.length === 0) return;
      const stage = FUNNEL_STAGES[elements[0].index];
      if (!stage) return;
      navigate(`/applications?stage=${encodeURIComponent(stage)}`);
    },
    [navigate],
  );

  const chartData = {
    labels: FUNNEL_STAGES,
    datasets: [{
      data: FUNNEL_STAGES.map((s) => data.funnel[s] || 0),
      backgroundColor: colors,
      borderRadius: 6,
      borderSkipped: false as const,
      barThickness: 40,
    }],
  };
  const options = {
    onClick: handleBarClick,
    onHover: (event: { native?: Event | null }, elements: unknown[]) => {
      const target = (event.native?.target as HTMLElement | undefined);
      if (target) target.style.cursor = elements.length > 0 ? "pointer" : "default";
    },
    animation: {
      duration: 450,
      easing: "easeOutCubic" as const,
    },
    plugins: {
      tooltip: {
        backgroundColor: "rgba(0,0,0,0.8)",
        padding: 10,
        cornerRadius: 8,
        callbacks: {
          // Append a hint so users discover the click-to-filter affordance.
          afterLabel: () => "Click to filter Applications",
        },
      },
      datalabels: {
        display: true,
        anchor: "end" as const,
        align: "top" as const,
        font: { weight: "bold" as const, size: 12 },
        color: muted,
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: muted }, border: { display: false } },
      y: { grid: { color: grid }, ticks: { color: muted }, border: { display: false } },
    },
  };

  return (
    <div className="h-full w-full p-1">
      <Bar ref={chartRef} data={chartData} options={options} />
    </div>
  );
}
