/**
 * Root router: session bootstrap, protected shell, job-search UI state, theme context.
 */
import { useState, useEffect, useCallback, createContext } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout/Layout.tsx";
import ProtectedRoute from "./components/ProtectedRoute/ProtectedRoute.tsx";
import Login from "./pages/Login/Login.tsx";
import Register from "./pages/Register/Register.tsx";
import Dashboard from "./pages/Dashboard/Dashboard.tsx";
import Applications from "./pages/Applications/Applications.tsx";
import Kanban from "./pages/Kanban/Kanban.tsx";
import JobSearch from "./pages/JobSearch/JobSearch.tsx";
import Resumes from "./pages/Resumes/Resumes.tsx";
import Contacts from "./pages/Contacts/Contacts.tsx";
import Deadlines from "./pages/Deadlines/Deadlines.tsx";
import ImportExport from "./pages/ImportExport/ImportExport.tsx";
import Profile from "./pages/Profile/Profile.tsx";
import { authAPI } from "./utils/api.ts";
import { useTheme } from "./hooks/useTheme.ts";
import type { User } from "./types";
import { JobSearchContext, defaultState } from "./hooks/useJobSearchState.ts";
import type { JobSearchState } from "./hooks/useJobSearchState.ts";

export const ThemeContext = createContext<{ dark: boolean; toggle: (e?: React.MouseEvent) => void }>({ dark: false, toggle: () => { } });

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [jobSearchState, setJobSearchState] = useState<JobSearchState>(defaultState);
  const theme = useTheme();

  const checkAuth = useCallback(async () => {
    try { setUser(await authAPI.getMe()); } catch { setUser(null); } finally { setLoading(false); }
  }, []);
  useEffect(() => { checkAuth(); }, [checkAuth]);

  if (loading) return <div className="spinner" style={{ minHeight: "100vh" }} />;

  return (
    <ThemeContext.Provider value={theme}>
      <JobSearchContext.Provider value={{ state: jobSearchState, setState: setJobSearchState }}>

        <Routes>
          <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login onLogin={setUser} />} />
          <Route path="/register" element={user ? <Navigate to="/" replace /> : <Register onLogin={setUser} />} />
          <Route element={<ProtectedRoute user={user}><Layout user={user!} onLogout={async () => { try { await authAPI.logout(); } catch { } setUser(null); }} /></ProtectedRoute>}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/applications" element={<Applications />} />
            <Route path="/kanban" element={<Kanban />} />
            <Route path="/jobs" element={<JobSearch />} />
            <Route path="/resumes" element={<Resumes />} />
            <Route path="/contacts" element={<Contacts />} />
            <Route path="/deadlines" element={<Deadlines />} />
            <Route path="/import-export" element={<ImportExport />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/settings" element={<Profile />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </JobSearchContext.Provider>

    </ThemeContext.Provider>
  );
}

export default App;
