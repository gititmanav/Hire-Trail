import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { settingsAPI } from "../utils/api.ts";

interface FeatureFlagsCtx {
  flags: Record<string, boolean>;
  loading: boolean;
  isEnabled: (key: string) => boolean;
  refresh: () => void;
}

const FeatureFlagsContext = createContext<FeatureFlagsCtx>({
  flags: {},
  loading: true,
  isEnabled: () => false,
  refresh: () => {},
});

export function FeatureFlagsProvider({ children, authenticated }: { children: ReactNode; authenticated: boolean }) {
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!authenticated) { setLoading(false); return; }
    try {
      const { flags: f } = await settingsAPI.getFeatureFlags();
      setFlags(f);
    } catch {
      // If fetch fails, default all to true (don't block features)
      setFlags({});
    } finally {
      setLoading(false);
    }
  }, [authenticated]);

  useEffect(() => { load(); }, [load]);

  const isEnabled = useCallback(
    (key: string) => {
      if (loading) return false;
      // If flag is not in the map, default to enabled
      return flags[key] !== false;
    },
    [flags, loading]
  );

  return (
    <FeatureFlagsContext.Provider value={{ flags, loading, isEnabled, refresh: load }}>
      {children}
    </FeatureFlagsContext.Provider>
  );
}

export function useFeatureFlags() {
  return useContext(FeatureFlagsContext);
}
