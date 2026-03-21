import type { AnalyticsData, Stage } from "../../types";
interface Props { data: AnalyticsData; }
export default function StatsWidget({ data }: Props) {
  const { funnel: f, total } = data;
  const active = total - (f["Rejected" as Stage] || 0);
  const stats = [
    { label: "Total applications", value: total, color: "" },
    { label: "In progress", value: (f["OA" as Stage] || 0) + (f["Interview" as Stage] || 0), color: "" },
    { label: "Offers", value: f["Offer" as Stage] || 0, color: "text-success" },
    { label: "Response rate", value: `${active > 0 ? Math.round((((f["OA" as Stage] || 0) + (f["Interview" as Stage] || 0) + (f["Offer" as Stage] || 0)) / active) * 100) : 0}%`, color: "text-accent" },
  ];
  return (<div className="grid grid-cols-2 md:grid-cols-4 gap-3 h-full">{stats.map((s, i) => (<div key={i} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 flex flex-col justify-center"><div className="text-[12px] text-gray-500 dark:text-gray-400 mb-1">{s.label}</div><div className={`text-2xl font-bold text-gray-900 dark:text-white ${s.color}`}>{s.value}</div></div>))}</div>);
}
