/** Calendar data: one query per visible range (GET /api/calendar), and the
 *  edits a job seeker makes from the calendar — reschedule, correct an applied
 *  date, complete, delete, create. Edits are optimistic across every cached
 *  range (the Dashboard card's too), roll back on failure (the API interceptor
 *  shows the reason), and refresh Applications + Deadlines when they settle so
 *  List, Board and the detail page agree. */
import { useCallback, useEffect } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import toast, { toastWithUndo } from "../../../../components/ui/toast.ts";
import { applicationsAPI, calendarAPI, deadlinesAPI, type CalendarParams, type CalendarResponse } from "../../../../utils/api.ts";
import { formatDay, type Ymd } from "../../../../utils/dates.ts";
import type { CalendarEvent } from "../../../../utils/calendarGrid.ts";
import type { ApplicationFilters } from "../../data/filters.ts";
import type { DeadlineFormData } from "../../../../types";

/** Which kinds of event the calendar shows (Filters → Display options). */
export type CalendarShow = Record<CalendarEvent["kind"], boolean>;
export const DEFAULT_SHOW: CalendarShow = { deadline: true, applied: true, stage: true };
export const isCalendarShow = (v: unknown): v is CalendarShow =>
  !!v && typeof v === "object" && ["deadline", "applied", "stage"].every((k) => typeof (v as Record<string, unknown>)[k] === "boolean");

export const calendarKeys = {
  all: ["calendar"] as const,
  range: (p: CalendarParams) => ["calendar", p] as const,
};

/** The viewer's zone, so moments land on their local day server-side. */
export const VIEWER_TZ = (() => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch { return "UTC"; }
})();

/** Calendar params for a range under the Applications filters. */
export function calendarParams(filters: ApplicationFilters | null, from: Ymd, to: Ymd): CalendarParams {
  const p: CalendarParams = { from, to, tz: VIEWER_TZ };
  if (!filters) return p;
  if (filters.q.trim()) p.search = filters.q.trim();
  if (filters.status === "archived") p.archived = "true";
  if (filters.stage) p.stage = filters.stage;
  if (filters.company) p.company = filters.company;
  if (filters.resume) p.resumeId = filters.resume;
  if (filters.source) p.source = filters.source;
  return p;
}

function fetchRange(params: CalendarParams, signal?: AbortSignal) {
  return calendarAPI.get(params, { quiet: true, signal });
}

/** One range. Paging keeps the previous range on screen until the next lands
 *  (no spinner); neighbours are usually prefetched already. */
export function useCalendarRange(params: CalendarParams, { enabled = true } = {}) {
  return useQuery({
    enabled,
    queryKey: calendarKeys.range(params),
    queryFn: ({ signal }) => fetchRange(params, signal),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    meta: { errorMessage: "Couldn't load your calendar. Please try again." },
  });
}

/** Warm the pages on either side so ‹ › paint from cache. */
export function usePrefetchRanges(list: CalendarParams[]) {
  const qc = useQueryClient();
  const key = JSON.stringify(list);
  useEffect(() => {
    for (const params of list) {
      void qc.prefetchQuery({ queryKey: calendarKeys.range(params), queryFn: ({ signal }) => fetchRange(params, signal), staleTime: 30_000 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, qc]);
}

/* ─── Cache helpers ─── */

type Snapshot = Array<[readonly unknown[], CalendarResponse | undefined]>;

function snapshot(qc: QueryClient): Snapshot {
  return qc.getQueriesData<CalendarResponse>({ queryKey: calendarKeys.all });
}
function restore(qc: QueryClient, snap: Snapshot) {
  for (const [key, data] of snap) qc.setQueryData(key, data);
}
/** Rewrite the events of every cached range. */
function patchEvents(qc: QueryClient, fn: (events: CalendarEvent[]) => CalendarEvent[]) {
  qc.setQueriesData<CalendarResponse>({ queryKey: calendarKeys.all }, (old) => (old ? { ...old, events: fn(old.events) } : old));
}
function settle(qc: QueryClient) {
  void qc.invalidateQueries({ queryKey: calendarKeys.all });
  void qc.invalidateQueries({ queryKey: ["applications"] });
  void qc.invalidateQueries({ queryKey: ["deadlines"] });
}

const shortDay = (day: Ymd) => formatDay(day, { weekday: "short", month: "short", day: "numeric" });

/* ─── Mutations ─── */

/** Move an event to another day: a deadline's due date, or an application's
 *  applied date (a correction). The chip is already there when this runs
 *  (the drag preview), so the cache moves with it and Undo moves it back. */
export function useMoveEvent() {
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: async ({ event, to }: { event: CalendarEvent; to: Ymd; from: Ymd; undo?: boolean }): Promise<void> => {
      if (event.kind === "deadline") await deadlinesAPI.update(event.entityId, { dueDate: to });
      else await applicationsAPI.update(event.entityId, { applicationDate: to });
    },
    onMutate: async ({ event, to }) => {
      await qc.cancelQueries({ queryKey: calendarKeys.all });
      const snap = snapshot(qc);
      patchEvents(qc, (events) => events.map((e) => (e.id === event.id ? { ...e, date: to } : e)));
      return { snap };
    },
    onError: (_e, _v, ctx) => { if (ctx) restore(qc, ctx.snap); },
    onSuccess: (_d, { event, to, from, undo }) => {
      if (undo) return;
      toastWithUndo(`Moved to ${shortDay(to)}`, () => m.mutate({ event: { ...event, date: to }, to: from, from: to, undo: true }));
    },
    onSettled: () => settle(qc),
  });
  return m;
}

/** Mark a deadline done. Done deadlines leave the calendar; Undo reopens it
 *  and removes the repeat the server spawned for a recurring one. */
export function useCompleteDeadline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (event: CalendarEvent) => deadlinesAPI.update(event.entityId, { completed: true }),
    onMutate: async (event) => {
      await qc.cancelQueries({ queryKey: calendarKeys.all });
      const snap = snapshot(qc);
      patchEvents(qc, (events) => events.filter((e) => e.entityId !== event.entityId || e.kind !== "deadline"));
      return { snap };
    },
    onError: (_e, _v, ctx) => { if (ctx) restore(qc, ctx.snap); },
    onSuccess: (res, event) => {
      toastWithUndo(`${event.title} done`, async () => {
        patchEvents(qc, (events) => [...events.filter((e) => e.id !== event.id), event]);
        try {
          await deadlinesAPI.update(event.entityId, { completed: false });
          if (res.nextOccurrenceId) await deadlinesAPI.delete(res.nextOccurrenceId);
        } finally {
          settle(qc);
        }
      });
    },
    onSettled: () => settle(qc),
  });
}

export function useDeleteDeadline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (event: CalendarEvent) => deadlinesAPI.delete(event.entityId),
    onMutate: async (event) => {
      await qc.cancelQueries({ queryKey: calendarKeys.all });
      const snap = snapshot(qc);
      patchEvents(qc, (events) => events.filter((e) => e.entityId !== event.entityId || e.kind !== "deadline"));
      return { snap };
    },
    onError: (_e, _v, ctx) => { if (ctx) restore(qc, ctx.snap); },
    onSuccess: () => { toast.success("Deadline deleted"); },
    onSettled: () => settle(qc),
  });
}

/** Create or edit a deadline (the shared deadline dialog). */
export function useSaveDeadline() {
  const qc = useQueryClient();
  const save = useCallback(async (id: string | null, data: DeadlineFormData) => {
    // An empty applicationId is "standalone" — the API stores it as null.
    if (id) await deadlinesAPI.update(id, data);
    else await deadlinesAPI.create(data);
    toast.success(id ? "Deadline updated" : `Deadline added for ${shortDay(data.dueDate)}`);
    settle(qc);
  }, [qc]);
  return save;
}
