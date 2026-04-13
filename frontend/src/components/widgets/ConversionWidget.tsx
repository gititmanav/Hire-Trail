import type { AnalyticsData, Stage } from "../../types";
const STAGES: Stage[] = ["Applied", "OA", "Interview", "Offer"];
interface Props { data: AnalyticsData; }
export default function ConversionWidget({ data }: Props) {
  const { funnel: f } = data;
  const conv = STAGES.slice(1).map((s, i) => { const p = f[STAGES[i]] || 0; const c = f[s] || 0; return { from: STAGES[i], to: s, rate: p > 0 ? Math.round((c / p) * 100) : 0, count: c, prev: p }; });
  return (<div className="space-y-4 h-full flex flex-col justify-center">{conv.map((c) => (<div key={c.to}><div className="flex items-center justify-between mb-1.5"><span className="text-[13px] font-medium text-muted-foreground">{c.from} &rarr; {c.to}</span><span className="text-xs text-muted-foreground">{c.count}/{c.prev}</span></div><div className="h-2.5 bg-muted rounded-full overflow-hidden"><div className="h-full bg-primary rounded-full transition-[width] duration-500 ease-out" style={{ width: `${Math.min(c.rate, 100)}%` }} /></div><div className="text-right mt-1"><span className="text-lg font-bold text-foreground">{c.rate}%</span></div></div>))}</div>);
}
