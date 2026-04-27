import { Link } from "react-router-dom";
import type { Application, Stage } from "../../types";
import { STAGE_BADGE_CLASS } from "../../utils/stageStyles.ts";
const bc: Record<Stage, string> = STAGE_BADGE_CLASS;
const fmt = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
interface Props { apps: Application[]; }
export default function RecentAppsWidget({ apps }: Props) {
  if (apps.length === 0) return <div className="h-full flex flex-col items-center justify-center text-muted-foreground"><p className="text-sm mb-2">No applications yet</p><Link to="/applications" className="text-sm text-muted-foreground hover:text-foreground hover:underline">Add one</Link></div>;
  return (<div className="h-full flex flex-col"><div className="flex items-center justify-between mb-3"><span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Latest</span><Link to="/applications" className="text-xs text-muted-foreground hover:text-foreground hover:underline">View all</Link></div><div className="overflow-auto flex-1"><table className="w-full text-sm"><thead><tr>{["Company","Role","Stage","Date"].map((h)=><th key={h} className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-2 py-1.5 border-b border-border">{h}</th>)}</tr></thead><tbody className="divide-y divide-border">{apps.map((a)=><tr key={a._id} className="hover:bg-muted/30"><td className="px-2 py-2.5 font-medium text-foreground text-[13px]">{a.company}</td><td className="px-2 py-2.5 text-muted-foreground text-[13px] max-w-[160px] truncate">{a.role}</td><td className="px-2 py-2.5"><span className={`inline-block px-2 py-0.5 text-[11px] font-medium rounded-full ${bc[a.stage]}`}>{a.stage}</span></td><td className="px-2 py-2.5 text-muted-foreground text-[12px]">{fmt(a.applicationDate)}</td></tr>)}</tbody></table></div></div>);
}
