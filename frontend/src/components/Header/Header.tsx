import { useState, useRef, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { ThemeContext } from "../../App.tsx";
import type { User } from "../../types";

interface Props { user: User; onLogout: () => void; }

export default function Header({ user, onLogout }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { dark, toggle } = useContext(ThemeContext);
  const navigate = useNavigate();
  const initials = user.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

  useEffect(() => { const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }; document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h); }, []);
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); }; document.addEventListener("keydown", h); return () => document.removeEventListener("keydown", h); }, []);

  return (
    <header className="glass-header">
      <div className="flex items-center justify-between px-6 py-2.5">
        {/* Left — placeholder for future search */}
        <div />

        {/* Right — theme + profile */}
        <div className="flex items-center gap-2">
          <button onClick={(e) => toggle(e)} className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600 dark:hover:text-gray-300 transition-all" title={dark ? "Light mode" : "Dark mode"}>
            {dark ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="5"/><path d="M12 1v2m0 18v2m-9-11h2m18 0h2m-4.22-6.78l-1.42 1.42M6.34 17.66l-1.42 1.42m0-14.14l1.42 1.42m11.32 11.32l1.42 1.42"/></svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
            )}
          </button>

          <div className="relative" ref={ref}>
            <button onClick={() => setOpen(!open)} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-all">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent to-blue-600 text-white flex items-center justify-center text-xs font-semibold shadow-sm">{initials}</div>
              <div className="hidden sm:flex flex-col items-start">
                <span className="text-[13px] font-medium text-gray-900 dark:text-white leading-tight">{user.name}</span>
                <span className="text-[11px] text-gray-400 dark:text-gray-500 leading-tight">{user.email}</span>
              </div>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className={`text-gray-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}><polyline points="4,6 8,10 12,6"/></svg>
            </button>

            {open && (
              <div className="absolute right-0 top-full mt-1.5 w-56 card-premium py-1.5 animate-in z-50">
                <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700 mb-1"><p className="text-sm font-medium text-gray-900 dark:text-white">{user.name}</p><p className="text-xs text-gray-400">{user.email}</p></div>
                {[
                  { label: "Edit profile", icon: "M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2", extra: "M12 7a4 4 0 100-8 4 4 0 000 8", to: "/profile" },
                  { label: "Settings", icon: "M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2z", extra: "M12 15a3 3 0 100-6 3 3 0 000 6z", to: "/settings" },
                ].map((item) => (
                  <button key={item.label} onClick={() => { setOpen(false); navigate(item.to); }} className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-gray-400"><path d={item.icon}/>{item.extra && <path d={item.extra}/>}</svg>
                    {item.label}
                  </button>
                ))}
                <button onClick={(e) => { setOpen(false); toggle(e); }} className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-400">{dark ? <><circle cx="12" cy="12" r="5"/><path d="M12 1v2m0 18v2m-9-11h2m18 0h2"/></> : <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>}</svg>
                  {dark ? "Light mode" : "Dark mode"}
                </button>
                <div className="border-t border-gray-100 dark:border-gray-700 mt-1 pt-1">
                  <button onClick={() => { setOpen(false); onLogout(); }} className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16,17 21,12 16,7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
