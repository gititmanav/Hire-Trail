/**
 * useAIKeyStatus — one source of truth for "does the user have an active AI key".
 *
 * Consumed by:
 *   - the header warning badge (red wrench) + the one-time no-key warning (Task B)
 *   - the BYOK onboarding modal gating (Task B)
 *   - the AI Settings page status/usage cards (Task A)
 *
 * Keys are fetched via the real /ai/keys endpoint (already live). The provider
 * is mounted once under UserContext so every surface shares the same answer and
 * a single refresh() re-syncs them all after a key is added/activated/removed.
 */
import {
  createContext, useCallback, useContext, useEffect, useState, type ReactNode,
} from "react";
import { UserContext } from "../App.tsx";
import { aiAPI } from "../utils/api.ts";
import type { AIKey } from "../utils/api.ts";

interface AIKeyStatusApi {
  keys: AIKey[];
  activeKey: AIKey | null;
  hasActiveKey: boolean;
  loading: boolean;
  /** True until the first fetch settles — callers use it to avoid flashing the
   *  "no key" warning before we actually know. */
  ready: boolean;
  refresh: () => Promise<void>;
}

const AIKeyStatusContext = createContext<AIKeyStatusApi>({
  keys: [],
  activeKey: null,
  hasActiveKey: false,
  loading: false,
  ready: false,
  refresh: async () => {},
});

export function AIKeyStatusProvider({ children }: { children: ReactNode }) {
  const { user } = useContext(UserContext);
  const [keys, setKeys] = useState<AIKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) { setKeys([]); setReady(true); return; }
    setLoading(true);
    try {
      setKeys(await aiAPI.listKeys());
    } catch {
      // 401 / network — treat as "no keys"; don't toast (interceptor handles real errors).
      setKeys([]);
    } finally {
      setLoading(false);
      setReady(true);
    }
  }, [user]);

  useEffect(() => { void refresh(); }, [refresh]);

  const activeKey = keys.find((k) => k.isActive) ?? null;

  return (
    <AIKeyStatusContext.Provider
      value={{ keys, activeKey, hasActiveKey: !!activeKey, loading, ready, refresh }}
    >
      {children}
    </AIKeyStatusContext.Provider>
  );
}

export function useAIKeyStatus(): AIKeyStatusApi {
  return useContext(AIKeyStatusContext);
}
