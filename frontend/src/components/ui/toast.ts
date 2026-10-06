/** The one toast. Every confirmation, warning and error in the app goes
 *  through `toast` — the <Toaster /> in main.tsx draws them (Toaster.tsx).
 *
 *    toast("Saved to drafts")                       neutral
 *    toast.success("Application added")            done
 *    toast.warning("Free-tier key")                 heads-up
 *    toast.error("Couldn't save — try again")       failed
 *    const id = toast.loading("Preparing export…")  stays until updated:
 *    toast.success("Exported 12 applications", { id })
 *
 *  Options: `description` (a second, quieter line), `action` (one button —
 *  Undo, Open settings; it runs, then the toast closes), `duration` (ms), and
 *  `id`: a toast with a live id updates in place instead of stacking a twin,
 *  which is how identical errors collapse and a loading toast settles.
 *
 *  A plain module (no React) so the axios and query layers can toast too.
 *  Timers live here; the Toaster pauses them while the stack is hovered or
 *  focused, or the tab is hidden. */

export type ToastTone = "default" | "success" | "warning" | "error" | "loading";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  id?: string;
  description?: string;
  duration?: number;
  action?: ToastAction;
}

export interface ToastItem {
  /** Caller-facing id (dedupe + updates). */
  id: string;
  /** Render key — a new toast reusing an id that's still leaving gets its own. */
  key: string;
  tone: ToastTone;
  title: string;
  description?: string;
  action?: ToastAction;
  duration: number;
  /** Bumps on every in-place update, so the card can re-measure. */
  version: number;
  /** Closing: drawn on its way out, then removed. */
  leaving: boolean;
}

const DURATION: Record<ToastTone, number> = {
  default: 4000,
  success: 4000,
  warning: 6000,
  error: 6000,
  loading: Infinity,
};
/** A toast with a button stays long enough to reach it. */
const ACTION_MIN_MS = 6000;
/** Matches the exit transition in Toaster.tsx. */
export const TOAST_EXIT_MS = 220;
/** The stack shows this many; an older one closes when a newer arrives. */
export const TOAST_LIMIT = 3;

let toasts: ToastItem[] = [];
const listeners = new Set<() => void>();
let seq = 0;

function emit() {
  for (const l of listeners) l();
}

export function subscribeToasts(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Oldest first. A new array on every change (for useSyncExternalStore). */
export function getToasts(): ToastItem[] {
  return toasts;
}

/* ─── Timers ─── */

interface Timer { handle: ReturnType<typeof setTimeout> | null; startedAt: number; remaining: number }
const timers = new Map<string, Timer>();
let paused = false;

function startTimer(key: string, ms: number) {
  stopTimer(key);
  if (!Number.isFinite(ms)) return;
  const t: Timer = { handle: null, startedAt: Date.now(), remaining: ms };
  if (!paused) t.handle = setTimeout(() => closeKey(key), ms);
  timers.set(key, t);
}

function stopTimer(key: string) {
  const t = timers.get(key);
  if (t?.handle) clearTimeout(t.handle);
  timers.delete(key);
}

/** Hold every countdown (the stack is hovered, focused, or the tab hidden). */
export function pauseToasts(): void {
  if (paused) return;
  paused = true;
  const now = Date.now();
  for (const t of timers.values()) {
    if (t.handle) clearTimeout(t.handle);
    t.handle = null;
    t.remaining -= now - t.startedAt;
  }
}

/** Resume them — with at least a second left, so nothing vanishes the
 *  instant the pointer leaves. */
export function resumeToasts(): void {
  if (!paused) return;
  paused = false;
  const now = Date.now();
  for (const [key, t] of timers) {
    t.startedAt = now;
    t.remaining = Math.max(t.remaining, 1000);
    t.handle = setTimeout(() => closeKey(key), t.remaining);
  }
}

/* ─── Show / update / close ─── */

function closeKey(key: string) {
  stopTimer(key);
  const item = toasts.find((t) => t.key === key);
  if (!item || item.leaving) return;
  toasts = toasts.map((t) => (t.key === key ? { ...t, leaving: true } : t));
  emit();
  setTimeout(() => {
    toasts = toasts.filter((t) => t.key !== key);
    emit();
  }, TOAST_EXIT_MS);
}

function show(tone: ToastTone, title: string, opts: ToastOptions = {}): string {
  const id = opts.id ?? `toast-${++seq}`;
  const base = opts.duration ?? DURATION[tone];
  const duration = opts.action && Number.isFinite(base) ? Math.max(base, ACTION_MIN_MS) : base;
  const live = toasts.find((t) => t.id === id && !t.leaving);
  const next: ToastItem = {
    id,
    key: live?.key ?? `${id}#${++seq}`,
    tone,
    title,
    description: opts.description,
    action: opts.action,
    duration,
    version: (live?.version ?? 0) + 1,
    leaving: false,
  };

  if (live) {
    toasts = toasts.map((t) => (t === live ? next : t));
  } else {
    toasts = [...toasts, next];
    // Past the limit, the oldest open toast makes room.
    const open = toasts.filter((t) => !t.leaving);
    if (open.length > TOAST_LIMIT) setTimeout(() => closeKey(open[0].key), 0);
  }
  emit();
  startTimer(next.key, duration);
  return id;
}

/** Close one toast by id, or every toast. */
function dismiss(id?: string): void {
  for (const t of toasts) {
    if (!t.leaving && (id === undefined || t.id === id)) closeKey(t.key);
  }
}

type Show = (title: string, opts?: ToastOptions) => string;

export const toast = Object.assign(((title, opts) => show("default", title, opts)) as Show, {
  success: ((title, opts) => show("success", title, opts)) as Show,
  warning: ((title, opts) => show("warning", title, opts)) as Show,
  error: ((title, opts) => show("error", title, opts)) as Show,
  loading: ((title, opts) => show("loading", title, opts)) as Show,
  dismiss,
});

/** Quiet confirmation with Undo, for reversible-but-consequential changes
 *  (archive, a calendar move, a theme reset). Undo runs once. */
export function toastWithUndo(message: string, onUndo: () => void, { duration = 6000 } = {}): string {
  return toast.success(message, { duration, action: { label: "Undo", onClick: onUndo } });
}

export default toast;
