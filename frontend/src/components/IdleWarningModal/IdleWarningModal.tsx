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
import { Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { UserContext } from "../../App.tsx";
import { authAPI } from "../../utils/api.ts";
import { Modal, ModalHeader } from "../ui/Modal.tsx";
import Button from "../ui/Button.tsx";

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

  // Dismissing it any way (outside click, Escape) counts as "I'm here".
  return (
    <Modal onClose={onContinue} size="sm">
      <ModalHeader
        title="Still there?"
        description={<>You&rsquo;ve been idle for an hour. Choose to continue, or sign out to be safe.</>}
        icon={
          <span className="w-9 h-9 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 flex items-center justify-center">
            <Clock size={17} strokeWidth={1.8} aria-hidden="true" />
          </span>
        }
      />
      <div className="px-6 pb-5 flex flex-wrap justify-end gap-2">
        <Button onClick={onSignOut}>Sign out</Button>
        <Button variant="primary" onClick={onContinue} data-autofocus>I&rsquo;m here</Button>
      </div>
    </Modal>
  );
}
