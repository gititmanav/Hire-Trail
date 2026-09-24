/** Query + mutation hooks for the Applications surfaces (List, Board, detail).
 *
 *  Key design:
 *    ["applications", "list", "page", params, page]  classic paginated list
 *    ["applications", "list", "all", params]         every match (table + board share it)
 *    ["applications", "detail", id]                  one full application
 *    ["applications", "filter-options", status]      Filters menu choices
 *
 *  Mutations patch every cached copy optimistically (the UI moves the instant
 *  you act), roll back on error, and revalidate on settle — so the server stays
 *  the source of truth without the user ever waiting on it.
 */
import { useMutation, useQuery, useQueryClient, keepPreviousData, type QueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  applicationsAPI, contactsAPI, deadlinesAPI, resumesAPI, companiesAPI,
  type ApplicationListParams, type ApplicationListResponse,
} from "../../../utils/api.ts";
import type { Application, ApplicationFormData, Stage } from "../../../types";

export const appKeys = {
  all: ["applications"] as const,
  lists: () => [...appKeys.all, "list"] as const,
  page: (params: ApplicationListParams, page: number) => [...appKeys.lists(), "page", params, page] as const,
  everything: (params: ApplicationListParams) => [...appKeys.lists(), "all", params] as const,
  detail: (id: string) => [...appKeys.all, "detail", id] as const,
  filterOptions: (status: "true" | "false") => [...appKeys.all, "filter-options", status] as const,
};

/** Poll while the AI is extracting a posting or analysing fit, so rows update
 *  live and stop polling the moment nothing is in flight. */
function aiInFlight(apps: Application[] | undefined): boolean {
  return !!apps?.some((a) => a.aiExtractionStatus === "processing" || a.fit?.status === "processing");
}

export function useApplicationsPage(params: ApplicationListParams, page: number, { enabled = true } = {}) {
  return useQuery({
    enabled,
    queryKey: appKeys.page(params, page),
    queryFn: ({ signal }) => applicationsAPI.getAll({ ...params, page, limit: 25 }, { quiet: true, signal }),
    placeholderData: keepPreviousData,
    refetchInterval: (q) => (aiInFlight(q.state.data?.data) ? 4000 : false),
    meta: { errorMessage: "Couldn't load your applications. Please try again." },
  });
}

/** Every application matching the filters (stage excluded — Board columns and
 *  table groups show all stages). 1000 is the server cap. */
export function useAllApplications(params: ApplicationListParams, { enabled = true } = {}) {
  return useQuery({
    enabled,
    queryKey: appKeys.everything({ ...params, stage: undefined }),
    queryFn: ({ signal }) => applicationsAPI.getAll({ ...params, stage: undefined, page: 1, limit: 1000 }, { quiet: true, signal }),
    placeholderData: keepPreviousData,
    refetchInterval: (q) => (aiInFlight(q.state.data?.data) ? 4000 : false),
    meta: { errorMessage: "Couldn't load your applications. Please try again." },
  });
}

export function useApplication(id: string | undefined) {
  const qc = useQueryClient();
  return useQuery<Application>({
    queryKey: appKeys.detail(id ?? ""),
    queryFn: ({ signal }) => applicationsAPI.getOne(id!, { quiet: true, signal }),
    enabled: !!id,
    // Seed from any list we already hold, so opening a row paints instantly;
    // the full document (with the job description) streams in right after.
    placeholderData: (): Application | undefined => (id ? findInLists(qc, id) : undefined),
    refetchInterval: (q) => (aiInFlight(q.state.data ? [q.state.data] : undefined) ? 4000 : false),
    // A missing application is a normal state (deleted, stale link): the page
    // renders it inline, and a 404 is never worth retrying.
    retry: (count, err) => count < 1 && ((err as { response?: { status?: number } })?.response?.status ?? 500) >= 500,
    meta: { silent: true },
  });
}

export function useApplicationDeadlines(id: string | undefined) {
  return useQuery({
    queryKey: ["deadlines", "application", id],
    queryFn: () => deadlinesAPI.getAll({ applicationId: id, status: "upcoming", limit: 50 }).then((r) => r.data),
    enabled: !!id,
  });
}

export function useFilterOptions(status: "true" | "false") {
  return useQuery({
    queryKey: appKeys.filterOptions(status),
    queryFn: ({ signal }) => applicationsAPI.filterOptions(status, { quiet: true, signal }),
    staleTime: 60_000,
  });
}

/* ─── Shared entity lists (resumes, contacts, deadlines, companies) ─── */

export function useResumes() {
  return useQuery({ queryKey: ["resumes"], queryFn: () => resumesAPI.getAll(), staleTime: 60_000 });
}
export function useContacts() {
  return useQuery({ queryKey: ["contacts", "all"], queryFn: () => contactsAPI.getAll({ limit: 500 }).then((r) => r.data), staleTime: 60_000 });
}
export function useUpcomingDeadlines() {
  return useQuery({ queryKey: ["deadlines", "upcoming"], queryFn: () => deadlinesAPI.getAll({ limit: 500, status: "upcoming" }).then((r) => r.data) });
}
export function useCompanies() {
  return useQuery({ queryKey: ["companies", "all"], queryFn: () => companiesAPI.getAll({ limit: 500 }).then((r) => r.data), staleTime: 5 * 60_000 });
}

/* ─── Cache helpers ─── */

function findInLists(qc: QueryClient, id: string): Application | undefined {
  for (const [, data] of qc.getQueriesData<ApplicationListResponse>({ queryKey: appKeys.lists() })) {
    const hit = data?.data.find((a) => a._id === id);
    if (hit) return hit;
  }
  return undefined;
}

type Snapshot = Array<[readonly unknown[], unknown]>;

function snapshot(qc: QueryClient, id?: string): Snapshot {
  const snap: Snapshot = qc.getQueriesData({ queryKey: appKeys.lists() });
  if (id) snap.push([appKeys.detail(id), qc.getQueryData(appKeys.detail(id))]);
  return snap;
}
function restore(qc: QueryClient, snap: Snapshot) {
  for (const [key, data] of snap) qc.setQueryData(key, data);
}

/** Apply `patch` to one application everywhere it's cached. Stage changes also
 *  move the per-stage counts so chips and group headers stay consistent. */
function patchEverywhere(qc: QueryClient, id: string, patch: (a: Application) => Application) {
  qc.setQueriesData<ApplicationListResponse>({ queryKey: appKeys.lists() }, (old) => {
    if (!old) return old;
    let counts = old.stageCounts;
    const data = old.data.map((a) => {
      if (a._id !== id) return a;
      const next = patch(a);
      if (counts && next.stage !== a.stage) {
        counts = { ...counts, [a.stage]: Math.max(0, (counts[a.stage] ?? 1) - 1), [next.stage]: (counts[next.stage] ?? 0) + 1 };
      }
      return next;
    });
    return { ...old, data, stageCounts: counts };
  });
  qc.setQueryData<Application>(appKeys.detail(id), (old) => (old ? patch(old) : old));
}

function removeEverywhere(qc: QueryClient, ids: Set<string>) {
  qc.setQueriesData<ApplicationListResponse>({ queryKey: appKeys.lists() }, (old) => {
    if (!old) return old;
    const removed = old.data.filter((a) => ids.has(a._id));
    if (removed.length === 0) return old;
    const counts = old.stageCounts ? { ...old.stageCounts } : undefined;
    if (counts) for (const a of removed) counts[a.stage] = Math.max(0, (counts[a.stage] ?? 1) - 1);
    return {
      ...old,
      data: old.data.filter((a) => !ids.has(a._id)),
      stageCounts: counts,
      pagination: { ...old.pagination, total: Math.max(0, old.pagination.total - removed.length) },
    };
  });
}

function invalidateApps(qc: QueryClient) {
  return qc.invalidateQueries({ queryKey: appKeys.all });
}

/* ─── Mutations ─── */

export function useStageMutation(opts: { onMoved?: (app: Application, from: Stage, to: Stage) => void } = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: Stage; from: Stage; app: Application }) =>
      applicationsAPI.update(id, { stage }),
    onMutate: async ({ id, stage }) => {
      await qc.cancelQueries({ queryKey: appKeys.all });
      const snap = snapshot(qc, id);
      const now = new Date().toISOString();
      patchEverywhere(qc, id, (a) => ({ ...a, stage, stageHistory: [...(a.stageHistory ?? []), { stage, date: now }] }));
      return { snap };
    },
    // The API interceptor already toasts the server's reason; just roll back.
    onError: (_e, _v, ctx) => { if (ctx) restore(qc, ctx.snap); },
    onSuccess: (_d, { app, from, stage }) => {
      toast.success(`Moved to ${stage}`, { id: `stage:${app._id}` });
      opts.onMoved?.(app, from, stage);
    },
    onSettled: () => invalidateApps(qc),
  });
}

export function useSaveApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string | null; data: Partial<ApplicationFormData> & { jobDescription?: string; archivedReason?: string } }) =>
      id ? applicationsAPI.update(id, data) : applicationsAPI.create(data as ApplicationFormData),
    onSuccess: (saved) => {
      qc.setQueryData(appKeys.detail(saved._id), (old: Application | undefined) => (old ? { ...old, ...saved } : saved));
    },
    onSettled: () => invalidateApps(qc),
  });
}

export function useArchiveMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, archived }: { ids: string[]; archived: boolean }) => {
      await Promise.all(ids.map((id) => (archived ? applicationsAPI.archive(id, "manual") : applicationsAPI.unarchive(id))));
    },
    onMutate: async ({ ids }) => {
      await qc.cancelQueries({ queryKey: appKeys.lists() });
      const snap = snapshot(qc);
      // Leaving the current tab either way — drop from the visible lists now.
      removeEverywhere(qc, new Set(ids));
      return { snap };
    },
    onError: (_e, _v, ctx) => { if (ctx) restore(qc, ctx.snap); },
    onSettled: () => invalidateApps(qc),
  });
}

export function useDeleteMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => { await Promise.all(ids.map((id) => applicationsAPI.delete(id))); },
    onMutate: async (ids) => {
      await qc.cancelQueries({ queryKey: appKeys.lists() });
      const snap = snapshot(qc);
      removeEverywhere(qc, new Set(ids));
      return { snap };
    },
    onError: (_e, _v, ctx) => { if (ctx) restore(qc, ctx.snap); },
    onSettled: () => invalidateApps(qc),
  });
}

export function useReanalyzeMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => applicationsAPI.reanalyze(id),
    onMutate: async (id) => {
      const snap = snapshot(qc, id);
      patchEverywhere(qc, id, (a) => ({
        ...a,
        fit: { sessionId: a.fit?.sessionId ?? "", status: "processing", fitScore: 0, fitGrade: "", matchedCount: 0, missingCount: 0, topMatched: [] },
      }));
      return { snap };
    },
    onError: (_e, _id, ctx) => { if (ctx) restore(qc, ctx.snap); },
    onSettled: (_d, _e, id) => {
      void qc.invalidateQueries({ queryKey: appKeys.detail(id) });
      void qc.invalidateQueries({ queryKey: appKeys.lists() });
    },
  });
}
