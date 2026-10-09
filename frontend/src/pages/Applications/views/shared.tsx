/** Behaviour every list shares (Ledger, Trail, Desk, Board): opening an
 *  application, company logos, keyboard focus + selection, bulk actions. */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import toast, { toastWithUndo } from "../../../components/ui/toast.ts";
import { companiesAPI } from "../../../utils/api.ts";
import { usePageShortcuts } from "../../../hooks/usePageShortcuts.ts";
import { useConfirm } from "../../../hooks/useConfirm.ts";
import { useListDesign } from "../../../hooks/useListDesign.ts";
import ConfirmModal from "../../../components/ConfirmModal/ConfirmModal.tsx";
import BulkActionBar from "../components/BulkActionBar.tsx";
import { applicationHref, rememberDetailNav, saveListScroll, takeListScroll } from "../data/navigation.ts";
import { useApplicationFilters } from "../data/filters.ts";
import { appScrollRoot } from "../../../utils/scrollRoot.ts";
import { useArchiveMutation, useCompanies, useDeleteMutation } from "../data/queries.ts";
import type { Application, Company } from "../../../types";

/* ─── Opening an application ─── */

/** Opens an application, remembering the visible order (J/K on the
 *  application page) and this view's URL + scroll (Back lands exactly where
 *  you were). Desk readers get the Desk with it open instead of a page.
 *  Cmd/Ctrl-click opens a new tab, like a link. */
export function useOpenApplication(orderedIds: string[]) {
  const navigate = useNavigate();
  const location = useLocation();
  const [design] = useListDesign();
  const { filterSearch } = useApplicationFilters();
  const backTo = location.pathname + location.search;
  return useCallback((app: Pick<Application, "_id">, e?: { metaKey?: boolean; ctrlKey?: boolean }) => {
    const href = applicationHref(app._id, design, filterSearch);
    if (e?.metaKey || e?.ctrlKey) {
      window.open(href, "_blank", "noopener");
      return;
    }
    if (design === "desk") { navigate(href); return; }
    rememberDetailNav({ ids: orderedIds, backTo });
    saveListScroll(backTo);
    navigate(href, { state: { fromList: true } });
  }, [navigate, orderedIds, backTo, design, filterSearch]);
}

/** Restore this view's scroll position once its rows are on screen. */
export function useRestoreListScroll(ready: boolean) {
  const location = useLocation();
  useEffect(() => {
    if (!ready) return;
    const y = takeListScroll(location.pathname + location.search);
    if (y != null) requestAnimationFrame(() => appScrollRoot().scrollTo(0, y));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);
}

/* ─── Company logos ─── */

/** Tab-session memory of companies already asked for a logo, so remounts and
 *  view switches never re-spam the endpoint. Cleared by a full reload. */
const LOGO_FETCH_SEEN = new Set<string>();

/** Resolves each application's Company (by id, or by name for legacy apps that
 *  predate companyId) and lazily fetches missing logos in the background. */
export function useCompanyResolver(apps: Application[]) {
  const qc = useQueryClient();
  const { data: companies = [] } = useCompanies();
  const byId = useMemo(() => new Map(companies.map((c) => [c._id, c])), [companies]);
  const byName = useMemo(() => new Map(companies.map((c) => [c.name.toLowerCase(), c])), [companies]);
  const resolve = useCallback((app: Pick<Application, "companyId" | "company">): Company | undefined =>
    (app.companyId ? byId.get(app.companyId) : undefined) ?? byName.get(app.company.toLowerCase()),
  [byId, byName]);

  useEffect(() => {
    for (const a of apps) {
      const c = resolve(a);
      if (!c || c.logoUrl || c.logoFetchedAt || LOGO_FETCH_SEEN.has(c._id)) continue;
      LOGO_FETCH_SEEN.add(c._id);
      void companiesAPI.fetchLogo(c._id).then((res) => {
        if (!res?.logoUrl) return;
        qc.setQueryData<Company[]>(["companies", "all"], (old) =>
          old?.map((p) => (p._id === c._id ? { ...p, logoUrl: res.logoUrl, logoFetchedAt: res.logoFetchedAt ?? null } : p)));
      }).catch(() => undefined);
    }
  }, [apps, resolve, qc]);

  return resolve;
}

/* ─── Focus, selection, bulk actions ─── */

export function useListBehavior({ apps, archived, onOpen, onEdit, extraShortcuts }: {
  apps: Application[];
  archived: boolean;
  onOpen: (app: Application) => void;
  onEdit: (app: Application) => void;
  /** View-specific keys acting on the focused row (Ledger's Space → peek). */
  extraShortcuts?: Record<string, (app: Application) => void>;
}) {
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { confirm, confirmState, handleConfirm, handleCancel } = useConfirm();
  const archive = useArchiveMutation();
  const remove = useDeleteMutation();

  // Keep focus in range and drop selections that left the list.
  useEffect(() => {
    if (focusedIndex >= apps.length) setFocusedIndex(apps.length - 1);
    if (selected.size === 0) return;
    const ids = new Set(apps.map((a) => a._id));
    const next = new Set([...selected].filter((id) => ids.has(id)));
    if (next.size !== selected.size) setSelected(next);
  }, [apps, focusedIndex, selected]);

  const toggle = useCallback((id: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  }), []);
  const clear = useCallback(() => setSelected(new Set()), []);
  const selectAll = useCallback(() => setSelected(new Set(apps.map((a) => a._id))), [apps]);
  /** Pointer and keyboard share one cursor, so J/K carry on from the row under
   *  the pointer. A row the pointer has left stops being current: the
   *  highlight, and what Enter / E / X act on, leave with it. */
  const leaveRow = useCallback((idx: number) => setFocusedIndex((i) => (i === idx ? -1 : i)), []);

  const focusedApp = apps[focusedIndex];
  usePageShortcuts({
    j: () => setFocusedIndex((i) => Math.min(apps.length - 1, i + 1)),
    ArrowDown: () => { if (focusedIndex < 0) return false; setFocusedIndex((i) => Math.min(apps.length - 1, i + 1)); },
    k: () => setFocusedIndex((i) => Math.max(0, i - 1)),
    ArrowUp: () => { if (focusedIndex < 0) return false; setFocusedIndex((i) => Math.max(0, i - 1)); },
    Enter: () => { if (!focusedApp) return false; onOpen(focusedApp); },
    e: () => { if (!focusedApp) return false; onEdit(focusedApp); },
    x: () => { if (!focusedApp) return false; toggle(focusedApp._id); },
    Escape: () => { if (selected.size === 0) return false; clear(); },
    ...Object.fromEntries(Object.entries(extraShortcuts ?? {}).map(([key, fn]) => [key, () => { if (!focusedApp) return false; fn(focusedApp); }])),
  });

  // Keep the keyboard-focused row in view. A group that is animating shut
  // still shows its old rows (inert) — never scroll to one of those.
  useEffect(() => {
    if (focusedIndex < 0) return;
    document.querySelector<HTMLElement>(`[data-row-index="${focusedIndex}"]:not([inert] *)`)?.scrollIntoView({ block: "nearest" });
  }, [focusedIndex]);

  const ids = [...selected];
  const n = ids.length;
  const plural = `${n} application${n === 1 ? "" : "s"}`;

  const bulkArchive = () => {
    const batch = [...ids];
    archive.mutate({ ids: batch, archived: true }, {
      onSuccess: () => toastWithUndo(`Archived ${plural}`, () => archive.mutate({ ids: batch, archived: false })),
    });
    clear();
  };
  const bulkUnarchive = () => {
    const batch = [...ids];
    archive.mutate({ ids: batch, archived: false }, {
      onSuccess: () => toastWithUndo(`Restored ${plural}`, () => archive.mutate({ ids: batch, archived: true })),
    });
    clear();
  };
  const bulkDelete = async () => {
    const ok = await confirm(`Permanently delete ${plural}, with their deadlines and fit checks? This can't be undone.`, { title: "Delete selected?", confirmLabel: "Delete" });
    if (!ok) return;
    remove.mutate(ids, { onSuccess: () => toast.success(`Deleted ${plural}`) });
    clear();
  };

  const overlays = (
    <>
      <BulkActionBar
        count={n}
        total={apps.length}
        archived={archived}
        onSelectAll={selectAll}
        onArchive={bulkArchive}
        onUnarchive={bulkUnarchive}
        onDelete={() => void bulkDelete()}
        onClear={clear}
      />
      {confirmState.open && (
        <ConfirmModal
          title={confirmState.title}
          message={confirmState.message}
          confirmLabel={confirmState.confirmLabel}
          danger={confirmState.danger}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
    </>
  );

  return { focusedIndex, setFocusedIndex, leaveRow, selected, toggle, clear, selectAll, overlays };
}
