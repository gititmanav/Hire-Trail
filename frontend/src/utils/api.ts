/**
 * Typed API client: cookie sessions (withCredentials), JSON by default, multipart for resume uploads.
 * Interceptor surfaces server errors via toast and suppresses noise on 401 from /auth/me.
 */
import axios, { AxiosError } from "axios";
import toast from "react-hot-toast";
import type {
  User, Application, Resume, Contact, Deadline, AnalyticsData,
  ApplicationFormData, ContactFormData, DeadlineFormData, PaginatedResponse,
} from "../types";

const api = axios.create({ baseURL: "/api", headers: { "Content-Type": "application/json" }, withCredentials: true });

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
};

export const applicationsAPI = {
  getAll: (params?: { page?: number; limit?: number; sort?: string; order?: string; search?: string }) =>
    api.get<PaginatedResponse<Application>>("/applications", { params }).then((r) => r.data),
  getOne: (id: string) => api.get<Application>(`/applications/${id}`).then((r) => r.data),
  create: (data: ApplicationFormData) => api.post<Application>("/applications", data).then((r) => r.data),
  update: (id: string, data: Partial<ApplicationFormData>) => api.put<Application>(`/applications/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/applications/${id}`).then((r) => r.data),
  bulkImport: (applications: any[]) => api.post<{ message: string; count: number }>("/applications/bulk", { applications }).then((r) => r.data),
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

export const analyticsAPI = {
  get: () => api.get<AnalyticsData>("/analytics").then((r) => r.data),
};
