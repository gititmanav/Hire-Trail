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
  /** When false, re-parsing a resume overwrites the master profile instead of AI-merging. Default true. */
  mergeResumesEnabled?: boolean;
}
export type NotificationType =
  | "rejection_detected"
  | "interview_detected"
  | "offer_detected"
  | "follow_up_detected"
  | "info";

export interface Notification {
  _id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  applicationId: string | null;
  source: "gmail" | "outlook" | null;
  sourceEmailId: string | null;
  previousStage: string | null;
  resolved: boolean;
  resolvedAt: string | null;
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
export type Stage = "Drafting" | "Applied" | "OA" | "Interview" | "Offer" | "Rejected";
export type OutreachStatus = "none" | "reached_out" | "referred" | "response_received";
export type ArchiveReason = "auto_stale" | "rejected" | "manual";
export type ApplicationSource = "manual" | "extension" | "email";

export type FitStatus = "processing" | "succeeded" | "failed" | "deferred";
export interface AppFit {
  sessionId: string;
  status: FitStatus;
  fitScore: number;
  fitGrade: "A" | "B" | "C" | "D" | "F" | "";
  summary: string;
  matchedCount: number;
  missingCount: number;
  /** Up to 3 top matched skill names — surfaced as the checkmark list on
   *  the Application row's AI Fit panel. */
  topMatched?: string[];
  errorMessage?: string;
}
export type ContactOutreachStatus = "not_contacted" | "reached_out" | "responded" | "meeting_scheduled" | "follow_up_needed" | "gone_cold";
export interface StageEntry { stage: Stage; date: string; }
export interface Application {
  _id: string; userId: string; company: string; companyId: string | null; role: string; jobUrl: string;
  applicationDate: string; stage: Stage; stageHistory: StageEntry[];
  jobDescription?: string; location?: string; salary?: string; jobType?: string;
  notes: string; resumeId: string | null;
  /** Set when this application originated from (or was linked to) a Tailor session.
   *  Drafting-stage apps always have this; later stages may inherit it after a
   *  Drafting → Applied transition via "Mark as Applied". */
  tailorSessionId: string | null;
  contactId: string | null;
  outreachStatus: OutreachStatus;
  archived: boolean; archivedAt: string | null; archivedReason: ArchiveReason | null;
  source?: ApplicationSource;
  /** Present when the app was created via the Gmail inbox-backfill scan.
   *  Drives the "From email" chip. */
  emailImport?: {
    scanJobId: string;
    candidateId: string;
    threadId: string;
    importedAt: string;
  } | null;
  /** Server-derived summary of the linked TailorSession, when one exists. */
  fit?: AppFit | null;
  createdAt: string; updatedAt: string;
}
export interface ResumeVersion { timestamp: string; summary: string; }
/** Per-resume performance metrics computed server-side from linked
 *  Applications. Rates are 0..1 fractions of `total` (which excludes
 *  Drafting apps). Null on the parent when the resume has zero submitted
 *  apps — UI should hide the strip in that case. */
export interface ResumeMetrics {
  total: number;
  responseRate: number;
  oaRate: number;
  interviewRate: number;
  offerRate: number;
}
export interface Resume {
  _id: string; userId: string; name: string; targetRole: string; tags?: string[]; fileName: string;
  fileUrl: string; filePublicId: string; isProtected?: boolean;
  uploadDate: string; createdAt: string; updatedAt: string; applicationCount?: number;
  /** Lineage fields for the Resumes-page "tailored variants" tree. Both
   *  null for hand-uploaded resumes and legacy tailored resumes that pre-date
   *  the lineage tracking (those appear in an "Untraced" bucket on the page). */
  baseResumeId?: string | null;
  tailorSessionId?: string | null;
  /** Edit history surfaced on the card's "Version history" expander. Newest
   *  entries are at the end. Empty array for resumes that haven't been
   *  mutated since the field was introduced. */
  versions?: ResumeVersion[];
  metrics?: ResumeMetrics | null;
}
export type ContactSource = "manual" | "extension" | "email";
export interface Contact {
  _id: string; userId: string; name: string; company: string; companyId: string | null; role: string;
  linkedinUrl: string; connectionSource: string; lastContactDate: string;
  notes: string;
  applicationIds: string[];
  outreachStatus: ContactOutreachStatus;
  lastOutreachDate: string | null; nextFollowUpDate: string | null;
  source?: ContactSource;
  createdAt: string; updatedAt: string;
}

export interface Company {
  _id: string; name: string; website: string; domain: string;
  logoUrl?: string; logoPublicId?: string; logoFetchedAt?: string | null;
  createdBy: string; users: string[];
  applicationCount?: number;
  createdAt: string; updatedAt: string;
}
export interface Deadline {
  _id: string; userId: string; applicationId: string | null; type: string;
  dueDate: string; completed: boolean; notes: string;
  /** 0 = one-off; >0 = repeats every N days. Spawns the next occurrence
   *  automatically on the server when this one is marked complete. */
  recurrenceDays?: number;
  createdAt: string; updatedAt: string;
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
export interface DeadlineFormData { applicationId: string; type: string; dueDate: string; notes: string; recurrenceDays?: number; }
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
    // Users
    totalUsers: number;
    adminUsers: number;
    regularUsers: number;
    signupsToday: number;
    signupsThisWeek: number;
    signupsThisMonth: number;
    activeUsers7d: number;
    // App tracking
    totalApplications: number;
    totalResumes: number;
    totalContacts: number;
    totalDeadlines: number;
    // Integrations
    gmailConnectedUsers: number;
    outlookConnectedUsers: number;
    anyMailboxConnected: number;
    // AI
    aiByokUserCount: number;
    // Master profile + tailor
    masterProfileUsers: number;
    tailorSessionsTotal: number;
    tailorSessionsThisWeek: number;
    avgFitScore: number | null;
    // Feedback
    feedbackOpen: number;
  };
  breakdowns: {
    applicationsByStage: Record<string, number>;
    aiKeysByProvider: Record<string, number>;
    tailorFitDistribution: Record<string, number>;
    signalsThisMonth: Record<string, number>;
    feedbackByType: Record<string, number>;
  };
  recentActivity: AuditLog[];
  charts: {
    userGrowth: { _id: string; count: number }[];
    appsPerDay: { _id: string; count: number }[];
    tailorPerDay: { _id: string; count: number }[];
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
  /** True when the user has a parsed master profile document. */
  hasMasterProfile?: boolean;
  /** Number of resume-tailor sessions this user has run. */
  tailorSessionCount?: number;
  /** Number of active BYOK AI provider keys. */
  aiKeyCount?: number;
  outlookConnected?: boolean;
  outlookEmail?: string | null;
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

export type NotificationSignalType =
  | "rejection_detected"
  | "interview_detected"
  | "offer_detected"
  | "follow_up_detected"
  | "info";

export interface AdminNotificationItem {
  _id: string;
  userId: { _id: string; name: string; email: string };
  type: NotificationSignalType;
  title: string;
  message: string;
  applicationId: { _id: string; company: string; role: string } | null;
  source: "gmail" | "outlook" | null;
  sourceEmailId: string | null;
  previousStage: string | null;
  resolved: boolean;
  resolvedAt: string | null;
  read: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface AdminNotificationStats {
  total: number;
  unread: number;
  byType: { _id: string; count: number }[];
  bySource: { _id: string; count: number }[];
  last30Days: number;
  todayCount: number;
  resolvedCount: number;
  unresolvedSignals: number;
}

export interface AdminGmailStats {
  gmailConnectedCount: number;
  totalRejectionsDetected: number;
  totalScansToday: number;
}

export type MailboxProvider = "gmail" | "outlook";

export type BroadcastStatus = "sending" | "completed" | "partial" | "failed";
export type BroadcastRecipientType = "all" | "selected";

export interface BroadcastFailedEmail {
  email: string;
  error: string;
}

export interface BroadcastEmailItem {
  _id: string;
  subject: string;
  bodyHtml?: string;
  recipientType: BroadcastRecipientType;
  recipientUserIds: string[];
  sentByUserId: { _id: string; name: string; email: string } | string;
  status: BroadcastStatus;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  failedEmails?: BroadcastFailedEmail[];
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MailerStatus {
  configured: boolean;
  sender: string;
  senderName: string;
  host: string;
  port: number;
}

export interface AdminMailboxUser {
  _id: string;
  name: string;
  email: string;
  gmailConnected: boolean;
  gmailEmail: string | null;
  gmailLastSyncAt: string | null;
  outlookConnected: boolean;
  outlookEmail: string | null;
  outlookLastSyncAt: string | null;
  createdAt: string;
}

export interface AdminMailboxStats {
  providers: {
    gmailConnected: number;
    outlookConnected: number;
    bothConnected: number;
    anyConnected: number;
  };
  signals: {
    rejections: number;
    interviews: number;
    offers: number;
    followUps: number;
  };
  signalsToday: number;
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
  tailor: {
    totalSessions: number;
    last30Days: number;
    avgFitScore: number;
    gradeBreakdown: { _id: "A" | "B" | "C" | "D" | "F"; count: number }[];
  };
  masterProfile: {
    total: number;
    adoptionRate: number;
    coverage: {
      personal: number;
      experience: number;
      projects: number;
      education: number;
      skills: number;
      certifications: number;
    };
  };
  aiProviders: { _id: string; count: number }[];
  mailbox: {
    connectedUsers: number;
    adoptionRate: number;
    signalsLast30: { _id: string; count: number }[];
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
