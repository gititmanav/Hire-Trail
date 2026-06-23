/**
 * AIKeyNudges — orchestrates the no-active-key nudges (Task B), app-wide.
 *
 * Flow (each step is one-time, remembered in localStorage):
 *   1. After the first-run tour, if there's no active key → the BYOK onboarding
 *      modal (carousel).
 *   2. Once that's been seen, if there's still no active key → a closeable
 *      warning banner, shown once.
 *   3. After that, the persistent header badge (red wrench) is the only reminder.
 *
 * Everything suppresses the instant a key becomes active (hasActiveKey flips).
 * The persistent header badge itself lives in Header.tsx (also useAIKeyStatus).
 */
import { useEffect, useState, useContext } from "react";
import { Link } from "react-router-dom";
import { Wrench, X } from "lucide-react";
import { UserContext } from "../../App.tsx";
import { useAIKeyStatus } from "../../hooks/useAIKeyStatus.tsx";
import ByokOnboardingModal from "./ByokOnboardingModal.tsx";

const ONBOARDED_KEY = "hiretrail-byok-onboarded";
const WARNING_KEY = "hiretrail-byok-warning-dismissed";

const lsGet = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } };

export default function AIKeyNudges() {
  const { user } = useContext(UserContext);
  const { hasActiveKey, ready } = useAIKeyStatus();

  const [onboarded, setOnboarded] = useState(() => lsGet(ONBOARDED_KEY) === "1");
  const [warningDismissed, setWarningDismissed] = useState(() => lsGet(WARNING_KEY) === "1");

  // The onboarding modal waits for the tour to finish (tourCompleted) so it
  // genuinely lands "after the existing onboarding steps".
  const showModal = !!user && ready && !hasActiveKey && user.tourCompleted === true && !onboarded;
  const showBanner = !!user && ready && !hasActiveKey && onboarded && !warningDismissed;

  // If a key becomes active, retire the nudges silently (no need to ever show again).
  useEffect(() => {
    if (hasActiveKey) {
      if (!onboarded) { lsSet(ONBOARDED_KEY, "1"); setOnboarded(true); }
      if (!warningDismissed) { lsSet(WARNING_KEY, "1"); setWarningDismissed(true); }
    }
  }, [hasActiveKey, onboarded, warningDismissed]);

  const closeModal = () => { lsSet(ONBOARDED_KEY, "1"); setOnboarded(true); };
  const dismissWarning = () => { lsSet(WARNING_KEY, "1"); setWarningDismissed(true); };

  return (
    <>
      {showModal && <ByokOnboardingModal onClose={closeModal} />}
      {showBanner && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[70] w-[min(560px,calc(100vw-2rem))] animate-in">
          <div className="flex items-start gap-3 rounded-xl border border-amber-300/70 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/40 shadow-lg px-4 py-3">
            <span className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0">
              <Wrench size={16} strokeWidth={1.8} className="text-amber-600 dark:text-amber-400" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">No AI key connected</p>
              <p className="text-xs text-amber-900/80 dark:text-amber-200/80 mt-0.5 leading-relaxed">
                AI features are running on the limited shared provider. Add a free key to unlock full speed.{" "}
                <Link to="/settings/ai" onClick={dismissWarning} className="font-semibold underline underline-offset-2 hover:opacity-80">
                  Add a key
                </Link>
              </p>
            </div>
            <button onClick={dismissWarning} className="w-7 h-7 flex items-center justify-center rounded-lg text-amber-700/70 dark:text-amber-300/70 hover:bg-amber-500/15 shrink-0" aria-label="Dismiss">
              <X size={15} strokeWidth={2} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
