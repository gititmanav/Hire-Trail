/** Applications filters, stored in the URL query string.
 *
 *  The URL is the single source of truth: List, Board and Calendar all read the
 *  same params, so switching views keeps your filters, reloads keep them, back
 *  returns to them, and a filtered view is linkable. The dashboard funnel's old
 *  `?stage=Interview` deep link is simply the stage filter.
 *
 *    q        search text (company / role)
 *    status   "archived" — absent means active
 *    stage    one Stage
 *    company  exact company name
 *    resume   resume id, or "none"
 *    source   manual | extension | email
 *    page     classic list pagination only
 */
import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { STAGES } from "../../../utils/stageStyles.ts";
import type { ApplicationListParams } from "../../../utils/api.ts";
import type { Stage } from "../../../types";

export type AppStatus = "active" | "archived";

export interface ApplicationFilters {
  q: string;
  status: AppStatus;
  stage: Stage | "";
  company: string;
  resume: string;
  source: string;
}

const SOURCES = ["manual", "extension", "email"];

export function parseFilters(params: URLSearchParams): ApplicationFilters {
  const stage = params.get("stage") ?? "";
  const source = params.get("source") ?? "";
  return {
    q: params.get("q") ?? "",
    status: params.get("status") === "archived" ? "archived" : "active",
    stage: (STAGES as string[]).includes(stage) ? (stage as Stage) : "",
    company: params.get("company") ?? "",
    resume: params.get("resume") ?? "",
    source: SOURCES.includes(source) ? source : "",
  };
}

/** Server params for a filter set. `withStage: false` for surfaces that show
 *  every stage at once (Board columns, the grouped table). */
export function toListParams(f: ApplicationFilters, { withStage = true } = {}): ApplicationListParams {
  return {
    search: f.q.trim() || undefined,
    archived: f.status === "archived" ? "true" : "false",
    stage: withStage && f.stage ? f.stage : undefined,
    company: f.company || undefined,
    resumeId: f.resume || undefined,
    source: f.source || undefined,
    fields: "summary",
  };
}

/** Filters that narrow the set (search and status excluded — they have their
 *  own always-visible controls). Drives the Filters button badge. */
export function activeFilterCount(f: ApplicationFilters): number {
  return [f.stage, f.company, f.resume, f.source].filter(Boolean).length;
}

const FILTER_KEYS: (keyof ApplicationFilters)[] = ["q", "status", "stage", "company", "resume", "source"];

export function useApplicationFilters() {
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => parseFilters(params), [params]);
  const page = Math.max(1, Number(params.get("page")) || 1);

  /** Patch filters. Empty values are removed from the URL; any filter change
   *  resets pagination. `replace` keeps typing/filtering out of history. */
  const setFilters = useCallback((patch: Partial<ApplicationFilters>) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [k, v] of Object.entries(patch)) {
        const empty = v === "" || v == null || (k === "status" && v === "active");
        if (empty) next.delete(k); else next.set(k, String(v));
      }
      next.delete("page");
      return next;
    }, { replace: true });
  }, [setParams]);

  const setPage = useCallback((p: number) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (p <= 1) next.delete("page"); else next.set("page", String(p));
      return next;
    });
  }, [setParams]);

  /** Clear the narrowing filters; keeps search and the Active/Archived choice. */
  const resetFilters = useCallback(() => {
    setFilters({ stage: "", company: "", resume: "", source: "" });
  }, [setFilters]);

  /** The filter portion of the query string (drops one-shot action params),
   *  for carrying filters across view switches and back to the list. */
  const filterSearch = useMemo(() => {
    const next = new URLSearchParams();
    for (const k of FILTER_KEYS) {
      const v = params.get(k);
      if (v) next.set(k, v);
    }
    const s = next.toString();
    return s ? `?${s}` : "";
  }, [params]);

  return { filters, page, setFilters, setPage, resetFilters, filterSearch };
}
