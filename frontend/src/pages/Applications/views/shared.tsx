/** Behaviour shared by both list designs (Classic cards, full-width table):
 *  opening a row, company logos, keyboard focus + selection, bulk actions. */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { companiesAPI } from "../../../utils/api.ts";
import { usePageShortcuts } from "../../../hooks/usePageShortcuts.ts";
import { useConfirm } from "../../../hooks/useConfirm.ts";
import ConfirmModal from "../../../components/ConfirmModal/ConfirmModal.tsx";
import BulkActionBar from "../components/BulkActionBar.tsx";
import { rememberDetailNav, saveListScroll, takeListScroll } from "../data/navigation.ts";
import { useArchiveMutation, useCompanies, useDeleteMutation } from "../data/queries.ts";
import type { Application, Company } from "../../../types";

/* ─── Opening an application ─── */

/** Opens /applications/:id, remembering the visible order (J/K on the detail
 *  page) and this view's URL + scroll (Back lands exactly where you were).
 *  Cmd/Ctrl-click opens a new tab, like a link. */
export function useOpenApplication(orderedIds: string[]) {
  const navigate = useNavigate();
  const location = useLocation();
  const backTo = location.pathname + location.search;
  return useCallback((app: Application, e?: { metaKey?: boolean; ctrlKey?: boolean }) => {
    if (e?.metaKey || e?.ctrlKey) {
      window.open(`/applications/${app._id}`, "_blank", "noopener");
      return;
    }
    rememberDetailNav({ ids: orderedIds, backTo });
    saveListScroll(backTo);
    navigate(`/applications/${app._id}`, { state: { fromList: true } });
  }, [navigate, orderedIds, backTo]);
}

/** Restore this view's scroll position once its rows are on screen. */
export function useRestoreListScroll(ready: boolean) {
  const location = useLocation();
  useEffect(() => {
    if (!ready) return;
    const y = takeListScroll(location.pathname + location.search);
    if (y != null) requestAnimationFrame(() => window.scrollTo(0, y));
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
  const resolve = useCallback((app: Application): Company | undefined =>
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

export function useListBehavior({ apps, archived, onOpen, onEdit }: {
  apps: Application[];
  archived: boolean;
  onOpen: (app: Application) => void;
  onEdit: (app: Application) => void;
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

  usePageShortcuts({
    j: () => setFocusedIndex((i) => Math.min(apps.length - 1, i + 1)),
    ArrowDown: () => { if (focusedIndex < 0) return false; setFocusedIndex((i) => Math.min(apps.length - 1, i + 1)); },
    k: () => setFocusedIndex((i) => Math.max(0, i - 1)),
    ArrowUp: () => { if (focusedIndex < 0) return false; setFocusedIndex((i) => Math.max(0, i - 1)); },
    Enter: () => { const a = apps[focusedIndex]; if (!a) return false; onOpen(a); },
    e: () => { const a = apps[focusedIndex]; if (!a) return false; onEdit(a); },
    x: () => { const a = apps[focusedIndex]; if (!a) return false; toggle(a._id); },
    Escape: () => { if (selected.size === 0) return false; clear(); },
  });

  // Keep the keyboard-focused row in view.
  useEffect(() => {
    if (focusedIndex < 0) return;
    document.querySelector<HTMLElement>(`[data-row-index="${focusedIndex}"]`)?.scrollIntoView({ block: "nearest" });
  }, [focusedIndex]);

  const ids = [...selected];
  const n = ids.length;
  const plural = `${n} application${n === 1 ? "" : "s"}`;

  const bulkArchive = async () => {
    const ok = await confirm(`Archive ${plural}? You can restore them from Archived anytime.`, { title: "Archive selected?", confirmLabel: "Archive", danger: false });
    if (!ok) return;
    archive.mutate({ ids, archived: true }, { onSuccess: () => toast.success(`Archived ${plural}`) });
    clear();
  };
  const bulkUnarchive = () => {
    archive.mutate({ ids, archived: false }, { onSuccess: () => toast.success(`Restored ${plural}`) });
    clear();
  };
  const bulkDelete = async () => {
    const ok = await confirm(`Permanently delete ${plural}? This can't be undone.`, { title: "Delete selected?", confirmLabel: "Delete" });
    if (!ok) return;
    remove.mutate(ids, { onSuccess: () => toast.success(`Deleted ${plural}`) });
    clear();
  };
  const deleteOne = async (app: Application) => {
    const ok = await confirm("This application will be permanently deleted.", { title: `Delete ${app.role}?`, confirmLabel: "Delete" });
    if (!ok) return;
    remove.mutate([app._id], { onSuccess: () => toast.success("Application deleted") });
  };

  const overlays = (
    <>
      {n > 0 && (
        <BulkActionBar count={n} archived={archived} onArchive={bulkArchive} onUnarchive={bulkUnarchive} onDelete={bulkDelete} onClear={clear} />
      )}
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

  return { focusedIndex, setFocusedIndex, selected, toggle, clear, deleteOne, overlays };
}
