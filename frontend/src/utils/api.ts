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
} from "../types";

export const api = axios.create({
  baseURL: getApiBaseURL(),
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
});

api.interceptors.response.use(
  (r) => r,
  (error: AxiosError<{ error: string }>) => {
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
  update: (id: string, data: Partial<ApplicationFormData & { archived?: boolean; archivedAt?: string | null; archivedReason?: string | null }>) =>
    api.put<Application>(`/applications/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/applications/${id}`).then((r) => r.data),
  bulkImport: (applications: any[]) => api.post<{ message: string; count: number }>("/applications/bulk", { applications }).then((r) => r.data),
  archive: (id: string, reason?: string) => api.put<Application>(`/applications/${id}/archive`, { reason }).then((r) => r.data),
  unarchive: (id: string) => api.put<Application>(`/applications/${id}/unarchive`).then((r) => r.data),
};

export const resumesAPI = {
  getAll: () => api.get<Resume[]>("/resumes").then((r) => r.data),
  getOne: (id: string) => api.get<Resume>(`/resumes/${id}`).then((r) => r.data),
  create: (data: { name: string; targetRole: string; fileName: string; file?: File | null }) => {
    const formData = new FormData();
    formData.append("name", data.name);
    formData.append("targetRole", data.targetRole);
    formData.append("fileName", data.fileName);
    if (data.file) formData.append("file", data.file);
    return api.post<Resume>("/resumes", formData, { headers: { "Content-Type": "multipart/form-data" } }).then((r) => r.data);
  },
  update: (id: string, data: { name?: string; targetRole?: string; fileName?: string; file?: File | null }) => {
    const formData = new FormData();
    if (data.name !== undefined) formData.append("name", data.name);
    if (data.targetRole !== undefined) formData.append("targetRole", data.targetRole);
    if (data.fileName !== undefined) formData.append("fileName", data.fileName);
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
  getOne: (id: string) => api.get<Deadline>(`/deadlines/${id}`).then((r) => r.data),
  create: (data: DeadlineFormData) => api.post<Deadline>("/deadlines", data).then((r) => r.data),
  update: (id: string, data: Partial<DeadlineFormData & { completed: boolean }>) => api.put<Deadline>(`/deadlines/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/deadlines/${id}`).then((r) => r.data),
};

export const emailAPI = {
  connect: () => api.post<{ url: string }>("/email/connect").then((r) => r.data),
  status: () => api.get<{ connected: boolean; email: string | null; lastSyncAt: string | null }>("/email/status").then((r) => r.data),
  scan: () => api.post<{ message: string; count: number }>("/email/scan").then((r) => r.data),
  disconnect: () => api.post("/email/disconnect").then((r) => r.data),
};

export const notificationsAPI = {
  getAll: (params?: { page?: number; limit?: number }) =>
    api.get<PaginatedResponse<Notification>>("/notifications", { params }).then((r) => r.data),
  getUnreadCount: () => api.get<{ count: number }>("/notifications/unread-count").then((r) => r.data),
  markRead: (id: string) => api.put<Notification>(`/notifications/${id}/read`).then((r) => r.data),
  markAllRead: () => api.put("/notifications/read-all").then((r) => r.data),
};

export const analyticsAPI = {
  get: () => api.get<AnalyticsData>("/analytics").then((r) => r.data),
};

export const settingsAPI = {
  getFeatureFlags: () => api.get<{ flags: Record<string, boolean> }>("/settings/features").then((r) => r.data),
};

export const proxyAPI = {
  fetchTweakcn: (url: string) => api.post<{ html: string }>("/proxy/tweakcn", { url }).then((r) => r.data),
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

  // Gmail Management
  getGmailUsers: (params?: { page?: number; limit?: number; search?: string }) =>
    api.get<PaginatedResponse<AdminGmailUser>>("/admin/gmail/users", { params }).then((r) => r.data),
  getGmailStats: () => api.get<AdminGmailStats>("/admin/gmail/stats").then((r) => r.data),
  triggerGmailScan: (userId: string) => api.post<{ message: string; count: number }>(`/admin/gmail/${userId}/scan`).then((r) => r.data),
  disconnectUserGmail: (userId: string) => api.post(`/admin/gmail/${userId}/disconnect`).then((r) => r.data),

  // Admin Notifications
  getAdminNotifications: (params?: { page?: number; limit?: number; search?: string; type?: string; read?: string }) =>
    api.get<PaginatedResponse<AdminNotificationItem>>("/admin/notifications", { params }).then((r) => r.data),
  getAdminNotificationStats: () => api.get<AdminNotificationStats>("/admin/notifications/stats").then((r) => r.data),
  deleteAdminNotification: (id: string) => api.delete(`/admin/notifications/${id}`).then((r) => r.data),
};
