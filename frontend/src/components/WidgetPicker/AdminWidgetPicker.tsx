import { useEffect } from "react";
import {
  X, Minus, LayoutGrid, TrendingUp, BarChart3, AlignLeft, ChevronsRight, Building2, Users,
  type LucideIcon,
} from "lucide-react";
import { ADMIN_WIDGETS } from "../../hooks/useAdminWidgetLayout.ts";
const IC: Record<string, LucideIcon> = {
  stats: LayoutGrid,
  "user-growth": TrendingUp,
  "apps-per-day": BarChart3,
  activity: AlignLeft,
  "conversion-rates": ChevronsRight,
  funnel: BarChart3,
  "top-companies": Building2,
  "top-roles": Users,
  summary: BarChart3,
};
interface Props { visible: Record<string, boolean>; onToggle: (id: string) => void; onReset: () => void; onClose: () => void; }
export default function AdminWidgetPicker({ visible, onToggle, onReset, onClose }: Props) {
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; document.addEventListener("keydown", h); return () => document.removeEventListener("keydown", h); }, [onClose]);
  return (
    <div className="fixed inset-0 bg-black/45 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-card rounded-xl p-6 w-full max-w-[480px] max-h-[85vh] overflow-y-auto shadow-2xl animate-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5"><h2 className="text-lg font-semibold text-foreground">Dashboard widgets</h2><button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted"><X size={16} strokeWidth={2} /></button></div>
        <p className="text-sm text-muted-foreground mb-4">Toggle widgets to show or hide them on your admin dashboard.</p>
        <div className="space-y-2">{ADMIN_WIDGETS.map((w) => {
          const Icon = IC[w.id] || Minus;
          return (
          <button key={w.id} onClick={() => onToggle(w.id)} className={`flex items-center gap-3 w-full px-4 py-3 rounded-lg border ${visible[w.id] ? "border-primary bg-primary/10" : "border-border hover:bg-muted"}`}>
            <Icon size={20} strokeWidth={1.5} className={visible[w.id] ? "text-primary" : "text-muted-foreground"} />
            <span className={`text-sm font-medium ${visible[w.id] ? "text-foreground" : "text-muted-foreground"}`}>{w.title}</span>
            <div className="ml-auto"><div className={`w-9 h-5 rounded-full p-0.5 ${visible[w.id] ? "bg-primary" : "bg-muted-foreground/30"}`}><div className={`w-4 h-4 rounded-full bg-white transition-transform ${visible[w.id] ? "translate-x-4" : "translate-x-0"}`}/></div></div>
          </button>
          );
        })}</div>
        <div className="flex justify-between mt-5 pt-4 border-t border-border"><button onClick={onReset} className="text-sm text-muted-foreground hover:text-danger">Reset to defaults</button><button onClick={onClose} className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg">Done</button></div>
      </div>
    </div>
  );
}
