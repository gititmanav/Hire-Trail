import { useState } from "react";
import { NavLink } from "react-router-dom";
import PropTypes from "prop-types";
import "./Sidebar.css";

function Sidebar({ user, onLogout, collapsed, onToggle }) {
  const [showUserMenu, setShowUserMenu] = useState(false);

  const navItems = [
    {
      to: "/",
      label: "Dashboard",
      icon: (
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="2" y="2" width="7" height="8" rx="1" />
          <rect x="11" y="2" width="7" height="5" rx="1" />
          <rect x="2" y="12" width="7" height="6" rx="1" />
          <rect x="11" y="9" width="7" height="9" rx="1" />
        </svg>
      ),
    },
    {
      to: "/applications",
      label: "Applications",
      icon: (
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="2" width="14" height="16" rx="2" />
          <line x1="7" y1="6" x2="13" y2="6" />
          <line x1="7" y1="9" x2="13" y2="9" />
          <line x1="7" y1="12" x2="10" y2="12" />
        </svg>
      ),
    },
    {
      to: "/resumes",
      label: "Resumes",
      icon: (
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 2H5a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7l-5-5z" />
          <polyline points="12,2 12,7 17,7" />
        </svg>
      ),
    },
    {
      to: "/contacts",
      label: "Contacts",
      icon: (
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="10" cy="7" r="3" />
          <path d="M4 17v-1a4 4 0 014-4h4a4 4 0 014 4v1" />
        </svg>
      ),
    },
    {
      to: "/deadlines",
      label: "Deadlines",
      icon: (
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="10" cy="10" r="7" />
          <polyline points="10,6 10,10 13,12" />
        </svg>
      ),
    },
  ];

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

  return (
    <aside className={`sidebar ${collapsed ? "sidebar-collapsed" : ""}`}>
      {/* Logo + toggle */}
      <div className="sidebar-header">
        {!collapsed && (
          <div className="sidebar-logo">
            <div className="sidebar-logo-icon">H</div>
            <span className="sidebar-logo-text">HireTrail</span>
          </div>
        )}
        <button
          className="sidebar-toggle"
          onClick={onToggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 18 18"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            {collapsed ? (
              <>
                <line x1="3" y1="4" x2="15" y2="4" />
                <line x1="3" y1="9" x2="15" y2="9" />
                <line x1="3" y1="14" x2="15" y2="14" />
              </>
            ) : (
              <>
                <line x1="3" y1="4" x2="15" y2="4" />
                <line x1="3" y1="9" x2="11" y2="9" />
                <line x1="3" y1="14" x2="15" y2="14" />
              </>
            )}
          </svg>
        </button>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              `sidebar-link ${isActive ? "sidebar-link-active" : ""}`
            }
            title={collapsed ? item.label : undefined}
          >
            <span className="sidebar-link-icon">{item.icon}</span>
            {!collapsed && (
              <span className="sidebar-link-label">{item.label}</span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User section at bottom */}
      <div className="sidebar-footer">
        <div
          className="sidebar-user"
          onClick={() => setShowUserMenu(!showUserMenu)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && setShowUserMenu(!showUserMenu)}
        >
          <div className="sidebar-avatar">{initials}</div>
          {!collapsed && (
            <div className="sidebar-user-info">
              <span className="sidebar-user-name">{user?.name}</span>
              <span className="sidebar-user-email">{user?.email}</span>
            </div>
          )}
        </div>

        {showUserMenu && (
          <div className="sidebar-user-menu">
            <button
              className="sidebar-user-menu-item"
              onClick={() => {
                setShowUserMenu(false);
                onLogout();
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              >
                <path d="M6 14H3a1 1 0 01-1-1V3a1 1 0 011-1h3" />
                <polyline points="10,11 14,8 10,5" />
                <line x1="14" y1="8" x2="6" y2="8" />
              </svg>
              Sign out
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}

Sidebar.propTypes = {
  user: PropTypes.shape({
    _id: PropTypes.string,
    name: PropTypes.string,
    email: PropTypes.string,
  }).isRequired,
  onLogout: PropTypes.func.isRequired,
  collapsed: PropTypes.bool.isRequired,
  onToggle: PropTypes.func.isRequired,
};

export default Sidebar;
