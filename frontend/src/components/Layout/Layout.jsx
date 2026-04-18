import { useState } from "react";
import { Outlet } from "react-router-dom";
import PropTypes from "prop-types";
import Sidebar from "../Sidebar/Sidebar.jsx";
import "./Layout.css";

function Layout({ user, onLogout }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="app-layout">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <Sidebar
        user={user}
        onLogout={onLogout}
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
      />
      <main
        id="main-content"
        tabIndex={-1}
        className={`app-content ${collapsed ? "sidebar-collapsed" : ""}`}
      >
        <div className="page-wrapper">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

Layout.propTypes = {
  user: PropTypes.shape({
    _id: PropTypes.string,
    name: PropTypes.string,
    email: PropTypes.string,
  }).isRequired,
  onLogout: PropTypes.func.isRequired,
};

export default Layout;
