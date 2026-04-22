import { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout/Layout.jsx";
import ProtectedRoute from "./components/ProtectedRoute/ProtectedRoute.jsx";
import Login from "./pages/Login/Login.jsx";
import Register from "./pages/Register/Register.jsx";
import Dashboard from "./pages/Dashboard/Dashboard.jsx";
import Applications from "./pages/Applications/Applications.jsx";
import Resumes from "./pages/Resumes/Resumes.jsx";
import Contacts from "./pages/Contacts/Contacts.jsx";
import Deadlines from "./pages/Deadlines/Deadlines.jsx";
import OnboardingTour, {
  shouldShowTour,
} from "./components/OnboardingTour/OnboardingTour.jsx";
import { authAPI } from "./utils/api.js";

const TOUR_STEPS = [
  {
    target: null,
    title: "Welcome to HireTrail",
    body: "A quick tour — we'll point out the main areas of your application command center. You can skip any time.",
  },
  {
    target: ".sidebar",
    title: "Your navigation",
    body: "Switch between Dashboard, Applications, Resumes, Contacts, and Deadlines from here. Collapse the sidebar with the top button if you want more canvas.",
  },
  {
    target: ".stat-row",
    title: "At-a-glance stats",
    body: "Your most important numbers live here: total applications, in-progress count, offers, and rejections.",
  },
  {
    target: ".dashboard-grid-wrapper",
    title: "Customizable dashboard",
    body: "Drag and resize any card after hitting 'Customize layout'. Your arrangement saves for next time.",
  },
  {
    target: null,
    title: "You're all set",
    body: "Add an application to see the numbers update. Come back here any time — use '?' in your browser to re-open this tour from Settings (coming soon).",
  },
];

function AuthedShell({ user, onLogout, showTour, onTourClose }) {
  return (
    <>
      <Layout user={user} onLogout={onLogout} />
      {showTour && <OnboardingTour steps={TOUR_STEPS} onClose={onTourClose} />}
    </>
  );
}

AuthedShell.propTypes = {
  user: PropTypes.shape({
    _id: PropTypes.string,
    name: PropTypes.string,
    email: PropTypes.string,
  }).isRequired,
  onLogout: PropTypes.func.isRequired,
  showTour: PropTypes.bool.isRequired,
  onTourClose: PropTypes.func.isRequired,
};

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showTour, setShowTour] = useState(false);

  const checkAuth = useCallback(async () => {
    try {
      const data = await authAPI.getMe();
      setUser(data);
      // Restoring an existing session (page reload) — do NOT show tour.
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const handleLogin = (userData) => {
    setUser(userData);
    if (shouldShowTour(userData)) {
      // Defer so the dashboard renders first.
      window.setTimeout(() => setShowTour(true), 350);
    }
  };

  const handleLogout = async () => {
    try {
      await authAPI.logout();
    } catch {
      /* proceed with local logout regardless */
    }
    setUser(null);
    setShowTour(false);
  };

  if (loading) {
    return (
      <div className="spinner" style={{ minHeight: "100vh" }}>
        <span className="sr-only">Loading</span>
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={
          user ? <Navigate to="/" replace /> : <Login onLogin={handleLogin} />
        }
      />
      <Route
        path="/register"
        element={
          user ? (
            <Navigate to="/" replace />
          ) : (
            <Register onLogin={handleLogin} />
          )
        }
      />
      <Route
        element={
          <ProtectedRoute user={user}>
            <AuthedShell
              user={user}
              onLogout={handleLogout}
              showTour={showTour}
              onTourClose={() => setShowTour(false)}
            />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/applications" element={<Applications />} />
        <Route path="/resumes" element={<Resumes />} />
        <Route path="/contacts" element={<Contacts />} />
        <Route path="/deadlines" element={<Deadlines />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
