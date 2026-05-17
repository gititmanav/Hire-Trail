/**
 * Typed API client: cookie sessions (withCredentials), JSON by default, multipart for resume uploads.
 * Interceptor surfaces server errors via toast and suppresses noise on 401 from /auth/me.
 * Base URL: `VITE_API_BASE_URL` or `/api` (see `config/apiBase.ts`).
 */
import axios, { AxiosError } from "axios";
import toast from "react-hot-toast";
import { getApiBaseURL } from "../config/apiBase.ts";
import type {
  User, Application, Resume, Contact, Deadline, AnalyticsData, AdminOverview,
  ApplicationFormData, ContactFormData, DeadlineFormData, PaginatedResponse,
  Company, CompanyDetail, CompanyFormData,
  AdminDashboardData, AdminUserDetail, PlatformAnalyticsData, AuditLog,
  Announcement, SystemSetting, Invite, EmailTemplate,
  StorageStats, RoleDefinition, SeedResult, Notification,
  AdminGmailUser, AdminGmailStats, AdminNotificationItem, AdminNotificationStats,
  AdminMailboxUser, AdminMailboxStats, MailboxProvider,
  BroadcastEmailItem, BroadcastRecipientType, MailerStatus,
} from "../types";

export const api = axios.create({
  baseURL: getApiBaseURL(),
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
});

api.interceptors.response.use(
  (r) => r,
  (error: AxiosError<{ error: string; code?: string }>) => {
    const code = error.response?.data?.code;
    if (code === "MAINTENANCE") return Promise.reject(error);
    const msg = error.response?.data?.error || error.message || "Something went wrong";
    if (error.response?.status === 401 && error.config?.url?.includes("/auth/me")) return Promise.reject(error);
    if (error.response?.status === 429) toast.error("Too many requests. Please slow down.");
    else if (error.response?.status !== 401) toast.error(msg);
    return Promise.reject(error);
  }
);

export const authAPI = {
  login: (email: string, password: string) => api.post<User>("/auth/login", { email, password }).then((r) => r.data),
  register: (name: string, email: string, password: string) => api.post<User>("/auth/register", { name, email, password }).then((r) => r.data),
  logout: () => api.post("/auth/logout").then((r) => r.data),
  getMe: () => api.get<User>("/auth/me").then((r) => r.data),
  updateProfile: (data: { name?: string; email?: string; primaryResumeId?: string | null }) =>
    api.put<User>("/auth/profile", data).then((r) => r.data),
  completeTour: () => api.put("/auth/tour").then((r) => r.data),
};

export const applicationsAPI = {
  getAll: (params?: { page?: number; limit?: number; sort?: string; order?: string; search?: string; archived?: string }) =>
    api.get<PaginatedResponse<Application>>("/applications", { params }).then((r) => r.data),
  getOne: (id: string) => api.get<Application>(`/applications/${id}`).then((r) => r.data),
  create: (data: ApplicationFormData) => api.post<Application>("/applications", data).then((r) => r.data),
  update: (id: string, data: Partial<ApplicationFormData & { applicationDate?: string; archived?: boolean; archivedAt?: string | null; archivedReason?: string | null }>) =>
    api.put<Application>(`/applications/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/applications/${id}`).then((r) => r.data),
  bulkImport: (applications: any[]) => api.post<{ message: string; count: number }>("/applications/bulk", { applications }).then((r) => r.data),
  archive: (id: string, reason?: string) => api.put<Application>(`/applications/${id}/archive`, { reason }).then((r) => r.data),
  unarchive: (id: string) => api.put<Application>(`/applications/${id}/unarchive`).then((r) => r.data),
};

export const resumesAPI = {
  getAll: () => api.get<Resume[]>("/resumes").then((r) => r.data),
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
  getAll: (params?: { page?: number; limit?: number; search?: string }) =>
    api.get<PaginatedResponse<Company>>("/companies", { params }).then((r) => r.data),
  getOne: (id: string) => api.get<CompanyDetail>(`/companies/${id}`).then((r) => r.data),
  create: (data: CompanyFormData) => api.post<Company>("/companies", data).then((r) => r.data),
  update: (id: string, data: Partial<CompanyFormData>) => api.put<Company>(`/companies/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/companies/${id}`).then((r) => r.data),
};

export const contactsAPI = {
  getAll: (params?: { page?: number; limit?: number }) =>
    api.get<PaginatedResponse<Contact>>("/contacts", { params }).then((r) => r.data),
  getOne: (id: string) => api.get<Contact>(`/contacts/${id}`).then((r) => r.data),
  create: (data: ContactFormData) => api.post<Contact>("/contacts", data).then((r) => r.data),
  update: (id: string, data: Partial<ContactFormData>) => api.put<Contact>(`/contacts/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/contacts/${id}`).then((r) => r.data),
};

export const deadlinesAPI = {
  getAll: (params?: {
    page?: number;
    limit?: number;
    status?: "all" | "upcoming" | "overdue" | "completed";
  }) =>
    api
      .get<
        PaginatedResponse<Deadline> & {
          counts?: { upcoming: number; overdue: number; completed: number };
        }
      >("/deadlines", { params })
      .then((r) => r.data),

  /** Fetches every deadline page (API sorts by due date; calendar needs the full set). */
  async getAllAggregated(params?: { status?: "all" | "upcoming" | "overdue" | "completed" }) {
    const acc: Deadline[] = [];
    let page = 1;
    const limit = 500;
    for (;;) {
      const body = await api
        .get<
          PaginatedResponse<Deadline> & {
            counts?: { upcoming: number; overdue: number; completed: number };
          }
        >("/deadlines", { params: { ...params, page, limit } })
        .then((r) => r.data);
      acc.push(...body.data);
      if (page >= body.pagination.pages) break;
      page += 1;
    }
    return acc;
  },
  getOne: (id: string) => api.get<Deadline>(`/deadlines/${id}`).then((r) => r.data),
  create: (data: DeadlineFormData) => api.post<Deadline>("/deadlines", data).then((r) => r.data),
  update: (id: string, data: Partial<DeadlineFormData & { completed: boolean }>) => api.put<Deadline>(`/deadlines/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/deadlines/${id}`).then((r) => r.data),
};

interface MailboxStatus { connected: boolean; email: string | null; lastSyncAt: string | null }
export interface EmailStatusResponse {
  gmail: MailboxStatus;
  outlook: MailboxStatus & { configured: boolean };
}

export const emailAPI = {
  status: () => api.get<EmailStatusResponse>("/email/status").then((r) => r.data),
  scan: () => api.post<{ message: string; applied: number; scanned: number; errors: string[] }>("/email/scan").then((r) => r.data),
  // Gmail
  connectGmail: () => api.post<{ url: string }>("/email/gmail/connect").then((r) => r.data),
  disconnectGmail: () => api.post("/email/gmail/disconnect").then((r) => r.data),
  // Outlook
  connectOutlook: () => api.post<{ url: string }>("/email/outlook/connect").then((r) => r.data),
  disconnectOutlook: () => api.post("/email/outlook/disconnect").then((r) => r.data),
};

export const notificationsAPI = {
  getAll: (params?: { page?: number; limit?: number }) =>
    api.get<PaginatedResponse<Notification>>("/notifications", { params }).then((r) => r.data),
  getUnreadCount: () => api.get<{ count: number }>("/notifications/unread-count").then((r) => r.data),
  markRead: (id: string) => api.put<Notification>(`/notifications/${id}/read`).then((r) => r.data),
  markAllRead: () => api.put("/notifications/read-all").then((r) => r.data),
  confirm: (id: string) => api.put<Notification>(`/notifications/${id}/confirm`).then((r) => r.data),
  revert: (id: string) => api.put<{ message: string; notification: Notification }>(`/notifications/${id}/revert`).then((r) => r.data),
};

export const analyticsAPI = {
  get: () => api.get<AnalyticsData>("/analytics").then((r) => r.data),
};

export const settingsAPI = {
  getMaintenanceStatus: () => api.get<{ maintenanceMode: boolean }>("/settings/maintenance-status").then((r) => r.data),
  getFeatureFlags: () => api.get<{ flags: Record<string, boolean> }>("/settings/features").then((r) => r.data),
};

export const proxyAPI = {
  fetchTweakcn: (url: string) => api.post<{ html: string }>("/proxy/tweakcn", { url }).then((r) => r.data),
};

export type AIProvider = "anthropic" | "openai" | "google" | "openrouter";

export interface AIKey {
  _id: string;
  provider: AIProvider;
  name: string;
  isActive: boolean;
  modelOverride: string | null;
  createdAt: string;
  updatedAt: string;
}

export const aiAPI = {
  listProviders: () => api.get<{ available: { provider: AIProvider; byok: boolean }[]; defaults: Record<AIProvider, { fast: string; smart: string }> }>("/ai/providers").then((r) => r.data),
  listKeys: () => api.get<AIKey[]>("/ai/keys").then((r) => r.data),
  createKey: (data: { provider: AIProvider; apiKey: string; name?: string; modelOverride?: string | null }) => api.post<AIKey>("/ai/keys", data).then((r) => r.data),
  updateKey: (id: string, data: { name?: string; modelOverride?: string | null; isActive?: boolean }) => api.put<AIKey>(`/ai/keys/${id}`, data).then((r) => r.data),
  deleteKey: (id: string) => api.delete(`/ai/keys/${id}`).then((r) => r.data),
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

export type TailorStatus = "processing" | "succeeded" | "failed";

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
  fitScore: number;
  fitGrade: "A" | "B" | "C" | "D" | "F" | "";
  summary: string;
  matchedSkills: string[];
  missingSkills: string[];
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
  get: (id: string) => api.get<TailorSession>(`/tailor/sessions/${id}`).then((r) => r.data),
  setDecision: (sessionId: string, index: number, decision: TailorDecision) =>
    api.patch<TailorSession>(`/tailor/sessions/${sessionId}/suggestions/${index}`, { decision }).then((r) => r.data),
  linkApplication: (sessionId: string, applicationId: string) =>
    api.post<TailorSession>(`/tailor/sessions/${sessionId}/link/${applicationId}`).then((r) => r.data),
  /** Transition the linked Drafting application → Applied, with the user's resume choice.
   *  If "tailored", the rendered PDF is also saved as a tag-tailored Resume row. */
  markApplied: (sessionId: string, resumeChoice: "primary" | "tailored") =>
    api.put<{ application: Application; tailoredResumeId: string | null }>(
      `/tailor/sessions/${sessionId}/mark-applied`,
      { resumeChoice }
    ).then((r) => r.data),
  /** Returns the PDF as a Blob along with metadata from response headers. */
  generatePdf: async (sessionId: string): Promise<{ blob: Blob; pages: number; warnings: string[] }> => {
    const res = await api.get(`/tailor/sessions/${sessionId}/pdf`, { responseType: "blob" });
    const pages = parseInt(res.headers["x-resume-pages"] || "1", 10);
    const rawWarn = res.headers["x-resume-warnings"];
    const warnings = rawWarn ? decodeURIComponent(rawWarn).split(" | ").filter(Boolean) : [];
    return { blob: res.data as Blob, pages, warnings };
  },
};

/** Master profile — one canonical career history per user. */
export type MasterProfileParseStatus = "idle" | "processing" | "failed";

export interface MasterProfileShape {
  _id?: string;
  parseStatus?: MasterProfileParseStatus;
  parseError?: string;
  parseStartedAt?: string | null;
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
  uploadAndParse: (file: File, name?: string) => {
    const fd = new FormData();
    fd.append("file", file);
    if (name) fd.append("name", name);
    return api.post<{ profile: MasterProfileShape; resume: Resume }>("/master-profile/upload-and-parse", fd, { headers: { "Content-Type": "multipart/form-data" } }).then((r) => r.data);
  },
};

/** Poll the master profile until parseStatus flips out of "processing". */
const MASTER_POLL_INTERVAL_MS = 2_000;
const MASTER_POLL_MAX_ATTEMPTS = 90;

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
  getOverview: () => api.get<AdminOverview>("/admin/overview").then((r) => r.data),

  // Dashboard
  getDashboard: () => api.get<AdminDashboardData>("/admin/dashboard").then((r) => r.data),

  // Users
  getUsers: (params?: { page?: number; limit?: number; search?: string; role?: string; sort?: string; order?: string }) =>
    api.get<PaginatedResponse<AdminUserDetail>>("/admin/users", { params }).then((r) => r.data),
  getUser: (id: string) => api.get<AdminUserDetail>(`/admin/users/${id}`).then((r) => r.data),
  updateUserRole: (id: string, role: string) => api.put(`/admin/users/${id}/role`, { role }).then((r) => r.data),
  suspendUser: (id: string) => api.put(`/admin/users/${id}/suspend`).then((r) => r.data),
  unsuspendUser: (id: string) => api.put(`/admin/users/${id}/unsuspend`).then((r) => r.data),
  deleteUser: (id: string) => api.delete(`/admin/users/${id}`).then((r) => r.data),
  hardDeleteUser: (id: string) => api.delete(`/admin/users/${id}/hard`).then((r) => r.data),
  impersonateUser: (id: string) => api.post(`/admin/users/${id}/impersonate`).then((r) => r.data),
  exportUsers: () => api.get("/admin/users/export", { responseType: "blob" }).then((r) => r.data),

  // Analytics
  getPlatformAnalytics: () => api.get<PlatformAnalyticsData>("/admin/analytics/platform").then((r) => r.data),

  // Content
  getContentApplications: (params?: Record<string, unknown>) => api.get<PaginatedResponse<Application & { userId: { _id: string; name: string; email: string } }>>("/admin/content/applications", { params }).then((r) => r.data),
  getContentContacts: (params?: Record<string, unknown>) => api.get<PaginatedResponse<Contact & { userId: { _id: string; name: string; email: string } }>>("/admin/content/contacts", { params }).then((r) => r.data),
  getContentDeadlines: (params?: Record<string, unknown>) => api.get<PaginatedResponse<Deadline & { userId: { _id: string; name: string; email: string } }>>("/admin/content/deadlines", { params }).then((r) => r.data),
  getContentResumes: (params?: Record<string, unknown>) => api.get<PaginatedResponse<Resume & { userId: { _id: string; name: string; email: string } }>>("/admin/content/resumes", { params }).then((r) => r.data),

  // Storage
  getStorage: () => api.get<StorageStats>("/admin/storage").then((r) => r.data),

  // Settings
  getSettings: () => api.get<{ settings: SystemSetting[]; grouped: Record<string, SystemSetting[]> }>("/admin/settings").then((r) => r.data),
  updateSetting: (key: string, value: unknown, valueType?: string) => api.put("/admin/settings", { key, value, valueType }).then((r) => r.data),

  // Announcements
  getAnnouncements: (params?: { page?: number; limit?: number }) => api.get<PaginatedResponse<Announcement>>("/admin/announcements", { params }).then((r) => r.data),
  createAnnouncement: (data: Partial<Announcement>) => api.post<Announcement>("/admin/announcements", data).then((r) => r.data),
  updateAnnouncement: (id: string, data: Partial<Announcement>) => api.put<Announcement>(`/admin/announcements/${id}`, data).then((r) => r.data),
  deleteAnnouncement: (id: string) => api.delete(`/admin/announcements/${id}`).then((r) => r.data),

  // Audit Logs
  getAuditLogs: (params?: { page?: number; limit?: number; action?: string; resourceType?: string; userId?: string; startDate?: string; endDate?: string }) =>
    api.get<PaginatedResponse<AuditLog>>("/admin/audit-logs", { params }).then((r) => r.data),

  // Email Templates
  getEmailTemplates: (params?: { page?: number; limit?: number }) => api.get<PaginatedResponse<EmailTemplate>>("/admin/email-templates", { params }).then((r) => r.data),
  getEmailTemplate: (id: string) => api.get<EmailTemplate>(`/admin/email-templates/${id}`).then((r) => r.data),
  createEmailTemplate: (data: Partial<EmailTemplate>) => api.post<EmailTemplate>("/admin/email-templates", data).then((r) => r.data),
  updateEmailTemplate: (id: string, data: Partial<EmailTemplate>) => api.put<EmailTemplate>(`/admin/email-templates/${id}`, data).then((r) => r.data),
  deleteEmailTemplate: (id: string) => api.delete(`/admin/email-templates/${id}`).then((r) => r.data),

  // Invites
  getInvites: (params?: { page?: number; limit?: number }) => api.get<PaginatedResponse<Invite>>("/admin/invites", { params }).then((r) => r.data),
  createInvite: (data: { email?: string; maxUses?: number; expiresAt: string }) => api.post<Invite>("/admin/invites", data).then((r) => r.data),
  deleteInvite: (id: string) => api.delete(`/admin/invites/${id}`).then((r) => r.data),

  // Backup
  exportBackup: () => api.post("/admin/backup/export", {}, { responseType: "blob" }).then((r) => r.data),
  getBackupList: () => api.get("/admin/backup/list").then((r) => r.data),
  exportUserData: (userId: string) => api.post(`/admin/backup/user-export/${userId}`, {}, { responseType: "blob" }).then((r) => r.data),

  // Roles
  getRoles: () => api.get<{ roles: RoleDefinition[] }>("/admin/roles").then((r) => r.data),

  // Seed
  runSeed: () => api.post<SeedResult>("/admin/seed/run").then((r) => r.data),
  clearSeed: () => api.post("/admin/seed/clear").then((r) => r.data),

  // Gmail Management (legacy)
  getGmailUsers: (params?: { page?: number; limit?: number; search?: string }) =>
    api.get<PaginatedResponse<AdminGmailUser>>("/admin/gmail/users", { params }).then((r) => r.data),
  getGmailStats: () => api.get<AdminGmailStats>("/admin/gmail/stats").then((r) => r.data),
  triggerGmailScan: (userId: string) => api.post<{ message: string; count: number }>(`/admin/gmail/${userId}/scan`).then((r) => r.data),
  disconnectUserGmail: (userId: string) => api.post(`/admin/gmail/${userId}/disconnect`).then((r) => r.data),

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
  triggerMailboxScan: (userId: string, provider: MailboxProvider) =>
    api.post<{ message: string; scanned: number; applied: number }>(`/admin/mailbox/${userId}/scan`, null, { params: { provider } }).then((r) => r.data),
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
  getFeedbackStats: () =>
    api.get<{ total: number; open: number; byStatus: Record<string, number>; byType: Record<string, number>; bySeverity: Record<string, number> }>("/admin/feedback/stats").then((r) => r.data),
  updateFeedback: (id: string, data: { status?: FeedbackStatus; severity?: FeedbackSeverity; adminNotes?: string }) =>
    api.patch<FeedbackItem>(`/admin/feedback/${id}`, data).then((r) => r.data),
  deleteFeedback: (id: string) => api.delete(`/admin/feedback/${id}`).then((r) => r.data),
};
