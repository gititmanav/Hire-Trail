export type UserRole = "user" | "admin";
export interface User { _id: string; name: string; email: string; role: UserRole; }
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
export interface StageEntry { stage: Stage; date: string; }
export interface Application {
  _id: string; userId: string; company: string; role: string; jobUrl: string;
  applicationDate: string; stage: Stage; stageHistory: StageEntry[];
  notes: string; resumeId: string | null; createdAt: string; updatedAt: string;
}
export interface Resume {
  _id: string; userId: string; name: string; targetRole: string; fileName: string;
  fileUrl: string; filePublicId: string;
  uploadDate: string; createdAt: string; updatedAt: string; applicationCount?: number;
}
export interface Contact {
  _id: string; userId: string; name: string; company: string; role: string;
  linkedinUrl: string; connectionSource: string; lastContactDate: string;
  notes: string; createdAt: string; updatedAt: string;
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
export interface ApplicationFormData { company: string; role: string; jobUrl: string; stage: Stage; notes: string; resumeId: string; }
export interface ResumeFormData { name: string; targetRole: string; fileName: string; file?: File | null; }
export interface ContactFormData { name: string; company: string; role: string; linkedinUrl: string; connectionSource: string; notes: string; }
export interface DeadlineFormData { applicationId: string; type: string; dueDate: string; notes: string; }
export type SortOrder = "asc" | "desc";
export interface SortConfig { field: string; order: SortOrder; }
