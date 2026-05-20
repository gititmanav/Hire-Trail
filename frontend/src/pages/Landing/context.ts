import { createContext, useContext } from "react";
import type { AuthMode } from "../../components/AuthModal/AuthModal.tsx";

export const DEMO_EMAIL = "demo@hiretrail.com";
export const DEMO_PASSWORD = "password123";

/** Lets any nested section open the auth modal in the requested mode, or
 *  one-click sign in as the demo user. */
export interface LandingAuthApi {
  openAuth: (mode: AuthMode) => void;
  loginDemo: () => void;
  demoLoading: boolean;
}

export const LandingAuthCtx = createContext<LandingAuthApi>({
  openAuth: () => {},
  loginDemo: () => {},
  demoLoading: false,
});

export const useOpenAuth = () => useContext(LandingAuthCtx).openAuth;

export const useDemoLogin = () => {
  const { loginDemo, demoLoading } = useContext(LandingAuthCtx);
  return { loginDemo, demoLoading };
};
