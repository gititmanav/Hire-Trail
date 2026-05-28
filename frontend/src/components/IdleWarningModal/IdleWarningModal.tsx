/**
 * Soft idle warning. After 60 minutes of no user activity we open a
 * non-blocking modal asking the user to confirm they're still there.
 * Continue closes the dialog and resets the timer; Sign out logs them
 * out. The session itself stays valid until the server-side TTL (24h),
 * so dismissing the modal silently has no security cost beyond what the
 * server already enforces.
 *
 * Activity = mousemove / keydown / scroll / tap / tab regaining focus.
 * Heavy events (mousemove) are coalesced via a single timestamp.
 */
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { UserContext } from "../../App.tsx";
import { authAPI } from "../../utils/api.ts";

const IDLE_MS = 60 * 60 * 1000; // 60 minutes
/** Resets the timer no more than once per second even if mousemove is spamming. */
const COALESCE_MS = 1000;

export default function IdleWarningModal() {
  const { user, setUser } = useContext(UserContext);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const lastActivityRef = useRef(Date.now());
  const timerRef = useRef<number | null>(null);

  const bumpActivity = useCallback(() => {
    const now = Date.now();
    if (now - lastActivityRef.current < COALESCE_MS) return;
    lastActivityRef.current = now;
  }, []);

  // Periodic check — every 30s ask: "have we been idle for IDLE_MS?". The check
  // itself is cheap, the activity tracker is the hot path and it stays cheap
  // thanks to the coalesce window.
  useEffect(() => {
    if (!user) return;
    const tick = () => {
      const idleFor = Date.now() - lastActivityRef.current;
      if (idleFor >= IDLE_MS) setOpen(true);
    };
    timerRef.current = window.setInterval(tick, 30 * 1000);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [user]);

  // Activity listeners. Re-registered if `user` flips (sign-out clears them).
  useEffect(() => {
    if (!user) return;
    const events: (keyof WindowEventMap)[] = ["mousemove", "keydown", "scroll", "click", "touchstart", "focus"];
    events.forEach((ev) => window.addEventListener(ev, bumpActivity, { passive: true }));
    return () => {
      events.forEach((ev) => window.removeEventListener(ev, bumpActivity));
    };
  }, [user, bumpActivity]);

  if (!user || !open) return null;

  const onContinue = () => {
    lastActivityRef.current = Date.now();
    setOpen(false);
  };

  const onSignOut = async () => {
    try { await authAPI.logout(); } catch { /* still clear local state */ }
    setUser(null);
    setOpen(false);
    navigate("/");
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="idle-warning-title"
      onClick={onContinue}
    >
      <div
        className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-2xl animate-in p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 flex items-center justify-center mb-3">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </div>
        <h2 id="idle-warning-title" className="text-lg font-semibold text-foreground">Still there?</h2>
        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
          You&rsquo;ve been idle for an hour. Choose to continue, or sign out to be safe.
        </p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onSignOut}
            className="px-4 py-2 text-sm font-medium border border-border rounded-lg text-secondary-foreground hover:bg-muted"
          >
            Sign out
          </button>
          <button
            type="button"
            onClick={onContinue}
            autoFocus
            className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg"
          >
            I&rsquo;m here
          </button>
        </div>
      </div>
    </div>
  );
}
