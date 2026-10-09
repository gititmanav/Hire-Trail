/** The header search's quick links: saved on the account so they follow the
 *  person — the app's bar in `preferences.quickLinks`, Admin's in
 *  `preferences.adminQuickLinks` (the demo account is shared by every visitor,
 *  so its app links stay on the device). Unset = the defaults; an empty list
 *  is a choice. A link to a page behind a switched-off feature isn't shown
 *  (or kept by the next edit). */
import { useCallback, useContext, useMemo } from "react";

import { UserContext } from "../../App.tsx";
import { authAPI } from "../../utils/api.ts";
import { useDemoGate } from "../../hooks/useDemoGate.tsx";
import { usePersistentState } from "../../hooks/usePersistentState.ts";
import { useFeatureFlags } from "../../hooks/useFeatureFlags.tsx";
import {
  DEFAULT_ADMIN_QUICK_LINKS, DEFAULT_QUICK_LINKS, normalizeAdminQuickLinks, normalizeQuickLinks,
  type Preferences, type QuickLinkId,
} from "../../utils/preferences.ts";
import { QUICK_LINKS } from "./quickLinks.ts";
import type { SavedLinks } from "./scope.ts";

const DEMO_KEY = "hiretrail-quick-links:demo";
const DEFAULTS: QuickLinkId[] = [...DEFAULT_QUICK_LINKS];
const isLinkList = (v: unknown): v is QuickLinkId[] => Array.isArray(v) && normalizeQuickLinks(v)!.length === v.length;

/** Saves one list on the account. Only that field is touched; a failed save
 *  rolls back (the API layer says why). */
function useAccountLinkSaver(field: "quickLinks" | "adminQuickLinks", normalize: (v: unknown) => string[] | undefined) {
  const { user, setUser } = useContext(UserContext);
  return useCallback((next: string[]) => {
    if (!user) return;
    const clean = normalize(next) ?? [];
    const previous = user.preferences?.[field];
    const withLinks = (v: string[] | undefined) =>
      setUser((u) => u && { ...u, preferences: { ...u.preferences, [field]: v } as Preferences });
    withLinks(clean);
    authAPI.updatePreferences({ [field]: clean } as Partial<Preferences>).catch(() => withLinks(previous));
  }, [user, setUser, field, normalize]);
}

export function useQuickLinks(): SavedLinks {
  const { user } = useContext(UserContext);
  const { isDemo } = useDemoGate();
  const { isEnabled } = useFeatureFlags();
  const [deviceLinks, setDeviceLinks] = usePersistentState<QuickLinkId[]>(DEMO_KEY, DEFAULTS, isLinkList);
  const saveToAccount = useAccountLinkSaver("quickLinks", normalizeQuickLinks);

  const stored = isDemo ? deviceLinks : user?.preferences?.quickLinks ?? DEFAULTS;
  const available = useCallback((id: string) => {
    const flag = QUICK_LINKS.find((l) => l.id === id)?.flag;
    return !flag || isEnabled(flag);
  }, [isEnabled]);
  const links = useMemo(() => stored.filter(available), [stored, available]);

  const setLinks = useCallback((next: string[]) => {
    if (isDemo) setDeviceLinks(normalizeQuickLinks(next) ?? []);
    else saveToAccount(next);
  }, [isDemo, setDeviceLinks, saveToAccount]);

  return { links, available, setLinks };
}

const always = () => true;

export function useAdminQuickLinks(): SavedLinks {
  const { user } = useContext(UserContext);
  const setLinks = useAccountLinkSaver("adminQuickLinks", normalizeAdminQuickLinks);
  const links = user?.preferences?.adminQuickLinks ?? DEFAULT_ADMIN_QUICK_LINKS;
  return { links: links as string[], available: always, setLinks };
}
