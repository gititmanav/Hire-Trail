/**
 * Root router: session bootstrap, protected shell, job-search UI state, theme context.
 */
import { useState, useEffect, useCallback, createContext } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout/Layout.tsx";
import ProtectedRoute from "./components/ProtectedRoute/ProtectedRoute.tsx";
import AdminLayout from "./components/AdminLayout/AdminLayout.tsx";
import Login from "./pages/Login/Login.tsx";
import Register from "./pages/Register/Register.tsx";
import Dashboard from "./pages/Dashboard/Dashboard.tsx";
import Applications from "./pages/Applications/Applications.tsx";
import Kanban from "./pages/Kanban/Kanban.tsx";
import JobSearch from "./pages/JobSearch/JobSearch.tsx";
import Resumes from "./pages/Resumes/Resumes.tsx";
import Contacts from "./pages/Contacts/Contacts.tsx";
import Companies from "./pages/Companies/Companies.tsx";
import Deadlines from "./pages/Deadlines/Deadlines.tsx";
import ImportExport from "./pages/ImportExport/ImportExport.tsx";
import Profile from "./pages/Profile/Profile.tsx";
import {
  AdminDashboard, AuditLogs,
  ContentModeration, StorageManagement, SystemConfig,
  Announcements, EmailTemplates, InviteSystem, BackupManagement,
  RBACManagement, SeedManagement, GmailManagement, NotificationCenter,
} from "./pages/Admin/index.ts";
import { authAPI } from "./utils/api.ts";
import { useTheme } from "./hooks/useTheme.ts";
import { FeatureFlagsProvider, useFeatureFlags } from "./hooks/useFeatureFlags.tsx";
import type { User } from "./types";
import { JobSearchContext, defaultState } from "./hooks/useJobSearchState.ts";
import type { JobSearchState } from "./hooks/useJobSearchState.ts";

export const ThemeContext = createContext<{ dark: boolean; toggle: (e?: React.MouseEvent) => void; themeId: string; setTheme: (id: string) => void }>({ dark: false, toggle: () => { }, themeId: "default", setTheme: () => {} });
export const UserContext = createContext<{ user: User | null; setUser: (u: User | null) => void }>({ user: null, setUser: () => {} });

function FeatureRoute({ flag, children }: { flag: string; children: React.ReactNode }) {
  const { isEnabled, loading } = useFeatureFlags();
  if (loading) return <div className="spinner" style={{ minHeight: "50vh" }} />;
  if (!isEnabled(flag)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

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
      <UserContext.Provider value={{ user, setUser }}>
      <FeatureFlagsProvider authenticated={!!user}>
      <JobSearchContext.Provider value={{ state: jobSearchState, setState: setJobSearchState }}>

        <Routes>
          <Route path="/login" element={user ? <Navigate to={user.role === "admin" ? "/admin" : "/"} replace /> : <Login onLogin={setUser} />} />
          <Route path="/register" element={user ? <Navigate to={user.role === "admin" ? "/admin" : "/"} replace /> : <Register onLogin={setUser} />} />

          {/* Admin panel — own layout, own sidebar */}
          <Route element={<ProtectedRoute user={user}>{user?.role === "admin" ? <AdminLayout user={user!} onLogout={async () => { try { await authAPI.logout(); } catch { } setUser(null); }} /> : <Navigate to="/" replace />}</ProtectedRoute>}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/users" element={<RBACManagement />} />
            <Route path="/admin/content" element={<ContentModeration />} />
            <Route path="/admin/storage" element={<StorageManagement />} />
            <Route path="/admin/settings" element={<SystemConfig />} />
            <Route path="/admin/announcements" element={<Announcements />} />
            <Route path="/admin/audit-logs" element={<AuditLogs />} />
            <Route path="/admin/email-templates" element={<EmailTemplates />} />
            <Route path="/admin/invites" element={<InviteSystem />} />
            <Route path="/admin/backup" element={<BackupManagement />} />
            <Route path="/admin/seed" element={<SeedManagement />} />
            <Route path="/admin/gmail" element={<GmailManagement />} />
            <Route path="/admin/notifications" element={<NotificationCenter />} />
          </Route>

          {/* Main app layout */}
          <Route element={<ProtectedRoute user={user}><Layout user={user!} onLogout={async () => { try { await authAPI.logout(); } catch { } setUser(null); }} /></ProtectedRoute>}>
            <Route path="/" element={user?.role === "admin" ? <Navigate to="/admin" replace /> : <Dashboard />} />
            <Route path="/applications" element={<Applications />} />
            <Route path="/companies" element={<Companies />} />
            <Route path="/kanban" element={<FeatureRoute flag="feature_kanban"><Kanban /></FeatureRoute>} />
            <Route path="/jobs" element={<FeatureRoute flag="feature_job_search"><JobSearch /></FeatureRoute>} />
            <Route path="/resumes" element={<Resumes />} />
            <Route path="/contacts" element={<Contacts />} />
            <Route path="/deadlines" element={<Deadlines />} />
            <Route path="/import-export" element={<FeatureRoute flag="feature_csv_import_export"><ImportExport /></FeatureRoute>} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/settings" element={<Profile />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </JobSearchContext.Provider>
      </FeatureFlagsProvider>
      </UserContext.Provider>
    </ThemeContext.Provider>
  );
}

export default App;
