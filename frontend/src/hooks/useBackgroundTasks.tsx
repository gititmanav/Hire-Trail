/**
 * App-level background task tracker.
 *
 * Long-running calls (parse-resume, sync-to-profile, tailor-analyze, pdf-render)
 * are dispatched here so the underlying Promise + its result live above the
 * component that triggered them. The component can unmount (user navigates
 * away) and the task keeps running; the result is preserved on the context
 * and surfaced in <BackgroundTaskCenter />.
 *
 * Recovery: tasks that hold a server-side document id (`recovery.resourceId`)
 * are persisted to localStorage. On provider mount we restore any unfinished
 * recovery entries and resume polling — that's what makes the task survive a
 * page refresh.
 */
import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode,
} from "react";

export type TaskKind =
  | "resume_parse"
  | "profile_sync"
  | "tailor_analyze"
  | "pdf_render";

export type TaskStatus = "running" | "success" | "error";

export interface BackgroundTask {
  id: string;
  kind: TaskKind;
  label: string;
  sublabel?: string;
  status: TaskStatus;
  /** Optional 0..1 progress — if undefined the UI shows an indeterminate animation. */
  progress?: number;
  error?: string;
  /** Shown in place of `label` once the task succeeds, e.g. "Fit score 4/5 (B)". */
  successLabel?: string;
  /** CTA after success: button label + path to navigate to. */
  ctaLabel?: string;
  ctaPath?: string;
  startedAt: number;
  finishedAt?: number;
}

/** Recovery hint persisted to localStorage so a refresh can resume the task. */
export interface TaskRecovery {
  /** Server-side resource id this task is polling (e.g. TailorSession._id). */
  resourceId: string;
  /** Free-form metadata you might need to reconstitute the run/onResult. */
  meta?: Record<string, string>;
}

/** Helpers exposed to a task's run() function. */
export interface RunCtx {
  /** Persist a recovery hint mid-run, e.g. once the server-side id is known.
   *  No-op if called after the task has already settled. */
  setRecovery: (recovery: TaskRecovery) => void;
}

export interface StartTaskInput<T> {
  /** Optional fixed id; if omitted a uuid-ish id is generated. Use when you want to
   *  reference the task later (e.g. set progress) or dedupe duplicates. */
  id?: string;
  kind: TaskKind;
  label: string;
  sublabel?: string;
  /** The actual async work — fires immediately. */
  run: (ctx: RunCtx) => Promise<T>;
  /** Customize the success card: success label, CTA, etc. */
  onResult?: (r: T) => {
    successLabel?: string;
    ctaLabel?: string;
    ctaPath?: string;
  } | void;
  /** Map an error to a short user-facing message. */
  onError?: (e: unknown) => string;
  /** Called after the task settles, regardless of outcome. Use for global side-effects
   *  (toast, refetch, etc.) — the callback fires even if the originating component unmounted. */
  onSettled?: (result: { ok: true; data: T } | { ok: false; error: unknown }) => void;
  /** Persist a hint to localStorage so a page refresh can recover this task. */
  recovery?: TaskRecovery;
}

/** Registered recovery handler — turns a persisted hint back into a task. */
interface RecoveryHandler {
  kind: TaskKind;
  /** Build a fresh StartTaskInput from the persisted hint. Return null to ignore. */
  rebuild: (recovery: TaskRecovery, label: string, sublabel?: string) => StartTaskInput<unknown> | null;
}

interface Ctx {
  tasks: BackgroundTask[];
  /** Kick off a task. Returns the task id. */
  startTask: <T,>(input: StartTaskInput<T>) => string;
  /** Remove a task card from the stack (does not cancel running work). */
  dismissTask: (id: string) => void;
  /** Remove all settled cards. */
  clearCompleted: () => void;
  /** Register how a task kind should be rebuilt after a page refresh. Call from a
   *  child component (e.g. Tailor) on mount — the provider runs the rebuild for any
   *  matching localStorage entries the next time it sees one. */
  registerRecovery: (handler: RecoveryHandler) => () => void;
}

const BackgroundTasksContext = createContext<Ctx | null>(null);

function genId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

const AUTO_DISMISS_MS = 6_000;
const RECOVERY_STORAGE_KEY = "hiretrail:bg-tasks:recovery";
const RECOVERY_TTL_MS = 10 * 60 * 1000; // ignore recovery entries older than 10 minutes

interface PersistedRecovery {
  id: string;
  kind: TaskKind;
  label: string;
  sublabel?: string;
  recovery: TaskRecovery;
  startedAt: number;
}

function readPersistedRecoveries(): PersistedRecovery[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECOVERY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PersistedRecovery[];
    if (!Array.isArray(parsed)) return [];
    const now = Date.now();
    return parsed.filter((p) => p && p.id && p.kind && p.recovery && (now - p.startedAt < RECOVERY_TTL_MS));
  } catch { return []; }
}

function writePersistedRecoveries(entries: PersistedRecovery[]): void {
  if (typeof localStorage === "undefined") return;
  try { localStorage.setItem(RECOVERY_STORAGE_KEY, JSON.stringify(entries)); } catch { /* quota — give up */ }
}

export function BackgroundTasksProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<BackgroundTask[]>([]);
  const dismissTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  // Map task id → persisted recovery entry. Used to clean localStorage on completion.
  const recoveryByTask = useRef<Map<string, PersistedRecovery>>(new Map());
  // Registered handlers keyed by kind.
  const recoveryHandlers = useRef<Map<TaskKind, RecoveryHandler>>(new Map());
  // Recovery entries waiting for a matching handler to be registered.
  const pendingRecoveries = useRef<PersistedRecovery[]>([]);

  const dismissTask = useCallback((id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    const timer = dismissTimers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      dismissTimers.current.delete(id);
    }
  }, []);

  const clearCompleted = useCallback(() => {
    setTasks((prev) => prev.filter((t) => t.status === "running"));
  }, []);

  const scheduleAutoDismiss = useCallback((id: string) => {
    const existing = dismissTimers.current.get(id);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      setTasks((prev) => prev.filter((t) => t.id !== id));
      dismissTimers.current.delete(id);
    }, AUTO_DISMISS_MS);
    dismissTimers.current.set(id, timer);
  }, []);

  const persistAllRecoveries = useCallback(() => {
    writePersistedRecoveries(Array.from(recoveryByTask.current.values()));
  }, []);

  const clearRecoveryFor = useCallback((id: string) => {
    if (recoveryByTask.current.delete(id)) persistAllRecoveries();
  }, [persistAllRecoveries]);

  const startTask = useCallback(<T,>(input: StartTaskInput<T>): string => {
    const id = input.id ?? genId();
    const startedAt = Date.now();
    const task: BackgroundTask = {
      id,
      kind: input.kind,
      label: input.label,
      sublabel: input.sublabel,
      status: "running",
      startedAt,
    };

    setTasks((prev) => {
      const without = prev.filter((t) => t.id !== id);
      return [task, ...without];
    });

    // Persist a recovery hint so a page refresh can resume polling.
    const writeRecovery = (recovery: TaskRecovery) => {
      const entry: PersistedRecovery = {
        id,
        kind: input.kind,
        label: input.label,
        sublabel: input.sublabel,
        recovery,
        startedAt,
      };
      recoveryByTask.current.set(id, entry);
      persistAllRecoveries();
    };
    if (input.recovery) writeRecovery(input.recovery);

    const runCtx: RunCtx = {
      setRecovery: writeRecovery,
    };

    // Fire the actual work. Failures here update the card; promise rejections
    // never bubble out of this function so a caller awaiting startTask's return
    // value (the id) never sees the underlying error.
    input.run(runCtx).then(
      (data) => {
        const extra = input.onResult?.(data) ?? {};
        setTasks((prev) =>
          prev.map((t) =>
            t.id === id
              ? {
                  ...t,
                  status: "success",
                  finishedAt: Date.now(),
                  successLabel: extra?.successLabel,
                  ctaLabel: extra?.ctaLabel,
                  ctaPath: extra?.ctaPath,
                }
              : t
          )
        );
        scheduleAutoDismiss(id);
        clearRecoveryFor(id);
        try { input.onSettled?.({ ok: true, data }); } catch { /* ignore */ }
      },
      (err) => {
        const msg = (input.onError?.(err) ?? extractErrorMessage(err)) || "Something went wrong.";
        setTasks((prev) =>
          prev.map((t) =>
            t.id === id ? { ...t, status: "error", finishedAt: Date.now(), error: msg } : t
          )
        );
        clearRecoveryFor(id);
        // Errors are not auto-dismissed — user must acknowledge.
        try { input.onSettled?.({ ok: false, error: err }); } catch { /* ignore */ }
      }
    );

    return id;
  }, [scheduleAutoDismiss, persistAllRecoveries, clearRecoveryFor]);

  const tryRebuild = useCallback((entry: PersistedRecovery) => {
    const handler = recoveryHandlers.current.get(entry.kind);
    if (!handler) return false;
    const input = handler.rebuild(entry.recovery, entry.label, entry.sublabel);
    if (!input) return false;
    // Reuse the persisted task id so the recovery card animates in once and we
    // don't end up with duplicate entries across refreshes.
    startTask({ ...input, id: entry.id });
    return true;
  }, [startTask]);

  const registerRecovery = useCallback((handler: RecoveryHandler) => {
    recoveryHandlers.current.set(handler.kind, handler);
    // Drain any pending recoveries this handler now covers.
    const remaining: PersistedRecovery[] = [];
    for (const entry of pendingRecoveries.current) {
      if (entry.kind === handler.kind) {
        if (!tryRebuild(entry)) remaining.push(entry);
      } else {
        remaining.push(entry);
      }
    }
    pendingRecoveries.current = remaining;
    return () => { recoveryHandlers.current.delete(handler.kind); };
  }, [tryRebuild]);

  // On mount: read localStorage and stage any active recoveries. Handlers that
  // haven't registered yet (because their page hasn't rendered) will pick them
  // up when registerRecovery() is called.
  useEffect(() => {
    const persisted = readPersistedRecoveries();
    if (persisted.length === 0) return;
    // Seed the in-memory map so persistAllRecoveries() rewrites the same set.
    for (const entry of persisted) recoveryByTask.current.set(entry.id, entry);
    pendingRecoveries.current = persisted;
    // Best-effort: try to rebuild now in case the handler for some kind is
    // already registered (e.g. registered above the first effect run).
    pendingRecoveries.current = persisted.filter((entry) => !tryRebuild(entry));
  }, [tryRebuild]);

  const value = useMemo<Ctx>(
    () => ({ tasks, startTask, dismissTask, clearCompleted, registerRecovery }),
    [tasks, startTask, dismissTask, clearCompleted, registerRecovery]
  );

  return (
    <BackgroundTasksContext.Provider value={value}>
      {children}
    </BackgroundTasksContext.Provider>
  );
}

export function useBackgroundTasks(): Ctx {
  const ctx = useContext(BackgroundTasksContext);
  if (!ctx) throw new Error("useBackgroundTasks must be used inside <BackgroundTasksProvider>");
  return ctx;
}

function extractErrorMessage(err: unknown): string {
  const e = err as {
    response?: { data?: { error?: string | Record<string, string[]> } };
    message?: string;
  };
  const raw = e?.response?.data?.error;
  if (typeof raw === "string") return raw;
  if (raw && typeof raw === "object") {
    const firstField = Object.values(raw)[0];
    if (Array.isArray(firstField) && firstField[0]) return String(firstField[0]);
  }
  return e?.message || "";
}
