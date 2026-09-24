/**
 * Root router: session bootstrap, protected shell, job-search UI state, theme context.
 */
import { useState, useEffect, useCallback, useRef, createContext, lazy, Suspense } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { queryClient } from "./utils/queryClient.ts";
import Layout from "./components/Layout/Layout.tsx";
import ProtectedRoute from "./components/ProtectedRoute/ProtectedRoute.tsx";
import AdminLayout from "./components/AdminLayout/AdminLayout.tsx";
import Privacy from "./pages/Legal/Privacy.tsx";
import Terms from "./pages/Legal/Terms.tsx";
import About from "./pages/Legal/About.tsx";
import LandingPage from "./pages/Landing/LandingPage.tsx";
import { BackgroundTasksProvider } from "./hooks/useBackgroundTasks.tsx";
import { DemoGateProvider } from "./hooks/useDemoGate.tsx";
import { AIKeyStatusProvider } from "./hooks/useAIKeyStatus.tsx";
import AIKeyNudges from "./components/AIKeyNudges/AIKeyNudges.tsx";
import BackgroundTaskCenter from "./components/BackgroundTaskCenter/BackgroundTaskCenter.tsx";
import GlobalShortcuts from "./components/GlobalShortcuts/GlobalShortcuts.tsx";
import IdleWarningModal from "./components/IdleWarningModal/IdleWarningModal.tsx";
// Code-split heavy / rarely-loaded routes. Keeps the initial chunk small —
// Dashboard + the Applications shell/List view + the core auth shell are in the main chunk,
// everything else loads on demand. Suspense fallback shares the existing
// spinner component for visual consistency.
import Dashboard from "./pages/Dashboard/Dashboard.tsx";
import ApplicationsLayout from "./pages/Applications/ApplicationsLayout.tsx";
import ListView from "./pages/Applications/views/ListView.tsx";
// Factories so we can BOTH lazy-load via React.lazy AND fire the same import
// from a post-mount warmer to preload chunks the sidebar links to. Idempotent:
// the underlying module cache means calling the import a second time is free.
const loadBoardView = () => import("./pages/Applications/views/BoardView.tsx");
const loadCalendarView = () => import("./pages/Applications/views/CalendarView.tsx");
const loadApplicationDetail = () => import("./pages/Applications/ApplicationDetailPage.tsx");
const loadJobSearch = () => import("./pages/JobSearch/JobSearch.tsx");
const loadResumes   = () => import("./pages/Resumes/Resumes.tsx");
const loadContacts  = () => import("./pages/Contacts/Contacts.tsx");
const loadCompanies = () => import("./pages/Companies/Companies.tsx");
const loadDeadlines = () => import("./pages/Deadlines/Deadlines.tsx");
const loadCalendar  = () => import("./pages/Calendar/Calendar.tsx");
const loadImport    = () => import("./pages/ImportExport/ImportExport.tsx");
const loadProfile   = () => import("./pages/Profile/Profile.tsx");
const loadSettingsLayout = () => import("./pages/Settings/SettingsLayout.tsx");
const loadAISettings = () => import("./pages/AISettings/AISettings.tsx");
const loadResumeStudio = () => import("./pages/ResumeStudio/ResumeStudio.tsx");
const loadEmailScanReview = () => import("./pages/EmailScanReview/EmailScanReview.tsx");
const loadNotifications = () => import("./pages/Notifications/Notifications.tsx");

const BoardView    = lazy(loadBoardView);
const CalendarView = lazy(loadCalendarView);
const ApplicationDetailPage = lazy(loadApplicationDetail);
const JobSearch    = lazy(loadJobSearch);
const Resumes      = lazy(loadResumes);
const Contacts     = lazy(loadContacts);
const Companies    = lazy(loadCompanies);
const Deadlines    = lazy(loadDeadlines);
const CalendarPage = lazy(loadCalendar);
const ImportExport = lazy(loadImport);
const Profile      = lazy(loadProfile);
const SettingsLayout = lazy(loadSettingsLayout);
const ProfileSettings = lazy(() => import("./pages/Settings/sections/ProfileSettings.tsx"));
const PersonalizeSettings = lazy(() => import("./pages/Settings/sections/PersonalizeSettings.tsx"));
const ClipboardSettings = lazy(() => import("./pages/Settings/sections/ClipboardSettings.tsx"));
const MailboxSettings = lazy(() => import("./pages/Settings/sections/MailboxSettings.tsx"));
const AISettings   = lazy(loadAISettings);
const ResumeStudio = lazy(loadResumeStudio);
const EmailScanReview = lazy(loadEmailScanReview);
const NotificationsPage = lazy(loadNotifications);

/** Warm the chunk cache for sidebar routes ~600ms after the first paint —
 *  late enough not to compete with the initial render, early enough that a
 *  user clicking any sidebar link gets near-instant navigation. Errors here
 *  are silent because the page lazy() fallback will retry on actual navigation. */
function preloadSidebarRoutes(): void {
  setTimeout(() => {
    void Promise.all([
      loadBoardView(), loadApplicationDetail(), loadContacts(), loadCompanies(),
      loadResumes(), loadDeadlines(), loadCalendarView(),
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
const AISystemConfig      = lazy(() => import("./pages/Admin/AISystemConfig.tsx"));
const Announcements       = lazy(() => import("./pages/Admin/Announcements.tsx"));
const EmailTemplates      = lazy(() => import("./pages/Admin/EmailTemplates.tsx"));
const InviteSystem        = lazy(() => import("./pages/Admin/InviteSystem.tsx"));
const BackupManagement    = lazy(() => import("./pages/Admin/BackupManagement.tsx"));
const RBACManagement      = lazy(() => import("./pages/Admin/RBACManagement.tsx"));
const SeedManagement      = lazy(() => import("./pages/Admin/SeedManagement.tsx"));
const MailboxManagement   = lazy(() => import("./pages/Admin/MailboxManagement.tsx"));
const NotificationCenter  = lazy(() => import("./pages/Admin/NotificationCenter.tsx"));
const FeedbackInbox       = lazy(() => import("./pages/Admin/FeedbackInbox.tsx"));
const BugReports          = lazy(() => import("./pages/Admin/BugReports.tsx"));
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

/** /settings landing: routes legacy deep links to the right section page.
 *  OAuth callbacks (?gmail=… / ?outlook=…) → Mailboxes with params intact;
 *  old scroll-spy hashes (#clipboard etc.) → their section; else Profile. */
function SettingsIndexRedirect() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  if (params.has("gmail") || params.has("outlook")) {
    return <Navigate to={{ pathname: "/settings/mailboxes", search: location.search }} replace />;
  }
  const hash = location.hash.replace(/^#/, "");
  const legacyHashMap: Record<string, string> = {
    account: "profile", password: "profile", email: "mailboxes",
    ai: "ai", profileSync: "ai", clipboard: "clipboard",
  };
  return <Navigate to={`/settings/${legacyHashMap[hash] ?? "profile"}`} replace />;
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
      } else if (!ax.response || ax.response.status === 401 || ax.response.status === 403) {
        // Definitively unauthenticated (or no server reachable at boot).
        setUser(null);
      }
      // Transient failures (429 rate limit, 5xx) keep the current user — a
      // busy minute must not silently log someone out onto the landing page.
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

  /* The query cache is per-account data: drop it whenever the signed-in user
   * changes (logout, or a different account signing in on this tab), so no
   * one ever sees a previous user's cached applications. */
  const userId = user?._id ?? null;
  const lastUserIdRef = useRef<string | null>(userId);
  useEffect(() => {
    if (lastUserIdRef.current !== userId) queryClient.clear();
    lastUserIdRef.current = userId;
  }, [userId]);

  if (loading) return <div className="spinner" style={{ minHeight: "100vh" }} />;

  return (
    <ThemeContext.Provider value={theme}>
      <UserContext.Provider value={{ user, setUser }}>
      <DemoGateProvider>
      <FeatureFlagsProvider authenticated={!!user}>
      <JobSearchContext.Provider value={{ state: jobSearchState, setState: setJobSearchState }}>
      <BackgroundTasksProvider>
      <AIKeyStatusProvider>

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
          <Route path="/about" element={<About />} />

          {/* Admin panel — own layout, own sidebar. Demo user is explicitly
              blocked here even if a future seeding bug grants admin role —
              defence-in-depth for "no admin surface for the demo persona". */}
          <Route element={<ProtectedRoute user={user}>{user?.role === "admin" && user?.email !== "demo@hiretrail.com" ? <AdminLayout user={user!} onLogout={async () => {
            setAuthActionLoading(true);
            try { await authAPI.logout(); } catch { } finally { setUser(null); setAuthActionLoading(false); }
          }} /> : <Navigate to="/" replace />}</ProtectedRoute>}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/users" element={<RBACManagement />} />
            <Route path="/admin/content" element={<ContentModeration />} />
            <Route path="/admin/storage" element={<StorageManagement />} />
            <Route path="/admin/settings" element={<SystemConfig />} />
            <Route path="/admin/ai" element={<AISystemConfig />} />
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
            <Route path="/admin/bugs" element={<BugReports />} />
            <Route path="/admin/broadcasts" element={<Broadcasts />} />
            <Route path="/admin/calendar" element={<CalendarPage />} />
          </Route>

          {/* Main app layout */}
          <Route element={<ProtectedRoute user={user}><Layout user={user!} onLogout={async () => {
            setAuthActionLoading(true);
            try { await authAPI.logout(); } catch { } finally { setUser(null); setAuthActionLoading(false); }
          }} /></ProtectedRoute>}>
            <Route path="/" element={user?.role === "admin" ? <Navigate to="/admin" replace /> : <Dashboard />} />
            {/* Applications: one page, three views (shell owns header + filters). */}
            <Route path="/applications" element={<ApplicationsLayout />}>
              <Route index element={<ListView />} />
              <Route path="board" element={<FeatureRoute flag="feature_kanban"><BoardView /></FeatureRoute>} />
              <Route path="calendar" element={<CalendarView />} />
            </Route>
            <Route path="/applications/:id" element={<ApplicationDetailPage />} />
            <Route path="/companies" element={<Companies />} />
            {/* Pre-2026-09 URLs (bookmarks, tour, old links). */}
            <Route path="/kanban" element={<Navigate to="/applications/board" replace />} />
            <Route path="/jobs" element={<FeatureRoute flag="feature_job_search"><JobSearch /></FeatureRoute>} />
            <Route path="/resumes" element={<Resumes />} />
            <Route path="/contacts" element={<Contacts />} />
            <Route path="/deadlines" element={<Deadlines />} />
            <Route path="/calendar" element={<Navigate to="/applications/calendar" replace />} />
            <Route path="/import-export" element={<FeatureRoute flag="feature_csv_import_export"><ImportExport /></FeatureRoute>} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/email-review" element={<EmailScanReview />} />
            {/* Legacy path — notifications and bookmarks predating the move. */}
            <Route path="/settings/email-review" element={<Navigate to="/email-review" replace />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/resume-studio" element={<ResumeStudio />} />
          </Route>

          {/* Settings — its own shell with a dedicated sidebar (no main app chrome). */}
          <Route path="/settings" element={<ProtectedRoute user={user}><SettingsLayout /></ProtectedRoute>}>
            <Route index element={<SettingsIndexRedirect />} />
            <Route path="profile" element={<ProfileSettings />} />
            <Route path="personalize" element={<PersonalizeSettings />} />
            <Route path="clipboard" element={<ClipboardSettings />} />
            <Route path="mailboxes" element={<MailboxSettings />} />
            <Route path="ai" element={<AISettings />} />
            <Route path="*" element={<Navigate to="/settings/profile" replace />} />
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
        {/* Idle warning fires after 60 minutes of no input — soft, non-blocking. */}
        {user && <IdleWarningModal />}
        {/* BYOK onboarding modal + one-time no-key warning (header badge lives in Header). */}
        {user && <AIKeyNudges />}
      </AIKeyStatusProvider>
      </BackgroundTasksProvider>
      </JobSearchContext.Provider>
      </FeatureFlagsProvider>
      </DemoGateProvider>
      </UserContext.Provider>
    </ThemeContext.Provider>
  );
}

export default App;
