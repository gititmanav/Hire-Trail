/** The Applications list style — Classic cards or the full-width Table
 *  (Settings → Personalize). Saved on the user so it follows them across
 *  devices; the demo account is shared by every visitor, so there it stays
 *  on the device. Default: Classic. */
import { useCallback, useContext, useEffect } from "react";
import { UserContext } from "../App.tsx";
import { authAPI } from "../utils/api.ts";
import { DEFAULT_LIST_DESIGN, isListDesign, type ListDesign } from "../utils/preferences.ts";
import { useDemoGate } from "./useDemoGate.tsx";
import { usePersistentState } from "./usePersistentState.ts";

/** Where the old dev-only header toggle kept the choice (this browser only). */
const LEGACY_KEY = "hiretrail-apps-list-design";
const DEMO_KEY = "hiretrail-list-design:demo";

function readLegacy(): ListDesign | null {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (raw == null) return null;
    let v: unknown = raw; // stored JSON-encoded, or as a bare string before that
    try { v = JSON.parse(raw); } catch { /* bare string */ }
    return isListDesign(v) ? v : null;
  } catch {
    return null;
  }
}

export function useListDesign(): [ListDesign, (design: ListDesign) => void] {
  const { user, setUser } = useContext(UserContext);
  const { isDemo } = useDemoGate();
  const [deviceValue, setDeviceValue] = usePersistentState<ListDesign>(DEMO_KEY, DEFAULT_LIST_DESIGN, isListDesign);
  const saved = user?.preferences?.listDesign;

  const set = useCallback((design: ListDesign) => {
    if (!user) return;
    if (isDemo) { setDeviceValue(design); return; }
    const previous = user.preferences?.listDesign;
    const withDesign = (d: ListDesign | undefined) =>
      setUser((u) => u && { ...u, preferences: { ...u.preferences, listDesign: d } });
    // Only this field is touched (a theme save may be in flight). A failed
    // save rolls it back; the API interceptor shows the error toast.
    withDesign(design);
    authAPI.updatePreferences({ listDesign: design }).catch(() => withDesign(previous));
  }, [user, isDemo, setUser, setDeviceValue]);

  // One-time: adopt what the old dev toggle stored on this browser, then
  // forget it — the account is the source of truth from here on.
  useEffect(() => {
    if (!user || isDemo || saved) return;
    const legacy = readLegacy();
    try { localStorage.removeItem(LEGACY_KEY); } catch { /* ignore */ }
    if (legacy && legacy !== DEFAULT_LIST_DESIGN) set(legacy);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id, isDemo, saved]);

  return [isDemo ? deviceValue : saved ?? DEFAULT_LIST_DESIGN, set];
}
