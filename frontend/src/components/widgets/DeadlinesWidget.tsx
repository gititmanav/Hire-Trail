import { Link } from "react-router-dom";
import type { Deadline } from "../../types";
const dn = (d: string) => Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
const dl = (d: string) => { const n = dn(d); return n === 0 ? "Today" : n === 1 ? "Tomorrow" : `${n}d`; };
const dc = (d: string) => { const n = dn(d); if (n < 0) return "text-danger font-bold"; if (n <= 2) return "text-warning font-bold"; if (n <= 7) return "text-accent font-medium"; return "text-gray-400"; };
interface Props { deadlines: Deadline[]; }
export default function DeadlinesWidget({ deadlines }: Props) {
  if (deadlines.length === 0) return <div className="h-full flex flex-col items-center justify-center text-gray-400"><p className="text-sm">All caught up</p></div>;
  return (<div className="h-full flex flex-col"><div className="flex items-center justify-between mb-3"><span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Due soon</span><Link to="/deadlines" className="text-xs text-accent hover:underline">View all</Link></div><div className="flex-1 overflow-auto divide-y divide-gray-100 dark:divide-gray-700">{deadlines.map((d)=><div key={d._id} className="flex items-center justify-between py-2.5"><div className="min-w-0"><div className="text-[13px] font-medium text-gray-900 dark:text-white truncate">{d.type}</div>{d.notes&&<div className="text-[11px] text-gray-400 truncate max-w-[200px]">{d.notes}</div>}</div><span className={`text-[12px] whitespace-nowrap ml-3 ${dc(d.dueDate)}`}>{dl(d.dueDate)}</span></div>)}</div></div>);
}
