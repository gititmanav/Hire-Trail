/**
 * useDemoGate — gate AI / integration features behind a real account.
 *
 * The demo user (email demo@hiretrail.com) can see all UI surfaces but should be
 * prompted to create a real account when they try to invoke AI-backed features:
 * resume parsing, AI Tailor, email integration, BYOK keys, profile sync, etc.
 *
 * Usage:
 *   const { requireRealAccount } = useDemoGate();
 *   const onClick = () => {
 *     if (!requireRealAccount("AI Tailor")) return; // demo → modal opened, bail
 *     ...do the real work
 *   };
 */
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { UserContext } from "../App.tsx";
import AuthModal, { type AuthMode } from "../components/AuthModal/AuthModal.tsx";

const DEMO_EMAIL = "demo@hiretrail.com";

interface DemoGateApi {
  /** True when the current user is the seeded demo account. */
  isDemo: boolean;
  /**
   * Returns true when the caller may proceed with the feature; false when the
   * caller should bail because the demo upgrade dialog has just been opened.
   * `feature` is shown in the upgrade dialog as contextual copy.
   */
  requireRealAccount: (feature?: string) => boolean;
  /** Force-open the upgrade dialog regardless of an action — for upsell CTAs. */
  openUpgrade: (feature?: string) => void;
}

const DemoGateContext = createContext<DemoGateApi>({
  isDemo: false,
  requireRealAccount: () => true,
  openUpgrade: () => {},
});

export function DemoGateProvider({ children }: { children: ReactNode }) {
  const { user, setUser } = useContext(UserContext);
  const [open, setOpen] = useState(false);
  const [feature, setFeature] = useState<string | null>(null);
  const [mode, setMode] = useState<AuthMode>("register");

  const isDemo = user?.email === DEMO_EMAIL;

  const openUpgrade = useCallback((featureName?: string) => {
    setFeature(featureName ?? null);
    setMode("register");
    setOpen(true);
  }, []);

  const requireRealAccount = useCallback(
    (featureName?: string): boolean => {
      if (!isDemo) return true;
      openUpgrade(featureName);
      return false;
    },
    [isDemo, openUpgrade],
  );

  return (
    <DemoGateContext.Provider value={{ isDemo, requireRealAccount, openUpgrade }}>
      {children}
      <AuthModal
        open={open}
        mode={mode}
        contextHeader={
          feature
            ? `${feature} isn't available in the demo. Create a free account to unlock it.`
            : "Create a free account to unlock AI features."
        }
        onModeChange={setMode}
        onClose={() => setOpen(false)}
        onLogin={(u) => {
          setUser(u);
          setOpen(false);
        }}
      />
    </DemoGateContext.Provider>
  );
}

export function useDemoGate(): DemoGateApi {
  return useContext(DemoGateContext);
}
