import { NavLink } from "react-router-dom";

interface Props { collapsed: boolean; onToggle: () => void; }

const nav = [
  { to: "/", label: "Dashboard", d: "M3 3h7v8H3zM12 3h7v5h-7zM3 13h7v6H3zM12 10h7v9h-7z" },
  { to: "/applications", label: "Applications", d: "M4 3h14a2 2 0 012 2v14a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2zm3 4h8m-8 3h8m-8 3h4" },
  { to: "/kanban", label: "Kanban Board", d: "M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v6m0 0H3m6 0v12m0-12h12m-12 0v12m0 0H5a2 2 0 01-2-2v-4m6 6h10a2 2 0 002-2v-4m0-6V5a2 2 0 00-2-2" },
  { to: "/jobs", label: "Job Search", d: "M11 11a4 4 0 100-8 4 4 0 000 8zm0 0l6 6m-13-2l3-3" },
  { to: "/resumes", label: "Resumes", d: "M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9l-7-7zm0 0v7h7" },
  { to: "/contacts", label: "Contacts", d: "M12 11a4 4 0 100-8 4 4 0 000 8zm-8 10v-1a6 6 0 016-6h4a6 6 0 016 6v1" },
  { to: "/deadlines", label: "Deadlines", d: "M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" },
  { to: "/import-export", label: "Import / Export", d: "M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5" },
];

export default function Sidebar({ collapsed, onToggle }: Props) {
  return (
    <aside className={`fixed top-0 left-0 bottom-0 bg-sidebar-bg flex flex-col z-50 transition-all duration-200 ${collapsed ? "w-16" : "w-60"}`}>
      <div className={`flex items-center min-h-[60px] px-4 ${collapsed ? "justify-center" : "justify-between"}`}>
        {!collapsed && (<div className="flex items-center gap-2.5"><div className="w-8 h-8 bg-gradient-to-br from-accent to-blue-600 rounded-md flex items-center justify-center text-white font-bold text-sm shadow-sm">H</div><span className="text-[17px] font-semibold text-white whitespace-nowrap">HireTrail</span></div>)}
        <button onClick={onToggle} className="text-sidebar-text hover:text-white hover:bg-sidebar-hover p-1.5 rounded-md transition-colors"><svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="3" y1="4" x2="15" y2="4"/><line x1="3" y1="9" x2={collapsed?"15":"11"} y2="9"/><line x1="3" y1="14" x2="15" y2="14"/></svg></button>
      </div>
      <nav className={`flex-1 flex flex-col gap-0.5 overflow-y-auto ${collapsed ? "px-1 items-center" : "px-2"}`}>
        {nav.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.to === "/"} title={collapsed ? item.label : undefined}
            className={({ isActive }) => `flex items-center gap-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${collapsed ? "justify-center w-11 h-11 p-0" : "px-3 py-2"} ${isActive ? "bg-gradient-to-r from-sidebar-active to-sidebar-active/80 text-white shadow-sm" : "text-sidebar-text hover:bg-sidebar-hover hover:text-white"}`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d={item.d}/></svg>
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>
      <div className="px-4 py-3 border-t border-sidebar-hover">{collapsed ? <div className="flex justify-center"><div className="w-6 h-6 bg-accent/20 rounded flex items-center justify-center text-accent text-[10px] font-bold">H</div></div> : <p className="text-[11px] text-sidebar-text/50">HireTrail v3.0</p>}</div>
    </aside>
  );
}
