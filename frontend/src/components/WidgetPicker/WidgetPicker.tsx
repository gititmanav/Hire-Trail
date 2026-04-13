import { useEffect } from "react";
import { ALL_WIDGETS } from "../../hooks/useWidgetLayout.ts";
const IC: Record<string, string> = { stats: "M3 3h7v8H3zM12 3h7v5h-7zM3 13h7v6H3zM12 10h7v9h-7z", funnel: "M6 20V14M12 20V4M18 20V10", conversion: "M13 17l5-5-5-5M6 17l5-5-5-5", trend: "M3 17l6-6 4 4 8-8", pie: "M21.21 15.89A10 10 0 118 2.83M22 12A10 10 0 0012 2v10z", "resume-perf": "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2", "recent-apps": "M4 6h16M4 12h16M4 18h10", deadlines: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" };
interface Props { visible: Record<string, boolean>; onToggle: (id: string) => void; onReset: () => void; onClose: () => void; }
export default function WidgetPicker({ visible, onToggle, onReset, onClose }: Props) {
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; document.addEventListener("keydown", h); return () => document.removeEventListener("keydown", h); }, [onClose]);
  return (
    <div className="fixed inset-0 bg-black/45 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-card rounded-xl p-6 w-full max-w-[480px] shadow-2xl animate-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5"><h2 className="text-lg font-semibold text-foreground">Dashboard widgets</h2><button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted"><svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="4" y1="4" x2="12" y2="12"/><line x1="12" y1="4" x2="4" y2="12"/></svg></button></div>
        <p className="text-sm text-muted-foreground mb-4">Toggle widgets to show or hide them on your dashboard.</p>
        <div className="space-y-2">{ALL_WIDGETS.map((w) => (
          <button key={w.id} onClick={() => onToggle(w.id)} className={`flex items-center gap-3 w-full px-4 py-3 rounded-lg border ${visible[w.id] ? "border-primary bg-primary/10" : "border-border hover:bg-muted"}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={visible[w.id] ? "text-primary" : "text-muted-foreground"}><path d={IC[w.id] || "M4 6h16"}/></svg>
            <span className={`text-sm font-medium ${visible[w.id] ? "text-foreground" : "text-muted-foreground"}`}>{w.title}</span>
            <div className="ml-auto"><div className={`w-9 h-5 rounded-full p-0.5 ${visible[w.id] ? "bg-primary" : "bg-muted-foreground/30"}`}><div className={`w-4 h-4 rounded-full bg-white transition-transform ${visible[w.id] ? "translate-x-4" : "translate-x-0"}`}/></div></div>
          </button>
        ))}</div>
        <div className="flex justify-between mt-5 pt-4 border-t border-border"><button onClick={onReset} className="text-sm text-muted-foreground hover:text-danger">Reset to defaults</button><button onClick={onClose} className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg">Done</button></div>
      </div>
    </div>
  );
}
