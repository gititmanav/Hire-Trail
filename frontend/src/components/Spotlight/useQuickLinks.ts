/** The header search's quick links: saved on the account so they follow the
 *  person (the demo account is shared by every visitor, so there they stay
 *  on the device). Unset = the defaults; an empty list is a choice. A link to a
 *  page behind a switched-off feature isn't shown (or kept by the next edit). */
import { useCallback, useContext, useMemo } from "react";

import { UserContext } from "../../App.tsx";
import { authAPI } from "../../utils/api.ts";
import { useDemoGate } from "../../hooks/useDemoGate.tsx";
import { usePersistentState } from "../../hooks/usePersistentState.ts";
import { useFeatureFlags } from "../../hooks/useFeatureFlags.tsx";
import { DEFAULT_QUICK_LINKS, normalizeQuickLinks, type QuickLinkId } from "../../utils/preferences.ts";
import { quickLink } from "./quickLinks.ts";

const DEMO_KEY = "hiretrail-quick-links:demo";
const DEFAULTS: QuickLinkId[] = [...DEFAULT_QUICK_LINKS];
const isLinkList = (v: unknown): v is QuickLinkId[] => Array.isArray(v) && normalizeQuickLinks(v)!.length === v.length;

export function useQuickLinks(): { links: QuickLinkId[]; available: (id: QuickLinkId) => boolean; setLinks: (next: QuickLinkId[]) => void } {
  const { user, setUser } = useContext(UserContext);
  const { isDemo } = useDemoGate();
  const { isEnabled } = useFeatureFlags();
  const [deviceLinks, setDeviceLinks] = usePersistentState<QuickLinkId[]>(DEMO_KEY, DEFAULTS, isLinkList);

  const stored = isDemo ? deviceLinks : user?.preferences?.quickLinks ?? DEFAULTS;
  const available = useCallback((id: QuickLinkId) => {
    const flag = quickLink(id).flag;
    return !flag || isEnabled(flag);
  }, [isEnabled]);
  const links = useMemo(() => stored.filter(available), [stored, available]);

  const setLinks = useCallback((next: QuickLinkId[]) => {
    if (!user) return;
    const clean = normalizeQuickLinks(next) ?? [];
    if (isDemo) { setDeviceLinks(clean); return; }
    const previous = user.preferences?.quickLinks;
    const withLinks = (v: QuickLinkId[] | undefined) =>
      setUser((u) => u && { ...u, preferences: { ...u.preferences, quickLinks: v } });
    // Only this field is touched; a failed save rolls back (the API layer says why).
    withLinks(clean);
    authAPI.updatePreferences({ quickLinks: clean }).catch(() => withLinks(previous));
  }, [user, isDemo, setUser, setDeviceLinks]);

  return { links, available, setLinks };
}
