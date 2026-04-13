export type UserRole = "user" | "admin";
export interface User {
  _id: string; name: string; email: string; role: UserRole;
  suspended?: boolean; suspendedAt?: string | null;
  deleted?: boolean; deletedAt?: string | null;
  tourCompleted?: boolean;
  /** Default resume for new applications (extension uses this when tracking a job). */
  primaryResumeId?: string | null;
  gmailConnected?: boolean;
  gmailEmail?: string | null;
  gmailLastSyncAt?: string | null;
}
export interface Notification {
  _id: string;
  userId: string;
  type: "rejection_detected" | "info";
  title: string;
  message: string;
  applicationId: string | null;
  read: boolean;
  readAt: string | null;
  createdAt: string;
}
export interface AdminLoginEvent {
  _id: string;
  userId: string;
  email: string;
  name: string;
  provider: "local" | "google";
  ipAddress: string;
  userAgent: string;
  loggedInAt: string;
}
export interface AdminOverview {
  stats: {
    totalUsers: number;
    adminUsers: number;
    regularUsers: number;
    totalLoginsTracked: number;
  };
  users: (Pick<User, "_id" | "name" | "email" | "role"> & { createdAt: string; updatedAt: string })[];
  recentLogins: AdminLoginEvent[];
}
export type Stage = "Applied" | "OA" | "Interview" | "Offer" | "Rejected";
export type OutreachStatus = "none" | "reached_out" | "referred" | "response_received";
export type ArchiveReason = "auto_stale" | "rejected" | "manual";
export type ContactOutreachStatus = "not_contacted" | "reached_out" | "responded" | "meeting_scheduled" | "follow_up_needed" | "gone_cold";
export interface StageEntry { stage: Stage; date: string; }
export interface Application {
  _id: string; userId: string; company: string; companyId: string | null; role: string; jobUrl: string;
  applicationDate: string; stage: Stage; stageHistory: StageEntry[];
  jobDescription?: string; location?: string; salary?: string; jobType?: string;
  notes: string; resumeId: string | null;
  contactId: string | null;
  outreachStatus: OutreachStatus;
  archived: boolean; archivedAt: string | null; archivedReason: ArchiveReason | null;
  createdAt: string; updatedAt: string;
}
export interface Resume {
  _id: string; userId: string; name: string; targetRole: string; tags?: string[]; fileName: string;
  fileUrl: string; filePublicId: string;
  uploadDate: string; createdAt: string; updatedAt: string; applicationCount?: number;
}
export interface Contact {
  _id: string; userId: string; name: string; company: string; companyId: string | null; role: string;
  linkedinUrl: string; connectionSource: string; lastContactDate: string;
  notes: string;
  applicationIds: string[];
  outreachStatus: ContactOutreachStatus;
  lastOutreachDate: string | null; nextFollowUpDate: string | null;
  createdAt: string; updatedAt: string;
}

export interface Company {
  _id: string; name: string; website: string; domain: string;
  createdBy: string; users: string[];
  applicationCount?: number;
  createdAt: string; updatedAt: string;
}
export interface Deadline {
  _id: string; userId: string; applicationId: string | null; type: string;
  dueDate: string; completed: boolean; notes: string; createdAt: string; updatedAt: string;
}
export interface Pagination { page: number; limit: number; total: number; pages: number; }
export interface PaginatedResponse<T> { data: T[]; pagination: Pagination; }
export interface AnalyticsData {
  funnel: Record<Stage, number>; total: number;
  resumePerformance: { _id: string; total: number; responses: number; }[];
  weeklyTrend: { _id: { year: number; week: number }; count: number; firstDate: string; }[];
}
export interface CompanyDetail extends Company {
  applications: Application[];
  applicationCount: number;
}
export interface CompanyFormData { name: string; website?: string; }
export interface ApplicationFormData { company: string; role: string; jobUrl: string; stage: Stage; notes: string; resumeId: string; companyId: string; contactId: string; outreachStatus: OutreachStatus; location?: string; salary?: string; jobType?: string; }
export interface ResumeFormData { name: string; targetRole: string; fileName: string; file?: File | null; }
export interface ContactFormData { name: string; company: string; role: string; linkedinUrl: string; connectionSource: string; notes: string; companyId: string; applicationIds: string[]; outreachStatus: ContactOutreachStatus; nextFollowUpDate: string; }
export interface DeadlineFormData { applicationId: string; type: string; dueDate: string; notes: string; }
export type SortOrder = "asc" | "desc";
export interface SortConfig { field: string; order: SortOrder; }

/* ───── Admin Panel Types ───── */

export interface AuditLog {
  _id: string;
  timestamp: string;
  userId: { _id: string; name: string; email: string } | string;
  action: string;
  resourceType: string;
  resourceId?: string;
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress: string;
  userAgent: string;
  metadata?: unknown;
}

export interface Announcement {
  _id: string;
  title: string;
  body: string;
  type: "info" | "warning" | "success";
  startDate: string;
  endDate: string;
  dismissible: boolean;
  active: boolean;
  createdBy: { _id: string; name: string; email: string } | string;
  createdAt: string;
  updatedAt: string;
}

export interface SystemSetting {
  _id: string;
  key: string;
  value: unknown;
  valueType: "string" | "number" | "boolean" | "json";
  description: string;
  category: string;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Invite {
  _id: string;
  code: string;
  email: string | null;
  maxUses: number;
  usedCount: number;
  expiresAt: string;
  createdBy: { _id: string; name: string; email: string } | string;
  usedBy: { userId: string; usedAt: string }[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EmailTemplate {
  _id: string;
  name: string;
  subject: string;
  bodyHtml: string;
  variables: string[];
  type: "welcome" | "reset" | "suspend" | "reminder" | "digest";
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminDashboardData {
  stats: {
    totalUsers: number;
    totalApplications: number;
    totalResumes: number;
    totalContacts: number;
    totalDeadlines: number;
    signupsToday: number;
    signupsThisWeek: number;
    signupsThisMonth: number;
    activeUsers7d: number;
    gmailConnectedUsers: number;
    totalNotifications: number;
    unreadNotifications: number;
    rejectionsDetected30d: number;
  };
  recentActivity: AuditLog[];
  charts: {
    userGrowth: { _id: string; count: number }[];
    appsPerDay: { _id: string; count: number }[];
    rejectionsPerDay: { _id: string; count: number }[];
  };
}

export interface AdminUserDetail extends User {
  applicationCount: number;
  resumeCount: number;
  contactCount?: number;
  deadlineCount?: number;
  notificationCount?: number;
  lastLogin: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminGmailUser {
  _id: string;
  name: string;
  email: string;
  gmailConnected: boolean;
  gmailEmail: string | null;
  gmailLastSyncAt: string | null;
  createdAt: string;
}

export interface AdminNotificationItem {
  _id: string;
  userId: { _id: string; name: string; email: string };
  type: "rejection_detected" | "info";
  title: string;
  message: string;
  applicationId: { _id: string; company: string; role: string } | null;
  read: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface AdminNotificationStats {
  total: number;
  unread: number;
  byType: { _id: string; count: number }[];
  last30Days: number;
}

export interface AdminGmailStats {
  gmailConnectedCount: number;
  totalRejectionsDetected: number;
  totalScansToday: number;
}

export interface PlatformAnalyticsData {
  funnel: { _id: string; count: number }[];
  topCompanies: { _id: string; count: number }[];
  topRoles: { _id: string; count: number }[];
  totalApplications: number;
  totalUsers: number;
  avgAppsPerUser: number;
  conversionRates: {
    oaRate: number;
    interviewRate: number;
    offerRate: number;
    rejectionRate: number;
  };
  trends: {
    weeklySignups: { _id: { year: number; week: number }; count: number }[];
    weeklyRejections: { _id: { year: number; week: number }; count: number }[];
  };
}

export interface StorageStats {
  stats: {
    totalFiles: number;
    orphanedFiles: number;
    cloudinary: {
      totalStorage: number;
      storageLimit: number;
      bandwidth: number;
      bandwidthLimit: number;
      transformations: number;
    } | null;
  };
  files: {
    _id: string;
    name: string;
    fileName: string;
    targetRole: string;
    fileUrl: string;
    filePublicId: string;
    user: { _id: string; name: string; email: string };
    createdAt: string;
  }[];
  orphans: {
    _id: string;
    name: string;
    filePublicId: string;
    user: { _id: string; name: string; email: string };
  }[];
}

export interface RoleDefinition {
  role: string;
  description: string;
  permissions: string[];
}

export interface SeedResult {
  message: string;
  users: number;
  resumes: number;
  applications: number;
  contacts: number;
  deadlines: number;
  companies: number;
  total: number;
}
