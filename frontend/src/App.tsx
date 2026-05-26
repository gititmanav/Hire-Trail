/**
 * Root router: session bootstrap, protected shell, job-search UI state, theme context.
 */
import { useState, useEffect, useCallback, createContext, lazy, Suspense } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import Layout from "./components/Layout/Layout.tsx";
import ProtectedRoute from "./components/ProtectedRoute/ProtectedRoute.tsx";
import AdminLayout from "./components/AdminLayout/AdminLayout.tsx";
import Privacy from "./pages/Legal/Privacy.tsx";
import Terms from "./pages/Legal/Terms.tsx";
import LandingPage from "./pages/Landing/LandingPage.tsx";
import { BackgroundTasksProvider } from "./hooks/useBackgroundTasks.tsx";
import { DemoGateProvider } from "./hooks/useDemoGate.tsx";
import BackgroundTaskCenter from "./components/BackgroundTaskCenter/BackgroundTaskCenter.tsx";
import GlobalShortcuts from "./components/GlobalShortcuts/GlobalShortcuts.tsx";
// Code-split heavy / rarely-loaded routes. Keeps the initial chunk small —
// Dashboard + Applications + the core auth shell are in the main chunk,
// everything else loads on demand. Suspense fallback shares the existing
// spinner component for visual consistency.
import Dashboard from "./pages/Dashboard/Dashboard.tsx";
import Applications from "./pages/Applications/Applications.tsx";
// Factories so we can BOTH lazy-load via React.lazy AND fire the same import
// from a post-mount warmer to preload chunks the sidebar links to. Idempotent:
// the underlying module cache means calling the import a second time is free.
const loadKanban    = () => import("./pages/Kanban/Kanban.tsx");
const loadJobSearch = () => import("./pages/JobSearch/JobSearch.tsx");
const loadResumes   = () => import("./pages/Resumes/Resumes.tsx");
const loadContacts  = () => import("./pages/Contacts/Contacts.tsx");
const loadCompanies = () => import("./pages/Companies/Companies.tsx");
const loadDeadlines = () => import("./pages/Deadlines/Deadlines.tsx");
const loadCalendar  = () => import("./pages/Calendar/Calendar.tsx");
const loadImport    = () => import("./pages/ImportExport/ImportExport.tsx");
const loadProfile   = () => import("./pages/Profile/Profile.tsx");
const loadSettings  = () => import("./pages/Settings/Settings.tsx");
const loadTailor    = () => import("./pages/Tailor/Tailor.tsx");

const Kanban       = lazy(loadKanban);
const JobSearch    = lazy(loadJobSearch);
const Resumes      = lazy(loadResumes);
const Contacts     = lazy(loadContacts);
const Companies    = lazy(loadCompanies);
const Deadlines    = lazy(loadDeadlines);
const CalendarPage = lazy(loadCalendar);
const ImportExport = lazy(loadImport);
const Profile      = lazy(loadProfile);
const Settings     = lazy(loadSettings);
const Tailor       = lazy(loadTailor);

/** Warm the chunk cache for sidebar routes ~600ms after the first paint —
 *  late enough not to compete with the initial render, early enough that a
 *  user clicking any sidebar link gets near-instant navigation. Errors here
 *  are silent because the page lazy() fallback will retry on actual navigation. */
function preloadSidebarRoutes(): void {
  setTimeout(() => {
    void Promise.all([
      loadKanban(), loadContacts(), loadCompanies(), loadResumes(),
      loadDeadlines(), loadCalendar(),
    ]).catch(() => undefined);
  }, 600);
}
// Admin routes — lazy-loaded so non-admin users don't ship the admin bundle.
// Each route is its own chunk; vite collocates small ones automatically.
const AdminDashboard      = lazy(() => import("./pages/Admin/AdminDashboard.tsx"));
const AuditLogs           = lazy(() => import("./pages/Admin/AuditLogs.tsx"));
const ContentModeration   = lazy(() => import("./pages/Admin/ContentModeration.tsx"));
const StorageManagement   = lazy(() => import("./pages/Admin/StorageManagement.tsx"));
const SystemConfig        = lazy(() => import("./pages/Admin/SystemConfig.tsx"));
const Announcements       = lazy(() => import("./pages/Admin/Announcements.tsx"));
const EmailTemplates      = lazy(() => import("./pages/Admin/EmailTemplates.tsx"));
const InviteSystem        = lazy(() => import("./pages/Admin/InviteSystem.tsx"));
const BackupManagement    = lazy(() => import("./pages/Admin/BackupManagement.tsx"));
const RBACManagement      = lazy(() => import("./pages/Admin/RBACManagement.tsx"));
const SeedManagement      = lazy(() => import("./pages/Admin/SeedManagement.tsx"));
const MailboxManagement   = lazy(() => import("./pages/Admin/MailboxManagement.tsx"));
const NotificationCenter  = lazy(() => import("./pages/Admin/NotificationCenter.tsx"));
const FeedbackInbox       = lazy(() => import("./pages/Admin/FeedbackInbox.tsx"));
const Broadcasts          = lazy(() => import("./pages/Admin/Broadcasts.tsx"));
import { authAPI } from "./utils/api.ts";
import { useTheme } from "./hooks/useTheme.ts";
import { FeatureFlagsProvider, useFeatureFlags } from "./hooks/useFeatureFlags.tsx";
import type { AxiosError } from "axios";
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
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authActionLoading, setAuthActionLoading] = useState(false);
  const [jobSearchState, setJobSearchState] = useState<JobSearchState>(defaultState);
  const theme = useTheme(user?._id);

  const checkAuth = useCallback(async () => {
    try {
      setUser(await authAPI.getMe());
    } catch (err) {
      const ax = err as AxiosError<{ code?: string }>;
      if (ax.response?.status === 503 && ax.response?.data?.code === "MAINTENANCE") {
        setUser(null);
        navigate("/login?maintenance=1", { replace: true });
      } else {
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, [navigate]);
  useEffect(() => { checkAuth(); }, [checkAuth]);

  /* Warm code-split chunks for the sidebar nav targets once the user is
   * authenticated. Defers the imports so they don't compete with first paint. */
  useEffect(() => {
    if (user) preloadSidebarRoutes();
  }, [user]);

  if (loading) return <div className="spinner" style={{ minHeight: "100vh" }} />;

  return (
    <ThemeContext.Provider value={theme}>
      <UserContext.Provider value={{ user, setUser }}>
      <DemoGateProvider>
      <FeatureFlagsProvider authenticated={!!user}>
      <JobSearchContext.Provider value={{ state: jobSearchState, setState: setJobSearchState }}>
      <BackgroundTasksProvider>

        <Suspense fallback={<div className="spinner" style={{ minHeight: "60vh" }} aria-label="Loading page" />}>
        <Routes>
          {/* Public landing — only shown when signed out. When the user is signed in, this
              route is omitted and the protected "/" further down matches the Dashboard. */}
          {!user && <Route path="/" element={<LandingPage />} />}

          {/* Legacy auth routes — auth is now a modal on the landing page.
              When signed out, redirect to /?auth=<mode> so the landing page pops
              the modal in the right mode for anyone who bookmarked /login. */}
          <Route path="/login" element={user ? <Navigate to={user.role === "admin" ? "/admin" : "/"} replace /> : <Navigate to="/?auth=login" replace />} />
          <Route path="/register" element={user ? <Navigate to={user.role === "admin" ? "/admin" : "/"} replace /> : <Navigate to="/?auth=register" replace />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />

          {/* Admin panel — own layout, own sidebar */}
          <Route element={<ProtectedRoute user={user}>{user?.role === "admin" ? <AdminLayout user={user!} onLogout={async () => {
            setAuthActionLoading(true);
            try { await authAPI.logout(); } catch { } finally { setUser(null); setAuthActionLoading(false); }
          }} /> : <Navigate to="/" replace />}</ProtectedRoute>}>
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
            <Route path="/admin/mailbox" element={<MailboxManagement />} />
            <Route path="/admin/gmail" element={<MailboxManagement />} />
            <Route path="/admin/notifications" element={<NotificationCenter />} />
            <Route path="/admin/feedback" element={<FeedbackInbox />} />
            <Route path="/admin/broadcasts" element={<Broadcasts />} />
            <Route path="/admin/calendar" element={<CalendarPage />} />
          </Route>

          {/* Main app layout */}
          <Route element={<ProtectedRoute user={user}><Layout user={user!} onLogout={async () => {
            setAuthActionLoading(true);
            try { await authAPI.logout(); } catch { } finally { setUser(null); setAuthActionLoading(false); }
          }} /></ProtectedRoute>}>
            <Route path="/" element={user?.role === "admin" ? <Navigate to="/admin" replace /> : <Dashboard />} />
            <Route path="/applications" element={<Applications />} />
            <Route path="/companies" element={<Companies />} />
            <Route path="/kanban" element={<FeatureRoute flag="feature_kanban"><Kanban /></FeatureRoute>} />
            <Route path="/jobs" element={<FeatureRoute flag="feature_job_search"><JobSearch /></FeatureRoute>} />
            <Route path="/resumes" element={<Resumes />} />
            <Route path="/contacts" element={<Contacts />} />
            <Route path="/deadlines" element={<Deadlines />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/import-export" element={<FeatureRoute flag="feature_csv_import_export"><ImportExport /></FeatureRoute>} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/tailor" element={<Tailor />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
        {authActionLoading && (
          <div className="fixed inset-0 z-[100] bg-background/70 backdrop-blur-sm flex items-center justify-center">
            <div className="card-premium px-6 py-4 flex items-center gap-3">
              <div className="spinner" />
              <span className="text-sm text-foreground">Signing you out...</span>
            </div>
          </div>
        )}
        <BackgroundTaskCenter />
        {/* App-wide keyboard shortcuts. Only mounted for authenticated users — */}
        {/* anon visitors on the landing page don't need them. */}
        {user && <GlobalShortcuts />}
      </BackgroundTasksProvider>
      </JobSearchContext.Provider>
      </FeatureFlagsProvider>
      </DemoGateProvider>
      </UserContext.Provider>
    </ThemeContext.Provider>
  );
}

export default App;
