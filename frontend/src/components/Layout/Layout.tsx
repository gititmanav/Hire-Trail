/** App shell: collapsible sidebar, header, fluid vs max-width main by route. */
import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "../Sidebar/Sidebar.tsx";
import Header from "../Header/Header.tsx";
import type { User } from "../../types";

interface Props { user: User; onLogout: () => void; }

export default function Layout({ user, onLogout }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const fullWidth = location.pathname === "/" || location.pathname === "/kanban";

  return (
    <div className="flex min-h-screen bg-page dark:bg-gray-900">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
        isAdmin={user.role === "admin"}
      />
      <div className={`flex-1 flex flex-col transition-all duration-200 ${collapsed ? "ml-16" : "ml-60"}`}>
        <Header user={user} onLogout={onLogout} />
        <main className="flex-1">
          <div className={`p-6 ${fullWidth ? "" : "max-w-[1200px]"} mx-auto`}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
