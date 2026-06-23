/**
 * Shared announcement state for the app shell.
 *
 * Fetches the signed-in user's active announcements once, and tracks which the
 * user has dismissed (persisted in localStorage by id). Both the banner and the
 * header megaphone consume this so they stay in sync:
 *   - banner shows announcements that are active AND not dismissed
 *   - megaphone appears only when there's an active announcement, and re-opens
 *     dismissed ones
 *
 * `useAnnouncements` is null-safe (returns an inert default outside the provider)
 * so the Header never crashes if rendered in a shell without the provider.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { announcementsAPI } from "../../utils/api.ts";
import type { Announcement } from "../../types";

const DISMISSED_KEY = "hiretrail-dismissed-announcements";

interface AnnouncementsCtx {
  /** All currently-active announcements. */
  items: Announcement[];
  /** Active announcements the user hasn't dismissed (what the banner renders). */
  visible: Announcement[];
  /** True when at least one active announcement exists (drives the header icon). */
  hasAnnouncements: boolean;
  dismiss: (id: string) => void;
  /** Un-dismiss every current announcement (re-shows the banner). */
  reopenAll: () => void;
}

const noop = () => {};
const DEFAULT_CTX: AnnouncementsCtx = {
  items: [], visible: [], hasAnnouncements: false, dismiss: noop, reopenAll: noop,
};

const Context = createContext<AnnouncementsCtx | null>(null);

export function useAnnouncements(): AnnouncementsCtx {
  return useContext(Context) ?? DEFAULT_CTX;
}

function loadDismissed(): Set<string> {
  try {
    const raw = JSON.parse(localStorage.getItem(DISMISSED_KEY) || "[]");
    return new Set(Array.isArray(raw) ? raw : []);
  } catch {
    return new Set();
  }
}

function persistDismissed(s: Set<string>): void {
  try { localStorage.setItem(DISMISSED_KEY, JSON.stringify([...s])); } catch { /* ignore */ }
}

export function AnnouncementsProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Announcement[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(loadDismissed);

  useEffect(() => {
    let alive = true;
    announcementsAPI
      .getActive()
      .then((list) => { if (alive) setItems(Array.isArray(list) ? list : []); })
      .catch(() => { /* never block the app shell on this */ });
    return () => { alive = false; };
  }, []);

  const dismiss = useCallback((id: string) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      persistDismissed(next);
      return next;
    });
  }, []);

  const reopenAll = useCallback(() => {
    setDismissed((prev) => {
      const next = new Set(prev);
      for (const a of items) next.delete(a._id);
      persistDismissed(next);
      return next;
    });
  }, [items]);

  const visible = useMemo(() => items.filter((a) => !dismissed.has(a._id)), [items, dismissed]);

  const value = useMemo<AnnouncementsCtx>(
    () => ({ items, visible, hasAnnouncements: items.length > 0, dismiss, reopenAll }),
    [items, visible, dismiss, reopenAll],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}
