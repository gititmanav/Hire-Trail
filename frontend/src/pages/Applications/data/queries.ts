/** Query + mutation hooks for the Applications surfaces (Ledger, Trail, Desk,
 *  Board, the application page).
 *
 *  Key design:
 *    ["applications", "list", "page", params, page]  one page (exports, small lists)
 *    ["applications", "list", "all", params]         every match (every view shares it)
 *    ["applications", "detail", id]                  one full application
 *    ["applications", "filter-options", status]      Filters menu choices
 *    ["applications", "insights"]                    reply window + Sweep count
 *    ["applications", "sweep"]                       Sweep's queue
 *
 *  Mutations patch every cached copy optimistically (the UI moves the instant
 *  you act), roll back on error, and revalidate once the LAST pending write
 *  settles — revalidating after the first of two quick moves would repaint
 *  the second one back to where it was. */
import { useMutation, useQuery, useQueryClient, keepPreviousData, type QueryClient } from "@tanstack/react-query";
import toast from "../../../components/ui/toast.ts";
import {
  applicationsAPI, contactsAPI, deadlinesAPI, resumesAPI, companiesAPI,
  type ApplicationBatchAction, type ApplicationListParams, type ApplicationListResponse,
} from "../../../utils/api.ts";
import { DEFAULT_REPLY_WINDOW } from "./focus.ts";
import type { Application, ApplicationFormData, ArchiveReason, ReplyWindow, Stage } from "../../../types";

export const appKeys = {
  all: ["applications"] as const,
  lists: () => [...appKeys.all, "list"] as const,
  page: (params: ApplicationListParams, page: number) => [...appKeys.lists(), "page", params, page] as const,
  everything: (params: ApplicationListParams) => [...appKeys.lists(), "all", params] as const,
  detail: (id: string) => [...appKeys.all, "detail", id] as const,
  filterOptions: (status: "true" | "false") => [...appKeys.all, "filter-options", status] as const,
  insights: () => [...appKeys.all, "insights"] as const,
  sweep: () => [...appKeys.all, "sweep"] as const,
};

/** Every application write carries this key, so a settle can tell whether it's the last one. */
const WRITE_KEY = ["applications", "write"] as const;

/** The server's cap on one list request. */
export const LIST_CAP = 1000;

/** Poll while the AI is extracting a posting or analysing fit, so rows update
 *  live and stop polling the moment nothing is in flight. */
function aiInFlight(apps: Application[] | undefined): boolean {
  return !!apps?.some((a) => a.aiExtractionStatus === "processing" || a.fit?.status === "processing");
}

/** Every application matching the filters (stage excluded — groups, columns
 *  and sections show all stages and count them). 1000 is the server cap. */
export function useAllApplications(params: ApplicationListParams, { enabled = true } = {}) {
  return useQuery({
    enabled,
    queryKey: appKeys.everything({ ...params, stage: undefined }),
    queryFn: ({ signal }) => applicationsAPI.getAll({ ...params, stage: undefined, page: 1, limit: LIST_CAP }, { quiet: true, signal }),
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

/** Warm an application's full document (the Desk's neighbours, a hovered row). */
export function prefetchApplication(qc: QueryClient, id: string) {
  void qc.prefetchQuery({
    queryKey: appKeys.detail(id),
    queryFn: ({ signal }) => applicationsAPI.getOne(id, { quiet: true, signal }),
    staleTime: 30_000,
  });
}

export function useFilterOptions(status: "true" | "false") {
  return useQuery({
    queryKey: appKeys.filterOptions(status),
    queryFn: ({ signal }) => applicationsAPI.filterOptions(status, { quiet: true, signal }),
    staleTime: 60_000,
  });
}

/** The person's reply window (falls back to the 14-day default until it loads). */
export function useInsights() {
  return useQuery({
    queryKey: appKeys.insights(),
    queryFn: ({ signal }) => applicationsAPI.insights({ quiet: true, signal }),
    staleTime: 60_000,
    meta: { silent: true },
  });
}
export function useReplyWindow(): ReplyWindow {
  return useInsights().data?.replyWindow ?? DEFAULT_REPLY_WINDOW;
}

export function useSweepQueue(enabled: boolean) {
  return useQuery({
    queryKey: appKeys.sweep(),
    queryFn: ({ signal }) => applicationsAPI.sweep({ quiet: true, signal }),
    enabled,
    staleTime: 0,
    meta: { errorMessage: "Couldn't load your quiet applications. Please try again." },
  });
}

/* ─── Shared entity lists (resumes, contacts, deadlines, companies) ─── */

export function useResumes() {
  return useQuery({ queryKey: ["resumes"], queryFn: ({ signal }) => resumesAPI.getAll({ quiet: true, signal }), staleTime: 60_000 });
}
export function useContacts() {
  return useQuery({
    queryKey: ["contacts", "all"],
    queryFn: ({ signal }) => contactsAPI.getAll({ limit: 1000 }, { quiet: true, signal }).then((r) => r.data),
    staleTime: 60_000,
  });
}
/** Every open deadline, overdue included — what each application's next step is read from. */
export function useOpenDeadlines() {
  return useQuery({
    queryKey: ["deadlines", "active"],
    queryFn: ({ signal }) => deadlinesAPI.getAll({ limit: 2000, status: "active" }, { quiet: true, signal }).then((r) => r.data),
    staleTime: 30_000,
  });
}
export function useCompanies() {
  return useQuery({
    queryKey: ["companies", "all"],
    queryFn: ({ signal }) => companiesAPI.getAll({ limit: 500 }, { quiet: true, signal }).then((r) => r.data),
    staleTime: 5 * 60_000,
  });
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

function snapshot(qc: QueryClient, ids: string[] = []): Snapshot {
  const snap: Snapshot = qc.getQueriesData({ queryKey: appKeys.lists() });
  for (const id of ids) snap.push([appKeys.detail(id), qc.getQueryData(appKeys.detail(id))]);
  return snap;
}
function restore(qc: QueryClient, snap: Snapshot) {
  for (const [key, data] of snap) qc.setQueryData(key, data);
}

/** Apply `patch` to applications everywhere they're cached. Stage changes also
 *  move the per-stage counts so group headers and columns stay consistent. */
function patchEverywhere(qc: QueryClient, ids: Set<string>, patch: (a: Application) => Application) {
  qc.setQueriesData<ApplicationListResponse>({ queryKey: appKeys.lists() }, (old) => {
    if (!old) return old;
    let counts = old.stageCounts;
    const data = old.data.map((a) => {
      if (!ids.has(a._id)) return a;
      const next = patch(a);
      if (counts && next.stage !== a.stage) {
        counts = { ...counts, [a.stage]: Math.max(0, (counts[a.stage] ?? 1) - 1), [next.stage]: (counts[next.stage] ?? 0) + 1 };
      }
      return next;
    });
    return { ...old, data, stageCounts: counts };
  });
  for (const id of ids) qc.setQueryData<Application>(appKeys.detail(id), (old) => (old ? patch(old) : old));
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

/** Revalidate after the last pending write — and everything that shows
 *  applications too (the calendar's records, its Dashboard card). */
function settle(qc: QueryClient, { deadlines = false } = {}) {
  if (qc.isMutating({ mutationKey: WRITE_KEY }) > 1) return;
  void qc.invalidateQueries({ queryKey: appKeys.all });
  void qc.invalidateQueries({ queryKey: ["calendar"] });
  if (deadlines) void qc.invalidateQueries({ queryKey: ["deadlines"] });
}

/* ─── Mutations ─── */

export function useStageMutation(opts: { onMoved?: (app: Application, from: Stage, to: Stage) => void } = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: WRITE_KEY,
    mutationFn: ({ id, stage }: { id: string; stage: Stage; from: Stage; app: Application }) =>
      applicationsAPI.update(id, { stage }),
    onMutate: async ({ id, stage }) => {
      await qc.cancelQueries({ queryKey: appKeys.all });
      const snap = snapshot(qc, [id]);
      const now = new Date().toISOString();
      patchEverywhere(qc, new Set([id]), (a) => ({ ...a, stage, stageHistory: [...(a.stageHistory ?? []), { stage, date: now }] }));
      return { snap };
    },
    // The API interceptor already toasts the server's reason; just roll back.
    onError: (_e, _v, ctx) => { if (ctx) restore(qc, ctx.snap); },
    onSuccess: (_d, { app, from, stage }) => {
      toast.success(`Moved to ${stage}`, { id: `stage:${app._id}` });
      opts.onMoved?.(app, from, stage);
    },
    onSettled: () => settle(qc),
  });
}

export function useSaveApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: WRITE_KEY,
    mutationFn: ({ id, data }: { id: string | null; data: Partial<ApplicationFormData> & { jobDescription?: string; applicationDate?: string } }) =>
      id ? applicationsAPI.update(id, data) : applicationsAPI.create(data as ApplicationFormData),
    onSuccess: (saved) => {
      qc.setQueryData(appKeys.detail(saved._id), (old: Application | undefined) => (old ? { ...old, ...saved } : saved));
    },
    onSettled: () => settle(qc),
  });
}

/** Many applications in one request. Archive / unarchive / delete leave the
 *  visible lists at once; a stage move repaints in place. */
export function useBatchMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: WRITE_KEY,
    mutationFn: ({ ids, body }: { ids: string[]; body: ApplicationBatchAction }) => applicationsAPI.batch(ids, body),
    onMutate: async ({ ids, body }) => {
      await qc.cancelQueries({ queryKey: appKeys.all });
      const snap = snapshot(qc, ids);
      const set = new Set(ids);
      if (body.action === "stage") {
        const now = new Date().toISOString();
        patchEverywhere(qc, set, (a) => (a.stage === body.stage ? a : { ...a, stage: body.stage, stageHistory: [...(a.stageHistory ?? []), { stage: body.stage, date: now }] }));
      } else if (body.action !== "undoStage") {
        // Leaving the current tab (or the account) either way.
        removeEverywhere(qc, set);
      }
      return { snap };
    },
    onError: (_e, _v, ctx) => { if (ctx) restore(qc, ctx.snap); },
    onSettled: (_d, _e, { body }) => settle(qc, { deadlines: body.action === "delete" }),
  });
}

/** Archive (or restore) — one request however many. */
export function useArchiveMutation() {
  const batch = useBatchMutation();
  return {
    ...batch,
    mutate: (
      { ids, archived, reason = "manual" }: { ids: string[]; archived: boolean; reason?: ArchiveReason },
      opts?: { onSuccess?: () => void },
    ) => batch.mutate({ ids, body: archived ? { action: "archive", reason } : { action: "unarchive" } }, opts),
  };
}

export function useDeleteMutation() {
  const batch = useBatchMutation();
  return {
    ...batch,
    mutate: (ids: string[], opts?: { onSuccess?: () => void }) => batch.mutate({ ids, body: { action: "delete" } }, opts),
  };
}

export function useReanalyzeMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => applicationsAPI.reanalyze(id),
    onMutate: async (id) => {
      const snap = snapshot(qc, [id]);
      patchEverywhere(qc, new Set([id]), (a) => ({
        ...a,
        fit: { sessionId: a.fit?.sessionId ?? "", status: "processing", score: null, matchedCount: 0, missingCount: 0, topMatched: [] },
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
