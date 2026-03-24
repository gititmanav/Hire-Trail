import { useEffect } from "react";
import { ADMIN_WIDGETS } from "../../hooks/useAdminWidgetLayout.ts";
const IC: Record<string, string> = {
  stats: "M3 3h7v8H3zM12 3h7v5h-7zM3 13h7v6H3zM12 10h7v9h-7z",
  "user-growth": "M3 17l6-6 4 4 8-8",
  "apps-per-day": "M6 20V14M12 20V4M18 20V10",
  activity: "M4 6h16M4 12h16M4 18h10",
  "conversion-rates": "M13 17l5-5-5-5M6 17l5-5-5-5",
  funnel: "M6 20V14M12 20V4M18 20V10",
  "top-companies": "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5",
  "top-roles": "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2m8-10a4 4 0 100-8 4 4 0 000 8z",
  summary: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6m8 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0h6",
};
interface Props { visible: Record<string, boolean>; onToggle: (id: string) => void; onReset: () => void; onClose: () => void; }
export default function AdminWidgetPicker({ visible, onToggle, onReset, onClose }: Props) {
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; document.addEventListener("keydown", h); return () => document.removeEventListener("keydown", h); }, [onClose]);
  return (
    <div className="fixed inset-0 bg-black/45 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-[480px] max-h-[85vh] overflow-y-auto shadow-2xl animate-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5"><h2 className="text-lg font-semibold text-gray-900 dark:text-white">Dashboard widgets</h2><button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-600 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-600"><svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="4" y1="4" x2="12" y2="12"/><line x1="12" y1="4" x2="4" y2="12"/></svg></button></div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Toggle widgets to show or hide them on your admin dashboard.</p>
        <div className="space-y-2">{ADMIN_WIDGETS.map((w) => (
          <button key={w.id} onClick={() => onToggle(w.id)} className={`flex items-center gap-3 w-full px-4 py-3 rounded-lg border transition-colors ${visible[w.id] ? "border-accent bg-accent-light/50 dark:bg-accent/10 dark:border-accent/50" : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={visible[w.id] ? "text-accent" : "text-gray-400"}><path d={IC[w.id] || "M4 6h16"}/></svg>
            <span className={`text-sm font-medium ${visible[w.id] ? "text-gray-900 dark:text-white" : "text-gray-500 dark:text-gray-400"}`}>{w.title}</span>
            <div className="ml-auto"><div className={`w-9 h-5 rounded-full p-0.5 transition-colors ${visible[w.id] ? "bg-accent" : "bg-gray-300 dark:bg-gray-600"}`}><div className={`w-4 h-4 rounded-full bg-white transition-transform ${visible[w.id] ? "translate-x-4" : "translate-x-0"}`}/></div></div>
          </button>
        ))}</div>
        <div className="flex justify-between mt-5 pt-4 border-t border-gray-200 dark:border-gray-700"><button onClick={onReset} className="text-sm text-gray-500 hover:text-danger">Reset to defaults</button><button onClick={onClose} className="px-4 py-2 text-sm font-medium text-white bg-accent hover:bg-accent-hover rounded-lg">Done</button></div>
      </div>
    </div>
  );
}
