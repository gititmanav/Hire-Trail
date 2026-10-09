/** How the List view reads — Ledger, Trail or Desk (Settings → Personalize).
 *  Saved on the user so it follows them across devices; the demo account is
 *  shared by every visitor, so there it stays on the device. Default: Ledger.
 *  Accounts that chose Classic or Table before 2026-10-08 read as Ledger. */
import { useCallback, useContext } from "react";
import { UserContext } from "../App.tsx";
import { authAPI } from "../utils/api.ts";
import { DEFAULT_LIST_DESIGN, isListDesign, normalizeListDesign, type ListDesign } from "../utils/preferences.ts";
import { useDemoGate } from "./useDemoGate.tsx";
import { usePersistentState } from "./usePersistentState.ts";

const DEMO_KEY = "hiretrail-list-design:demo";

export function useListDesign(): [ListDesign, (design: ListDesign) => void] {
  const { user, setUser } = useContext(UserContext);
  const { isDemo } = useDemoGate();
  const [deviceValue, setDeviceValue] = usePersistentState<ListDesign>(DEMO_KEY, DEFAULT_LIST_DESIGN, isListDesign);
  const saved = normalizeListDesign(user?.preferences?.listDesign);

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

  return [isDemo ? deviceValue : saved ?? DEFAULT_LIST_DESIGN, set];
}
