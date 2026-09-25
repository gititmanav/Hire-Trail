/** Classic list — the card-row design, 1200px column, paginated. Kept alongside
 *  the full-width table while the owner compares the two (design toggle in the
 *  header); rows now open the application page instead of a sidebar. */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { masterProfileAPI } from "../../../utils/api.ts";
import ResumePreview from "../../../components/ResumePreview/ResumePreview.tsx";
import ApplicationRow from "../components/ApplicationRow.tsx";
import CompanyGroupHeader from "../components/CompanyGroupHeader.tsx";
import Collapse from "../../../components/ui/Collapse.tsx";
import EmptyState from "../components/EmptyState.tsx";
import SkeletonRows from "../components/SkeletonRows.tsx";
import { useApplicationsShell } from "../ApplicationsLayout.tsx";
import { useApplicationFilters, toListParams, activeFilterCount } from "../data/filters.ts";
import { useApplicationsPage, useContacts, useReanalyzeMutation, useResumes, useUpcomingDeadlines } from "../data/queries.ts";
import { useCompanyResolver, useListBehavior, useOpenApplication, useRestoreListScroll } from "./shared.tsx";
import type { Application, Pagination, Resume } from "../../../types";

function PaginationBar({ page, pag, setPage }: { page: number; pag: Pagination; setPage: (p: number) => void }) {
  if (pag.pages <= 1) return null;
  const btn = "h-8 px-3 text-[13px] border border-border rounded-lg text-secondary-foreground hover:bg-muted disabled:opacity-30 disabled:pointer-events-none";
  return (
    <div className="flex items-center justify-between mt-4">
      <span className="text-[13px] text-muted-foreground tabular-nums">
        {(pag.page - 1) * pag.limit + 1}–{Math.min(pag.page * pag.limit, pag.total)} of {pag.total}
      </span>
      <div className="flex gap-1">
        <button disabled={page <= 1} onClick={() => setPage(page - 1)} className={btn}>Previous</button>
        {Array.from({ length: Math.min(pag.pages, 5) }, (_, i) => {
          const p = pag.pages <= 5 ? i + 1 : page <= 3 ? i + 1 : page >= pag.pages - 2 ? pag.pages - 4 + i : page - 2 + i;
          return (
            <button key={p} onClick={() => setPage(p)} aria-current={p === page ? "page" : undefined}
              className={`w-8 h-8 text-[13px] rounded-lg tabular-nums ${p === page ? "bg-primary text-primary-foreground" : "border border-border text-secondary-foreground hover:bg-muted"}`}>
              {p}
            </button>
          );
        })}
        <button disabled={page >= pag.pages} onClick={() => setPage(page + 1)} className={btn}>Next</button>
      </div>
    </div>
  );
}

export default function ClassicList() {
  const shell = useApplicationsShell();
  const { filters, page, setFilters, setPage } = useApplicationFilters();
  const params = useMemo(() => toListParams(filters), [filters]);
  const { data, isPending } = useApplicationsPage(params, page);
  const { data: resumes = [] } = useResumes();
  const { data: contacts = [] } = useContacts();
  const { data: deadlines = [] } = useUpcomingDeadlines();
  const { data: hasMasterProfile = false } = useQuery({ queryKey: ["master-profile", "exists"], queryFn: async () => !!(await masterProfileAPI.get()), staleTime: 5 * 60_000 });
  const reanalyze = useReanalyzeMutation();
  const [previewResume, setPreviewResume] = useState<Resume | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const apps = data?.data ?? [];
  const ids = useMemo(() => apps.map((a) => a._id), [apps]);
  const open = useOpenApplication(ids);
  const resolveCompany = useCompanyResolver(apps);
  const { focusedIndex, setFocusedIndex, selected, toggle, deleteOne, overlays } = useListBehavior({
    apps, archived: filters.status === "archived", onOpen: (a) => open(a), onEdit: shell.openEdit,
  });
  useRestoreListScroll(!isPending);

  const resumeById = useMemo(() => new Map(resumes.map((r) => [r._id, r])), [resumes]);
  const contactById = useMemo(() => new Map(contacts.map((c) => [c._id, c])), [contacts]);

  const grouped = useMemo(() => {
    if (!shell.groupByCompany) return null;
    const map = new Map<string, Application[]>();
    for (const a of apps) map.set(a.company, [...(map.get(a.company) ?? []), a]);
    return [...map.entries()];
  }, [apps, shell.groupByCompany]);

  const row = (a: Application, idx: number, stagger = true) => (
    <div key={a._id} data-row-index={idx} onMouseEnter={() => setFocusedIndex(idx)} style={{ scrollMarginTop: "var(--page-header-h, 0px)" }}>
      <ApplicationRow
        app={a}
        company={resolveCompany(a)}
        resume={a.resumeId ? resumeById.get(a.resumeId) : undefined}
        contact={a.contactId ? contactById.get(a.contactId) : undefined}
        deadlines={deadlines}
        density={shell.density}
        focused={focusedIndex === idx}
        selected={selected.has(a._id)}
        selectionActive={selected.size > 0}
        staggerIndex={stagger ? idx : -1}
        onOpen={() => open(a)}
        onEdit={() => shell.openEdit(a)}
        onDelete={() => void deleteOne(a)}
        onToggleSelect={() => toggle(a._id)}
        onResumeClick={() => { const r = a.resumeId ? resumeById.get(a.resumeId) : undefined; if (r?.fileUrl) setPreviewResume(r); }}
        onOpenFit={() => open(a)}
        onRunFit={() => reanalyze.mutate(a._id)}
        hasMasterProfile={hasMasterProfile}
      />
    </div>
  );

  const hasNarrowing = activeFilterCount(filters) > 0 || !!filters.q;

  return (
    <div>
      {isPending ? (
        <SkeletonRows count={6} />
      ) : apps.length === 0 ? (
        <EmptyState
          mode={hasNarrowing || filters.status === "archived" ? "filtered" : "welcome"}
          onAddManually={shell.openCreate}
          onImport={shell.openImport}
          onClearFilters={() => setFilters({ q: "", stage: "", company: "", resume: "", source: "" })}
        />
      ) : (
        <div role="list" aria-label="Applications" className="space-y-2" key={`${filters.stage}|${filters.q}|${filters.status}|${page}`}>
          {grouped
            ? grouped.map(([company, list]) => {
                const expanded = expandedGroups.has(company);
                return (
                  <div key={company}>
                    <CompanyGroupHeader
                      company={company}
                      apps={list}
                      expanded={expanded}
                      onToggle={() => setExpandedGroups((prev) => {
                        const next = new Set(prev);
                        if (next.has(company)) next.delete(company); else next.add(company);
                        return next;
                      })}
                    />
                    {/* Spacing lives inside the collapsing body so it animates with it. */}
                    <Collapse open={expanded}>
                      <div className="pt-2">
                        <div className="space-y-2 pl-4 border-l-2 border-border ml-2">
                          {expanded && list.map((a) => row(a, apps.indexOf(a), false))}
                        </div>
                      </div>
                    </Collapse>
                  </div>
                );
              })
            : apps.map((a, idx) => row(a, idx))}
          {data && <PaginationBar page={page} pag={data.pagination} setPage={setPage} />}
        </div>
      )}

      {overlays}
      {previewResume?.fileUrl && (
        <ResumePreview fileUrl={previewResume.fileUrl} name={previewResume.name} fileName={previewResume.fileName} onClose={() => setPreviewResume(null)} />
      )}
    </div>
  );
}
