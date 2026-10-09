/**
 * Typed API client: cookie sessions (withCredentials), JSON by default, multipart for resume uploads.
 * Interceptor surfaces server errors via toast and suppresses noise on 401 from /auth/me.
 * Base URL: `VITE_API_BASE_URL` or `/api` (see `config/apiBase.ts`).
 */
import axios, { AxiosError } from "axios";
import toast from "../components/ui/toast.ts";
import { getApiBaseURL } from "../config/apiBase.ts";
import { reportClientBug } from "./bugReporter.ts";
import { aiErrorFixableInSettings } from "./aiErrors.ts";
import { appNavigate } from "./appNavigate.ts";
import type {
  User, Application, Resume, Contact, Deadline,
  ApplicationFormData, ContactFormData, DeadlineFormData, PaginatedResponse,
  Company, CompanyDetail, CompanyFormData,
  AdminDashboardData, AdminUserDetail, AuditLog,
  Announcement, SystemSetting, SeedResult, Notification,
  AdminNotificationItem, AdminNotificationStats,
  AdminMailboxUser, AdminMailboxStats, MailboxProvider,
  BroadcastEmailItem, BroadcastRecipientType, MailerStatus, Stage, ContactOutreachStatus, ArchiveReason, ReplyWindow,
} from "../types";
import type { Preferences } from "./preferences.ts";
import type { CalendarEvent } from "./calendarGrid.ts";

declare module "axios" {
  interface AxiosRequestConfig {
    /** Skip the interceptor's error toast (5xx are still reported). The caller
     *  owns user-facing error messaging — used by the query layer, which
     *  retries before surfacing anything. */
    quiet?: boolean;
  }
}

export const api = axios.create({
  baseURL: getApiBaseURL(),
  // Cache-Control/Pragma on the REQUEST make browsers bypass their HTTP cache.
  // Required after the 2026-09-23 incident, when browsers stored an HTML page
  // as immutable for /api/* responses — without this they'd replay it for a year.
  headers: { "Content-Type": "application/json", "Cache-Control": "no-cache", Pragma: "no-cache" },
  withCredentials: true,
});

api.interceptors.response.use(
  (r) => r,
  (error: AxiosError<{ error: string | { code?: string; message?: string }; code?: string; details?: { lane?: string } }>) => {
    const code = error.response?.data?.code;
    if (code === "MAINTENANCE") return Promise.reject(error);
    const status = error.response?.status;
    // `data.error` is a string from our API, but platform errors (e.g. Vercel
    // gateway timeouts) send an OBJECT like {code, message}. Rendering that in a
    // toast crashes React (#31), so coerce to a string no matter the shape.
    const rawErr = error.response?.data?.error;
    const msg = !error.response
      // No response at all (offline, DNS, CORS, server unreachable) — axios's
      // raw "Network Error" means nothing to a user.
      ? "Couldn't reach HireTrail. Check your connection and try again."
      : typeof rawErr === "string" && rawErr
        ? rawErr
        : (typeof rawErr === "object" && rawErr?.message) || error.message || "Something went wrong";

    // Silently report 5xx (and AIProviderError's 502 specifically) to the admin
    // panel. Skip recursive reports on /bugs/report itself — otherwise a broken
    // reporter endpoint would loop forever feeding itself.
    if (typeof status === "number" && status >= 500 && !error.config?.url?.includes("/bugs/report")) {
      reportClientBug({
        source: "frontend_axios_5xx",
        errorMessage: `${status} ${error.config?.method?.toUpperCase() || "GET"} ${error.config?.url || "?"} — ${msg}`,
        errorStack: error.stack,
        context: { responseBody: error.response?.data },
      });
    }

    if (status === 401 && error.config?.url?.includes("/auth/me")) return Promise.reject(error);
    // Query-layer requests (TanStack Query) retry transient failures and toast
    // only once retries are exhausted — see utils/queryClient.ts.
    if (error.config?.quiet) return Promise.reject(error);
    // id = message: identical errors collapse into one toast, including when a
    // local catch handler toasts the same message this interceptor already did.
    // An AI refusal the person can fix (no key, allowance used, feature off…)
    // carries its own sentence; the toast adds the way to fix it.
    if (code?.startsWith("ai_") && aiErrorFixableInSettings(code, error.response?.data?.details?.lane)) {
      toast.error(msg, { id: msg, duration: 7000, action: { label: "Open AI settings", onClick: () => appNavigate("/settings/ai") } });
      return Promise.reject(error);
    }
    if (status === 429 && !code?.startsWith("ai_")) toast.error("Too many requests. Please slow down.", { id: "rate-limit" });
    else if (status !== 401) toast.error(msg, { id: msg });
    return Promise.reject(error);
  }
);

export const authAPI = {
  login: (email: string, password: string) => api.post<User>("/auth/login", { email, password }).then((r) => r.data),
  register: (name: string, email: string, password: string) => api.post<User>("/auth/register", { name, email, password }).then((r) => r.data),
  logout: () => api.post("/auth/logout").then((r) => r.data),
  /** Rejects anything that isn't a user object (e.g. an HTML page from a
   *  misrouted proxy) so the app falls back to signed-out instead of
   *  crashing on a string "user". */
  getMe: () => api.get<User>("/auth/me").then((r) => {
    const u = r.data as unknown;
    if (!u || typeof u !== "object" || typeof (u as User)._id !== "string" || typeof (u as User).name !== "string") {
      throw new Error("Unexpected /auth/me response");
    }
    return u as User;
  }),
  updateProfile: (data: { name?: string; email?: string; primaryResumeId?: string | null }) =>
    api.put<User>("/auth/profile", data).then((r) => r.data),
  /** A partial Personalize patch; resolves to the updated user. */
  updatePreferences: (preferences: Partial<Preferences>) =>
    api.put<User>("/auth/profile", { preferences }).then((r) => r.data),
  /** The same patch as a request that outlives the page (tab closing
   *  mid-debounce). Fire-and-forget: there's no page left to report to. */
  flushPreferences: (preferences: Partial<Preferences>) => {
    void fetch(`${getApiBaseURL()}/auth/profile`, {
      method: "PUT",
      credentials: "include",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preferences }),
    }).catch(() => { /* page is gone */ });
  },
  completeTour: () => api.put("/auth/tour").then((r) => r.data),
  /** Schedule deletion (14 days; signing in before then keeps the account).
   *  Signs out everywhere. */
  requestDeletion: (body: { reason: DeletionReason; note?: string; confirm: string; password?: string; email?: string }) =>
    api.post<{ scheduledFor: string }>("/auth/me/deletion", body).then((r) => r.data),
};

export type DeletionReason = "found_job" | "not_useful" | "privacy" | "too_much" | "other";

/** Server-side list filters (see backend routes/applications.ts `listFilters`). */
export interface ApplicationListParams {
  page?: number; limit?: number; sort?: string; order?: string;
  search?: string; archived?: "true" | "false" | "all"; stage?: string;
  company?: string; resumeId?: string; source?: string;
  /** "summary" drops jobDescription (adds hasJobDescription) for list surfaces. */
  fields?: "summary";
}

export interface ApplicationListResponse extends PaginatedResponse<Application> {
  stageCounts?: Record<string, number>;
  tabCounts?: { active: number; archived: number };
}

/** What applications measure about the person (GET /applications/insights). */
export interface ApplicationInsights {
  replyWindow: ReplyWindow;
  /** Applications past twice the reply window with nothing dated ahead. */
  sweepCount: number;
}

export type ApplicationBatchAction =
  | { action: "archive"; reason?: ArchiveReason }
  | { action: "unarchive" | "delete" | "undoStage" }
  | { action: "stage"; stage: Stage };

export interface ApplicationFilterOptions {
  companies: string[];
  sources: string[];
  resumeIds: string[];
  hasUnassignedResume: boolean;
}

export const applicationsAPI = {
  getAll: (params?: ApplicationListParams, config?: { quiet?: boolean; signal?: AbortSignal }) =>
    api.get<ApplicationListResponse>("/applications", { params, ...config }).then((r) => r.data),
  filterOptions: (archived: "true" | "false", config?: { quiet?: boolean; signal?: AbortSignal }) =>
    api.get<ApplicationFilterOptions>("/applications/filter-options", { params: { archived }, ...config }).then((r) => r.data),
  getOne: (id: string, config?: { quiet?: boolean; signal?: AbortSignal }) =>
    api.get<Application>(`/applications/${id}`, config).then((r) => r.data),
  create: (data: ApplicationFormData & { applicationDate?: string }) => api.post<Application>("/applications", data).then((r) => r.data),
  update: (id: string, data: Partial<ApplicationFormData & { applicationDate?: string; archived?: boolean; archivedAt?: string | null; archivedReason?: string | null }>) =>
    api.put<Application>(`/applications/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/applications/${id}`).then((r) => r.data),
  bulkImport: (applications: any[]) => api.post<{ message: string; count: number }>("/applications/bulk", { applications }).then((r) => r.data),
  /** Manually (re)run the fit check for one application. Returns the new
   *  session id and where it stands (processing, or waiting for the assistant). */
  reanalyze: (id: string) =>
    api.post<{ sessionId: string; status: TailorStatus }>(`/applications/${id}/reanalyze`).then((r) => r.data),
  /** Ensure a per-application tailored variant resume exists; returns its id.
   *  Each application tailors its own document (never clobbers the primary). */
  tailorResume: (id: string) =>
    api.post<{ resumeId: string }>(`/applications/${id}/tailor-resume`).then((r) => r.data),
  archive: (id: string, reason?: ArchiveReason) => api.put<Application>(`/applications/${id}/archive`, { reason }).then((r) => r.data),
  unarchive: (id: string) => api.put<Application>(`/applications/${id}/unarchive`).then((r) => r.data),
  /** One request for many applications: archive / unarchive / delete / move
   *  stage, or undo a stage move made moments ago (pops it from the history). */
  batch: (ids: string[], body: ApplicationBatchAction) =>
    api.post<{ matched: number; modified: number }>("/applications/batch", { ids, ...body }).then((r) => r.data),
  insights: (config?: { quiet?: boolean; signal?: AbortSignal }) =>
    api.get<ApplicationInsights>("/applications/insights", config).then((r) => r.data),
  /** Applications past twice the reply window with nothing dated ahead, longest-silent first. */
  sweep: (config?: { quiet?: boolean; signal?: AbortSignal }) =>
    api.get<{ data: Application[]; replyWindow: ReplyWindow }>("/applications/sweep", config).then((r) => r.data),
};

/* ─── Calendar (GET /api/calendar) ─── */

export interface CalendarParams extends Omit<ApplicationListParams, "page" | "limit" | "sort" | "order" | "fields"> {
  from: string;
  to: string;
  /** The viewer's IANA zone — moments (extension saves, stage moves) land on its local day. */
  tz: string;
}

/** One application as the calendar's hover card needs it. */
export interface CalendarApp {
  _id: string;
  company: string;
  role: string;
  stage: Stage;
  stageSince: string;
  applied: string;
  location: string;
  salary: string;
  jobType: string;
  resumeId: string | null;
  companyId: string | null;
  archived: boolean;
  /** The one match score, 0–10. */
  fit: { score: number } | null;
  nextDeadline: { id: string; type: string; date: string } | null;
}

export interface CalendarResponse {
  from: string;
  to: string;
  today: string;
  /** Range events + every open overdue deadline + open recurring deadlines. */
  events: CalendarEvent[];
  applications: Record<string, CalendarApp>;
}

export const calendarAPI = {
  get: (params: CalendarParams, config?: { quiet?: boolean; signal?: AbortSignal }) =>
    api.get<CalendarResponse>("/calendar", { params, ...config }).then((r) => r.data),
};

export const resumesAPI = {
  getAll: (config?: { quiet?: boolean; signal?: AbortSignal }) => api.get<Resume[]>("/resumes", config).then((r) => r.data),
  getOne: (id: string) => api.get<Resume>(`/resumes/${id}`).then((r) => r.data),
  create: (data: { name: string; targetRole: string; fileName: string; tags?: string[]; file?: File | null }) => {
    const formData = new FormData();
    formData.append("name", data.name);
    formData.append("targetRole", data.targetRole);
    formData.append("fileName", data.fileName);
    if (data.tags) formData.append("tags", JSON.stringify(data.tags));
    if (data.file) formData.append("file", data.file);
    return api.post<Resume>("/resumes", formData, { headers: { "Content-Type": "multipart/form-data" } }).then((r) => r.data);
  },
  update: (id: string, data: { name?: string; targetRole?: string; fileName?: string; tags?: string[]; file?: File | null }) => {
    const formData = new FormData();
    if (data.name !== undefined) formData.append("name", data.name);
    if (data.targetRole !== undefined) formData.append("targetRole", data.targetRole);
    if (data.fileName !== undefined) formData.append("fileName", data.fileName);
    if (data.tags !== undefined) formData.append("tags", JSON.stringify(data.tags));
    if (data.file) formData.append("file", data.file);
    return api.put<Resume>(`/resumes/${id}`, formData, { headers: { "Content-Type": "multipart/form-data" } }).then((r) => r.data);
  },
  delete: (id: string) => api.delete(`/resumes/${id}`).then((r) => r.data),
};

export const companiesAPI = {
  getAll: (
    params?: { page?: number; limit?: number; search?: string; stage?: Stage; sort?: "name" | "applications" | "recent" },
    config?: { quiet?: boolean; signal?: AbortSignal },
  ) =>
    api.get<PaginatedResponse<Company> & { stageCounts?: Record<Stage, number> }>("/companies", { params, ...config }).then((r) => r.data),
  getOne: (id: string) => api.get<CompanyDetail>(`/companies/${id}`).then((r) => r.data),
  create: (data: CompanyFormData) => api.post<Company>("/companies", data).then((r) => r.data),
  update: (id: string, data: Partial<CompanyFormData>) => api.put<Company>(`/companies/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/companies/${id}`).then((r) => r.data),
  /** Lazy fetch + cache the company logo (Clearbit→Cloudinary). Returns the logo URL,
   *  possibly empty if Clearbit had no match — empty means "we tried, don't re-ask". */
  fetchLogo: (id: string) => api.post<{ logoUrl: string; logoFetchedAt: string | null }>(`/companies/${id}/logo`).then((r) => r.data),
};

export const contactsAPI = {
  getAll: (
    params?: { page?: number; limit?: number; source?: "manual" | "extension" | "email"; status?: ContactOutreachStatus; search?: string },
    config?: { quiet?: boolean; signal?: AbortSignal },
  ) =>
    api.get<PaginatedResponse<Contact> & { statusCounts?: Record<ContactOutreachStatus, number> }>("/contacts", { params, ...config }).then((r) => r.data),
  getOne: (id: string) => api.get<Contact>(`/contacts/${id}`).then((r) => r.data),
  create: (data: ContactFormData) => api.post<Contact>("/contacts", data).then((r) => r.data),
  /** lastOutreachDate isn't on ContactFormData (it's set by the system when
   *  the user marks a follow-up complete, not on the create form). And
   *  nextFollowUpDate needs to accept `null` to clear the field — Omit + re-add
   *  because a naïve intersection collapses to the more restrictive `string`. */
  update: (id: string, data: Omit<Partial<ContactFormData>, "nextFollowUpDate"> & { lastOutreachDate?: string | null; nextFollowUpDate?: string | null }) =>
    api.put<Contact>(`/contacts/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/contacts/${id}`).then((r) => r.data),
};

export const deadlinesAPI = {
  getAll: (params?: {
    page?: number;
    limit?: number;
    status?: "all" | "upcoming" | "overdue" | "completed" | "active";
    /** Filter to deadlines linked to a specific application. Used by the
     *  Phase-3 "auto-complete on stage change" prompt. */
    applicationId?: string;
  }, config?: { quiet?: boolean; signal?: AbortSignal }) =>
    api
      .get<
        PaginatedResponse<Deadline> & {
          counts?: { upcoming: number; overdue: number; completed: number };
        }
      >("/deadlines", { params, ...config })
      .then((r) => r.data),

  /** Fetches every deadline page (API sorts by due date; calendar needs the full set). */
  async getAllAggregated(params?: { status?: "all" | "upcoming" | "overdue" | "completed" | "active" }, config?: { quiet?: boolean; signal?: AbortSignal }) {
    const acc: Deadline[] = [];
    let page = 1;
    const limit = 500;
    for (; ;) {
      const body = await api
        .get<
          PaginatedResponse<Deadline> & {
            counts?: { upcoming: number; overdue: number; completed: number };
          }
        >("/deadlines", { params: { ...params, page, limit }, ...config })
        .then((r) => r.data);
      acc.push(...body.data);
      if (page >= body.pagination.pages) break;
      page += 1;
    }
    return acc;
  },
  getOne: (id: string) => api.get<Deadline>(`/deadlines/${id}`).then((r) => r.data),
  create: (data: DeadlineFormData) => api.post<Deadline>("/deadlines", data).then((r) => r.data),
  update: (id: string, data: Partial<DeadlineFormData & { completed: boolean }>) => api.put<Deadline & { nextOccurrenceId?: string }>(`/deadlines/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/deadlines/${id}`).then((r) => r.data),
};

interface MailboxStatus { connected: boolean; email: string | null; lastSyncAt: string | null }
export interface GmailMailboxStatus extends MailboxStatus {
  firstScanCompleted: boolean;
  firstScanDays: number | null;
  hasConsent: boolean;
}
export interface EmailStatusResponse {
  gmail: GmailMailboxStatus;
  outlook: MailboxStatus & { configured: boolean };
}

export type ScanJobStatus =
  | "pending"
  | "scanning"
  | "filtering"
  | "classifying"
  | "ready_for_review"
  | "completed"
  | "failed";

export type ScanJobKind = "backfill" | "manual";

export interface ScanJob {
  _id: string;
  status: ScanJobStatus;
  /** "backfill" = first-time 5/10/15-day scan; "manual" = a "Scan now" catch-up. */
  kind?: ScanJobKind;
  windowDays: number;
  progress: { fetched: number; candidates: number; threadGroups: number; classified: number };
  counts: { totalCandidates: number; imported: number; skipped: number; merged: number; failed: number };
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
}

export type ScanCandidateStatus = "pending" | "imported" | "skipped" | "merged" | "failed";

export interface ScanCandidate {
  _id: string;
  status: ScanCandidateStatus;
  threadId: string;
  company: string;
  role: string;
  inferredStage: "Drafting" | "Applied" | "OA" | "Interview" | "Offer" | "Rejected";
  confidence: "low" | "medium" | "high";
  earliestEmailDate: string;
  latestEmailDate: string;
  evidence: { from: string; subject: string; snippet: string; latestMessageId: string; threadSize: number };
  matchedApplicationId: string | null;
  importedApplicationId: string | null;
  importError: string | null;
}

export const emailAPI = {
  status: () => api.get<EmailStatusResponse>("/email/status").then((r) => r.data),
  // Gmail
  connectGmail: () => api.post<{ url: string }>("/email/gmail/connect").then((r) => r.data),
  disconnectGmail: () => api.post("/email/gmail/disconnect").then((r) => r.data),
  // Outlook
  connectOutlook: () => api.post<{ url: string }>("/email/outlook/connect").then((r) => r.data),
  disconnectOutlook: () => api.post("/email/outlook/disconnect").then((r) => r.data),
  // First-scan backfill
  startFirstScan: (windowDays: 5 | 10 | 15) =>
    api.post<{ scanJobId: string; status: ScanJobStatus }>("/email/first-scan", {
      windowDays,
      consent: true,
    }).then((r) => r.data),
  /** Manual "Scan now" for a returning user. `afterEpochSec` is the lower bound
   *  (Unix seconds) computed client-side as 1 AM of the user's current local
   *  day. Runs the same async job + review queue as the backfill. */
  startManualScan: (afterEpochSec: number) =>
    api.post<{ scanJobId: string; status: ScanJobStatus }>("/email/rescan", {
      afterEpochSec,
    }).then((r) => r.data),
  getLatestScanJob: () =>
    api.get<{ job: ScanJob | null }>("/email/scan-jobs/latest").then((r) => r.data),
  getScanCandidates: (jobId: string) =>
    api
      .get<{ job: Pick<ScanJob, "_id" | "status" | "windowDays" | "counts" | "error">; candidates: ScanCandidate[] }>(
        `/email/scan-jobs/${jobId}/candidates`,
      )
      .then((r) => r.data),
  importCandidate: (
    id: string,
    overrides?: { company?: string; role?: string; stage?: ScanCandidate["inferredStage"]; applicationDate?: string },
  ) =>
    api.post<{ ok: true; applicationId: string }>(`/email/scan-candidates/${id}`, {
      action: "import",
      ...(overrides ?? {}),
    }).then((r) => r.data),
  skipCandidate: (id: string) =>
    api.post<{ ok: true }>(`/email/scan-candidates/${id}`, { action: "skip" }).then((r) => r.data),
  mergeCandidate: (id: string, targetApplicationId: string, updateStage = true) =>
    api.post<{ ok: true; applicationId: string }>(`/email/scan-candidates/${id}`, {
      action: "merge",
      targetApplicationId,
      updateStage,
    }).then((r) => r.data),
  bulkImport: (jobId: string) =>
    api.post<{ ok: true; imported: number; failed: number; skipped: number }>(
      `/email/scan-jobs/${jobId}/bulk-import`,
    ).then((r) => r.data),
  skipAll: (jobId: string) =>
    api.post<{ ok: true; skipped: number }>(`/email/scan-jobs/${jobId}/skip-all`).then((r) => r.data),
  completeScan: (jobId: string) =>
    api.post<{ ok: true }>(`/email/scan-jobs/${jobId}/complete`).then((r) => r.data),
  abandonScan: (jobId: string) =>
    api.post<{ ok: true }>(`/email/scan-jobs/${jobId}/abandon`).then((r) => r.data),
};

export const notificationsAPI = {
  getAll: (params?: { page?: number; limit?: number; status?: "current" | "past" }) =>
    api.get<PaginatedResponse<Notification>>("/notifications", { params }).then((r) => r.data),
  getUnreadCount: (config?: { quiet?: boolean; signal?: AbortSignal }) =>
    api.get<{ count: number }>("/notifications/unread-count", config).then((r) => r.data),
  markRead: (id: string) => api.put<Notification>(`/notifications/${id}/read`).then((r) => r.data),
  markAllRead: () => api.put("/notifications/read-all").then((r) => r.data),
  confirm: (id: string) => api.put<Notification>(`/notifications/${id}/confirm`).then((r) => r.data),
  revert: (id: string) => api.put<{ message: string; notification: Notification }>(`/notifications/${id}/revert`).then((r) => r.data),
  /** Move to Past (mark dealt-with). Default ✕ action in the Current tab. */
  dismiss: (id: string) => api.put<Notification>(`/notifications/${id}/dismiss`).then((r) => r.data),
  /** Permanently delete. The ✕ action in the Past tab. */
  remove: (id: string) => api.delete<{ message: string }>(`/notifications/${id}`).then((r) => r.data),
};

export const settingsAPI = {
  getMaintenanceStatus: () => api.get<{ maintenanceMode: boolean }>("/settings/maintenance-status").then((r) => r.data),
  getFeatureFlags: () => api.get<{ flags: Record<string, boolean> }>("/settings/features").then((r) => r.data),
};

export const announcementsAPI = {
  // User-facing active announcements (drives the app banner + header megaphone).
  getActive: () => api.get<Announcement[]>("/announcements/active").then((r) => r.data),
};

/* ---------- Tailor (JD analysis + accept/reject suggestions) ---------- */

export type TailorSection = "summary" | "experience" | "project" | "skills";
export type TailorKind = "rewrite" | "add" | "reorder" | "emphasize";
export type TailorDecision = "accepted" | "rejected" | null;

export interface TailorSuggestion {
  _id?: string;
  section: TailorSection;
  kind: TailorKind;
  targetCompanyOrName: string;
  targetBullet: string;
  suggested: string;
  rationale: string;
  tags: string[];
  decision: TailorDecision;
}

/** "waiting_assistant": the fit check runs in the person's assistant (MCP). */
export type TailorStatus = "processing" | "succeeded" | "failed" | "deferred" | "waiting_assistant";

export interface FitStrength { point: string; evidence: string }
export interface FitGap { point: string; severity: "major" | "minor" }
export interface FitChange {
  section: "summary" | "experience" | "projects" | "skills" | "education";
  target: string;
  change: string;
  why: string;
}

export interface TailorSession {
  _id: string;
  userId: string;
  applicationId: string | null;
  jobTitle: string;
  company: string;
  jobUrl: string;
  jobDescription: string;
  /** "processing" while LLM is running; "succeeded" or "failed" afterwards. Older
   *  sessions created before async mode default to "succeeded" server-side. */
  status: TailorStatus;
  errorMessage?: string;
  /** "ai_<reason>" behind a failure, and the lane it ran in — act on these. */
  errorCode?: string;
  errorLane?: string;
  /** The one match score, 0–10 (deterministic). Null on old sessions until backfilled. */
  matchScore: number | null;
  /** The AI's read in words. */
  summary: string;
  matchedSkills: string[];
  missingSkills: string[];
  strengths?: FitStrength[];
  gaps?: FitGap[];
  changes?: FitChange[];
  /** LEGACY (pre-2026-10) accept/reject suggestions; new checks return none. */
  suggestions: TailorSuggestion[];
  provider: string;
  modelId: string;
  createdAt: string;
  updatedAt: string;
}

export interface TailorInitResult {
  session: TailorSession;
  application: Application;
}

export const tailorAPI = {
  analyze: (data: { jobDescription: string; jobTitle?: string; company?: string; url?: string; applicationId?: string }) =>
    api.post<TailorSession>("/tailor/analyze", data).then((r) => r.data),
  /** Extension entrypoint — also creates a Drafting application linked to the session. */
  init: (data: { jobDescription: string; jobTitle?: string; company?: string; role?: string; url?: string }) =>
    api.post<TailorInitResult>("/tailor/init", data).then((r) => r.data),
  list: (limit = 30) => api.get<TailorSession[]>("/tailor/sessions", { params: { limit } }).then((r) => r.data),
  listForApplication: (applicationId: string, limit = 30) =>
    api.get<TailorSession[]>("/tailor/sessions", { params: { limit, applicationId } }).then((r) => r.data),
  get: (id: string, config?: { quiet?: boolean; signal?: AbortSignal }) => api.get<TailorSession>(`/tailor/sessions/${id}`, config).then((r) => r.data),
  setDecision: (sessionId: string, index: number, decision: TailorDecision) =>
    api.patch<TailorSession>(`/tailor/sessions/${sessionId}/suggestions/${index}`, { decision }).then((r) => r.data),
  linkApplication: (sessionId: string, applicationId: string) =>
    api.post<TailorSession>(`/tailor/sessions/${sessionId}/link/${applicationId}`).then((r) => r.data),
};

/** Master profile — one canonical career history per user. */
/** "waiting_assistant": the import runs in the person's assistant (MCP). */
export type MasterProfileParseStatus = "idle" | "processing" | "failed" | "waiting_assistant";

export interface MasterProfileShape {
  _id?: string;
  parseStatus?: MasterProfileParseStatus;
  parseError?: string;
  parseStartedAt?: string | null;
  /** Present when the last import changed an existing profile — "Undo import" is available. */
  lastImportSnapshot?: { savedAt: string; method: string } | null;
  sourceResumeId?: string | null;
  lastParsedAt?: string | null;
  // ...plus the structured profile fields (contact/experiences/etc) — typed as unknown
  // elsewhere because the page consumer has its own narrower types.
  [key: string]: unknown;
}

export const masterProfileAPI = {
  get: () => api.get<MasterProfileShape | null>("/master-profile").then((r) => r.data),
  update: (data: unknown) => api.put<MasterProfileShape>("/master-profile", data).then((r) => r.data),
  parseFromResume: (resumeId: string) => api.post<MasterProfileShape>(`/master-profile/parse-from-resume/${resumeId}`).then((r) => r.data),
  /** Put the profile back as it was before the last import. */
  undoImport: () => api.post<MasterProfileShape>("/master-profile/undo-import").then((r) => r.data),
  uploadAndParse: (file: File, name?: string) => {
    const fd = new FormData();
    fd.append("file", file);
    if (name) fd.append("name", name);
    return api.post<{ profile: MasterProfileShape; resume: Resume }>("/master-profile/upload-and-parse", fd, { headers: { "Content-Type": "multipart/form-data" } }).then((r) => r.data);
  },
};

/** Poll the master profile until parseStatus flips out of "processing". */
const MASTER_POLL_INTERVAL_MS = 2_500;
/** ~6 minutes: a long resume is read in several job steps. */
const MASTER_POLL_MAX_ATTEMPTS = 144;

export async function pollMasterProfileParse(): Promise<MasterProfileShape> {
  for (let i = 0; i < MASTER_POLL_MAX_ATTEMPTS; i++) {
    const p = await masterProfileAPI.get();
    if (!p) {
      // No profile at all — treat as "failed" so the task card surfaces something.
      throw new Error("Master profile disappeared during parse.");
    }
    if (p.parseStatus !== "processing") return p;
    await new Promise((r) => setTimeout(r, MASTER_POLL_INTERVAL_MS));
  }
  throw new Error("Parse is taking longer than expected. Refresh later to see the result.");
}

export type FeedbackType = "bug" | "suggestion" | "idea" | "praise" | "other";
export type FeedbackStatus = "open" | "triaged" | "in_progress" | "resolved" | "dismissed";
export type FeedbackSeverity = "low" | "normal" | "high" | "critical";

export interface FeedbackItem {
  _id: string;
  userId: string;
  userEmail: string;
  userName: string;
  type: FeedbackType;
  severity: FeedbackSeverity;
  title: string;
  message: string;
  pageContext: string;
  userAgent: string;
  appVersion: string;
  status: FeedbackStatus;
  adminNotes: string;
  resolvedById: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export const feedbackAPI = {
  submit: (data: { type: FeedbackType; title: string; message: string; pageContext?: string; userAgent?: string; appVersion?: string }) =>
    api.post<FeedbackItem>("/feedback", data).then((r) => r.data),
  mine: () => api.get<FeedbackItem[]>("/feedback/mine").then((r) => r.data),
};

export const adminAPI = {
  // Dashboard
  getDashboard: () => api.get<AdminDashboardData>("/admin/dashboard").then((r) => r.data),

  // Users
  getUsers: (params?: { page?: number; limit?: number; search?: string; role?: string; sort?: string; order?: string }, config?: { quiet?: boolean; signal?: AbortSignal }) =>
    api.get<PaginatedResponse<AdminUserDetail>>("/admin/users", { params, ...config }).then((r) => r.data),
  getUser: (id: string) => api.get<AdminUserDetail>(`/admin/users/${id}`).then((r) => r.data),
  updateUserRole: (id: string, role: string) => api.put(`/admin/users/${id}/role`, { role }).then((r) => r.data),
  suspendUser: (id: string) => api.put(`/admin/users/${id}/suspend`).then((r) => r.data),
  unsuspendUser: (id: string) => api.put(`/admin/users/${id}/unsuspend`).then((r) => r.data),
  deleteUser: (id: string) => api.delete(`/admin/users/${id}`).then((r) => r.data),
  hardDeleteUser: (id: string) => api.delete(`/admin/users/${id}/hard`).then((r) => r.data),
  exportUsers: () => api.get("/admin/users/export", { responseType: "blob" }).then((r) => r.data),

  // Settings
  getSettings: () => api.get<{ settings: SystemSetting[] }>("/admin/settings").then((r) => r.data),
  updateSetting: (key: string, value: unknown, valueType?: string) => api.put("/admin/settings", { key, value, valueType }).then((r) => r.data),

  // Announcements
  getAnnouncements: (params?: { page?: number; limit?: number }) => api.get<PaginatedResponse<Announcement>>("/admin/announcements", { params }).then((r) => r.data),
  createAnnouncement: (data: Partial<Announcement>) => api.post<Announcement>("/admin/announcements", data).then((r) => r.data),
  updateAnnouncement: (id: string, data: Partial<Announcement>) => api.put<Announcement>(`/admin/announcements/${id}`, data).then((r) => r.data),
  deleteAnnouncement: (id: string) => api.delete(`/admin/announcements/${id}`).then((r) => r.data),

  // Audit Logs
  getAuditLogs: (params?: { page?: number; limit?: number; action?: string; resourceType?: string; userId?: string; startDate?: string; endDate?: string }) =>
    api.get<PaginatedResponse<AuditLog>>("/admin/audit-logs", { params }).then((r) => r.data),

  // Demo account
  resetDemo: () => api.post<SeedResult>("/admin/seed/run").then((r) => r.data),

  // Broadcasts
  getBroadcastMailerStatus: () => api.get<MailerStatus>("/admin/broadcasts/status").then((r) => r.data),
  getBroadcastRecipientCount: (type: "all") => api.get<{ count: number }>("/admin/broadcasts/recipients", { params: { type } }).then((r) => r.data),
  listBroadcasts: (params?: { page?: number; limit?: number }) =>
    api.get<PaginatedResponse<BroadcastEmailItem>>("/admin/broadcasts", { params }).then((r) => r.data),
  getBroadcast: (id: string) => api.get<BroadcastEmailItem>(`/admin/broadcasts/${id}`).then((r) => r.data),
  sendBroadcast: (data: { subject: string; bodyHtml: string; recipientType: BroadcastRecipientType; userIds?: string[] }) =>
    api.post<{ id: string; totalRecipients: number; status: "sending" }>("/admin/broadcasts", data).then((r) => r.data),

  // Mailbox Management (Gmail + Outlook)
  getMailboxUsers: (params?: { page?: number; limit?: number; search?: string; provider?: MailboxProvider | "all" }) =>
    api.get<PaginatedResponse<AdminMailboxUser>>("/admin/mailbox/users", { params }).then((r) => r.data),
  getMailboxStats: () => api.get<AdminMailboxStats>("/admin/mailbox/stats").then((r) => r.data),
  disconnectMailbox: (userId: string, provider: MailboxProvider) =>
    api.post(`/admin/mailbox/${userId}/disconnect`, null, { params: { provider } }).then((r) => r.data),

  // Admin Notifications
  getAdminNotifications: (params?: { page?: number; limit?: number; search?: string; type?: string; read?: string; source?: string; resolved?: string }) =>
    api.get<PaginatedResponse<AdminNotificationItem>>("/admin/notifications", { params }).then((r) => r.data),
  getAdminNotificationStats: () => api.get<AdminNotificationStats>("/admin/notifications/stats").then((r) => r.data),
  deleteAdminNotification: (id: string) => api.delete(`/admin/notifications/${id}`).then((r) => r.data),

  // Admin Feedback
  listFeedback: (params?: { page?: number; limit?: number; status?: string; type?: string; severity?: string; search?: string }) =>
    api.get<PaginatedResponse<FeedbackItem>>("/admin/feedback", { params }).then((r) => r.data),
  getFeedback: (id: string) => api.get<FeedbackItem>(`/admin/feedback/${id}`).then((r) => r.data),
  getFeedbackStats: (config?: { quiet?: boolean; signal?: AbortSignal }) =>
    api.get<{ total: number; open: number; byStatus: Record<string, number>; byType: Record<string, number>; bySeverity: Record<string, number> }>("/admin/feedback/stats", config).then((r) => r.data),
  updateFeedback: (id: string, data: { status?: FeedbackStatus; severity?: FeedbackSeverity; adminNotes?: string }) =>
    api.patch<FeedbackItem>(`/admin/feedback/${id}`, data).then((r) => r.data),
  deleteFeedback: (id: string) => api.delete(`/admin/feedback/${id}`).then((r) => r.data),

  // Admin Bug Reports — silent captures from errorHandler + frontend interceptors.
  listBugReports: (params?: { page?: number; limit?: number; status?: BugReportStatus; source?: BugReportSource; search?: string }) =>
    api.get<PaginatedResponse<BugReport>>("/admin/bugs", { params }).then((r) => r.data),
  getBugReport: (id: string) => api.get<BugReport>(`/admin/bugs/${id}`).then((r) => r.data),
  getBugReportStats: (config?: { quiet?: boolean; signal?: AbortSignal }) =>
    api.get<{ total: number; open: number; byStatus: Record<string, number>; bySource: Record<string, number> }>("/admin/bugs/stats", config).then((r) => r.data),
  updateBugReport: (id: string, data: { status?: BugReportStatus; adminNotes?: string }) =>
    api.patch<BugReport>(`/admin/bugs/${id}`, data).then((r) => r.data),
  deleteBugReport: (id: string) => api.delete(`/admin/bugs/${id}`).then((r) => r.data),
};

/* ----- bug-report types (mirror backend/src/models/BugReport.ts) ----- */
export const BUG_REPORT_STATUSES = ["new", "triaged", "ignored", "fixed"] as const;
export type BugReportStatus = (typeof BUG_REPORT_STATUSES)[number];

export const BUG_REPORT_SOURCES = [
  "backend_500",
  "backend_async_worker",
  "frontend_uncaught",
  "frontend_axios_5xx",
  "frontend_unhandled_rejection",
] as const;
export type BugReportSource = (typeof BUG_REPORT_SOURCES)[number];

export interface BugReport {
  _id: string;
  fingerprint: string;
  count: number;
  firstSeenAt: string;
  lastSeenAt: string;
  affectedUserIds: string[];
  source: BugReportSource;
  route: string;
  method: string;
  errorMessage: string;
  errorStack: string;
  userAgent: string;
  requestBodyPreview: string;
  status: BugReportStatus;
  adminNotes: string;
  createdAt: string;
  updatedAt: string;
}
