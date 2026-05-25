/**
 * Consolidated state for the Applications page list — search, filter, sort,
 * pagination, archive tab, density, grouping. View prefs (density, grouping)
 * are persisted to localStorage; everything else is session state.
 *
 * Keeping these together prevents the previous "20+ useState calls in one
 * monolithic component" pattern and makes the Applications page itself easier
 * to reason about. All setters are stable (useCallback) so consumers can rely
 * on reference equality for memo deps.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { SortConfig, Stage } from "../types";

export type ArchiveTab = "active" | "archived";
export type Density = "comfortable" | "compact";
export type StageFilter = "All" | Stage;

const DENSITY_KEY = "hiretrail-apps-density";
const GROUPING_KEY = "hiretrail-apps-group-by-company";

function readStored<T extends string>(key: string, fallback: T, allowed: readonly T[]): T {
  if (typeof window === "undefined") return fallback;
  try {
    const v = window.localStorage.getItem(key);
    return v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
  } catch {
    return fallback;
  }
}

function readStoredBool(key: string, fallback: boolean): boolean {
  if (typeof window === "undefined") return fallback;
  try {
    const v = window.localStorage.getItem(key);
    if (v == null) return fallback;
    return v === "1" || v === "true";
  } catch {
    return fallback;
  }
}

export interface ApplicationsListState {
  // Server-driven filters
  search: string;
  setSearch: (v: string) => void;
  debouncedSearch: string;

  archiveTab: ArchiveTab;
  setArchiveTab: (tab: ArchiveTab) => void;

  sort: SortConfig;
  setSort: (next: SortConfig) => void;
  toggleSort: (field: string) => void;

  page: number;
  setPage: (p: number) => void;

  // Client-side view state
  stageFilter: StageFilter;
  setStageFilter: (s: StageFilter) => void;

  density: Density;
  setDensity: (d: Density) => void;

  groupByCompany: boolean;
  setGroupByCompany: (v: boolean) => void;

  selectedIds: Set<string>;
  setSelectedIds: (s: Set<string>) => void;
  toggleSelectedId: (id: string) => void;
  clearSelection: () => void;
}

export function useApplicationsListState(): ApplicationsListState {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [archiveTab, setArchiveTabRaw] = useState<ArchiveTab>("active");
  const [sort, setSort] = useState<SortConfig>({ field: "createdAt", order: "desc" });
  const [page, setPage] = useState(1);
  const [stageFilter, setStageFilter] = useState<StageFilter>("All");
  const [density, setDensityRaw] = useState<Density>(() =>
    readStored<Density>(DENSITY_KEY, "comfortable", ["comfortable", "compact"])
  );
  const [groupByCompany, setGroupByCompanyRaw] = useState<boolean>(() =>
    readStoredBool(GROUPING_KEY, false)
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Debounce search; reset to page 1 when it changes.
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]);

  // Persist density + grouping.
  useEffect(() => {
    try { window.localStorage.setItem(DENSITY_KEY, density); } catch { /* ignore */ }
  }, [density]);
  useEffect(() => {
    try { window.localStorage.setItem(GROUPING_KEY, groupByCompany ? "1" : "0"); } catch { /* ignore */ }
  }, [groupByCompany]);

  const setArchiveTab = useCallback((tab: ArchiveTab) => {
    setArchiveTabRaw(tab);
    setPage(1);
    setStageFilter("All");
    setSelectedIds(new Set());
  }, []);

  const setDensity = useCallback((d: Density) => setDensityRaw(d), []);
  const setGroupByCompany = useCallback((v: boolean) => setGroupByCompanyRaw(v), []);

  const toggleSort = useCallback((field: string) => {
    setSort((s) => ({ field, order: s.field === field && s.order === "desc" ? "asc" : "desc" }));
    setPage(1);
  }, []);

  const toggleSelectedId = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  return {
    search, setSearch, debouncedSearch,
    archiveTab, setArchiveTab,
    sort, setSort, toggleSort,
    page, setPage,
    stageFilter, setStageFilter,
    density, setDensity,
    groupByCompany, setGroupByCompany,
    selectedIds, setSelectedIds, toggleSelectedId, clearSelection,
  };
}
