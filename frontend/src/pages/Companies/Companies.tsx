/**
 * Companies page: card grid with company details, links, and application sidebar.
 */
import { useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import {
  FileText, X, ChevronRight
} from "lucide-react";
import toast from "react-hot-toast";
import { applicationsAPI, companiesAPI, resumesAPI, contactsAPI, deadlinesAPI } from "../../utils/api.ts";
import { SkeletonTable } from "../../components/Skeleton/Skeleton.tsx";
import ResumePreview from "../../components/ResumePreview/ResumePreview.tsx";
import EmptyState from "../../components/EmptyState/EmptyState.tsx";
import CompanyLogo from "../../components/CompanyLogo/CompanyLogo.tsx";
import type { Company, Application, Resume, Contact, Deadline, Stage, Pagination } from "../../types";
import { STAGES, STAGE_BADGE_CLASS } from "../../utils/stageStyles.ts";
import { companyTimeline, summarizeTimeline, compensationSummary, formatMoneyShort } from "../../utils/companyAggregates.ts";

/** Per-stage segment color for the status breakdown bar on each company
 *  card. Pulled from the existing stage-tone palette so the bar matches the
 *  Kanban + Applications row chips. */
const STAGE_BAR_HEX: Record<Stage, string> = {
  Drafting:  "#94a3b8",
  Applied:   "#3b82f6",
  OA:        "#f59e0b",
  Interview: "#a855f7",
  Offer:     "#10b981",
  Rejected:  "#ef4444",
};

/** Per-session dedupe of logo-fetch requests so re-renders / pagination
 *  don't re-spam POST /companies/:id/logo. Mirrors the Applications page
 *  pattern at frontend/src/pages/Applications/Applications.tsx. */
const requestedLogoIds = new Set<string>();

/** Quick-jump research links per company. Each url is a Google "I'm feeling
 *  lucky"-style search scoped to the relevant service when no canonical URL
 *  exists. Opening in a new tab keeps the user on the page. */
function quickJumpUrls(company: { name: string; website?: string }) {
  const q = encodeURIComponent(company.name);
  return {
    glassdoor: `https://www.glassdoor.com/Search/results.htm?keyword=${q}`,
    levels:    `https://www.levels.fyi/?search=${q}`,
    blind:     `https://www.teamblind.com/search/${q}`,
    careers:   company.website || `https://www.google.com/search?q=${q}+careers`,
  };
}

const badgeCls: Record<Stage, string> = STAGE_BADGE_CLASS;
const fmt = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

/* ─── Slide-in Panel with backdrop ─── */
function SlidePanel({ onClose, width = "w-[420px]", children }: { onClose: () => void; width?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  useEffect(() => { requestAnimationFrame(() => setOpen(true)); }, []);
  const handleClose = () => { setOpen(false); setTimeout(onClose, 300); };
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); }; document.addEventListener("keydown", h); return () => document.removeEventListener("keydown", h); }, []);
  return (
    <div className="fixed inset-0 z-40 flex justify-end" onClick={handleClose}>
      <div className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0"}`} />
      <div className={`relative ${width} h-full bg-card shadow-2xl flex flex-col border-l border-border transition-transform duration-300 ${open ? "translate-x-0" : "translate-x-full"}`} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

/* ─── Application Detail Sidebar (matches Applications page exactly) ─── */
function AppDetailSidebar({ app, resumes, contacts, deadlines, onClose, onStageChange, onViewResume }: {
  app: Application; resumes: Resume[]; contacts: Contact[]; deadlines: Deadline[];
  onClose: () => void; onStageChange: (id: string, stage: Stage) => void; onViewResume: (r: Resume) => void;
}) {
  const resume = resumes.find((r) => r._id === app.resumeId);
  const companyContacts = contacts.filter((c) => c.company.toLowerCase() === app.company.toLowerCase());
  const appDeadlines = deadlines.filter((d) => d.applicationId === app._id && !d.completed);

  return (
    <SlidePanel onClose={onClose}>
      <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between shrink-0">
        <h2 className="text-lg font-semibold text-foreground truncate">{app.role}</h2>
        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground">
          <X size={14} strokeWidth={2} />
        </button>
      </div>
      <div className="p-6 space-y-5 overflow-y-auto flex-1">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Company</label>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">{app.company}</span>
            {app.jobUrl && <a href={app.jobUrl} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground hover:underline text-xs">Visit</a>}
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Stage</label>
          <div className="flex flex-wrap gap-1.5">
            {STAGES.map((s) => (
              <button key={s} onClick={() => onStageChange(app._id, s)}
                className={`px-3 py-1 text-xs font-medium rounded-full border ${app.stage === s ? badgeCls[s] + " border-current" : "bg-muted border-border text-muted-foreground hover:border-primary hover:text-primary"}`}>
                {s}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Applied</label>
          <p className="text-sm text-secondary-foreground">{fmt(app.applicationDate)}</p>
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Resume</label>
          {resume ? (
            <button onClick={() => onViewResume(resume)} className="text-sm text-muted-foreground hover:text-foreground hover:underline flex items-center gap-1">
              <FileText size={14} strokeWidth={1.5} />
              {resume.name}
            </button>
          ) : <p className="text-sm text-muted-foreground">None</p>}
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Company Contact</label>
          {companyContacts.length > 0 ? (
            <div className="space-y-2">
              {companyContacts.slice(0, 3).map((c) => (
                <div key={c._id} className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">{c.name[0]}</div>
                  <div>
                    <p className="text-sm text-foreground">{c.name}</p>
                    <p className="text-[11px] text-muted-foreground">{c.role} · {c.connectionSource}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-muted-foreground">None</p>}
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Follow-up Deadlines</label>
          {appDeadlines.length > 0 ? (
            <div className="space-y-1.5">
              {appDeadlines.map((d) => (
                <div key={d._id} className="flex items-center justify-between text-sm">
                  <span className="text-secondary-foreground">{d.type}</span>
                  <span className="text-xs text-muted-foreground">{fmt(d.dueDate)}</span>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-muted-foreground">None</p>}
        </div>
        {app.notes && (
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Notes</label>
            <p className="text-sm text-secondary-foreground whitespace-pre-wrap">{app.notes}</p>
          </div>
        )}
        {app.stageHistory.length > 0 && (
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Stage History</label>
            <div className="space-y-1.5">
              {app.stageHistory.map((sh, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className={`inline-block px-2 py-0.5 text-[11px] font-medium rounded-full ${badgeCls[sh.stage]}`}>{sh.stage}</span>
                  <span className="text-xs text-muted-foreground">{fmt(sh.date)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </SlidePanel>
  );
}

/* ─── Company Applications Sidebar ─── */
function CompanyAppsSidebar({ company, onClose, onSelectApp }: {
  company: Company & { applications?: Application[] }; onClose: () => void; onSelectApp: (app: Application) => void;
}) {
  const [apps, setApps] = useState<Application[]>(company.applications || []);
  const [loading, setLoading] = useState(!company.applications);

  useEffect(() => {
    if (!company.applications) {
      companiesAPI.getOne(company._id).then((c) => { setApps(c.applications || []); }).catch(() => {}).finally(() => setLoading(false));
    }
  }, [company]);

  const timeline = companyTimeline(apps);
  const comp = compensationSummary(apps);
  const peakByAppId: Record<string, Stage> = {};
  for (const e of timeline.entries) peakByAppId[e.appId] = e.peakStage;

  return (
    <SlidePanel onClose={onClose}>
      <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between shrink-0">
        <h2 className="text-lg font-semibold text-foreground truncate">{company.name} — Applications</h2>
        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground">
          <X size={14} strokeWidth={2} />
        </button>
      </div>
      <div className="p-6 overflow-y-auto flex-1">
        {loading ? (
          // Skeleton mirrors the post-load sections: lifetime activity strip,
          // (maybe) compensation card, then the apps list. Three list-row
          // placeholders is enough — the actual list density varies.
          <div className="space-y-5">
            <div className="space-y-2">
              <div className="h-3 w-28 bg-muted rounded animate-pulse" />
              <div className="h-4 w-3/4 bg-muted rounded animate-pulse" />
              <div className="h-2 w-full bg-muted rounded-full animate-pulse" />
            </div>
            <div className="space-y-2">
              <div className="h-3 w-32 bg-muted rounded animate-pulse" />
              {[1, 2, 3].map((i) => <div key={i} className="h-14 w-full bg-muted/60 rounded-lg animate-pulse" />)}
            </div>
          </div>
        ) : apps.length === 0 ? (
          <p className="text-sm text-muted-foreground">No applications found</p>
        ) : (
          <>
            {/* Timeline — lifetime stage activity at this company. Sentence
             *  header + stacked strip + per-stage legend chips. Mirrors the
             *  card-level breakdown bar but with the full sentence rendering
             *  and slightly larger 4px strip suited to a sidebar context. */}
            <section className="mb-5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Lifetime activity</label>
              <p className="text-sm text-foreground mb-2">{summarizeTimeline(timeline)}</p>
              <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
                {STAGES.map((s) => {
                  const w = timeline.byStage[s] / Math.max(timeline.total, 1);
                  if (w === 0) return null;
                  return (
                    <div key={s} className="h-full" style={{ width: `${w * 100}%`, backgroundColor: STAGE_BAR_HEX[s] }} title={`${timeline.byStage[s]} ${s}`} />
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-x-2.5 gap-y-1 mt-2 text-[11px] text-muted-foreground">
                {STAGES.filter((s) => timeline.byStage[s] > 0).map((s) => (
                  <span key={s} className="inline-flex items-center gap-1 tabular-nums">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: STAGE_BAR_HEX[s] }} aria-hidden />
                    {timeline.byStage[s]} {s}
                  </span>
                ))}
              </div>
            </section>

            {/* Compensation memory — aggregate salary range across the user's
             *  apps at this company. Hidden entirely when no salary parses
             *  (free-text field; not every app has one). Hourly sources are
             *  annualised at 2080 hrs and disclaimed in the footnote. */}
            {comp && (
              <section className="mb-5 rounded-lg border border-border bg-muted/40 p-3">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Compensation seen</label>
                <div className="flex items-baseline gap-3">
                  <span className="text-lg font-semibold text-foreground tabular-nums">
                    {comp.min === comp.max ? formatMoneyShort(comp.min) : `${formatMoneyShort(comp.min)} – ${formatMoneyShort(comp.max)}`}
                  </span>
                  <span className="text-xs text-muted-foreground">median {formatMoneyShort(comp.median)}</span>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Across {comp.count} application{comp.count === 1 ? "" : "s"}
                  {comp.hasHourly ? " · annualised from hourly @ 2080 hrs" : ""}
                </p>
              </section>
            )}

            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Applications</label>
            <div className="space-y-2">
              {apps.map((a) => {
                const peak = peakByAppId[a._id];
                // Show "(peak: X)" only when the app ended up at a stage that
                // doesn't reflect how far it actually got — typically Rejected
                // after reaching OA/Interview/Offer.
                const showPeak = peak && peak !== a.stage && a.stage === "Rejected";
                return (
                  <button key={a._id} onClick={() => onSelectApp(a)} className="w-full text-left p-3 rounded-lg border border-border hover:border-primary hover:bg-primary/5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-foreground truncate">{a.role}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {showPeak && (
                          <span className={`inline-block px-2 py-0.5 text-[10px] font-medium rounded-full ${badgeCls[peak]}`} title={`Reached ${peak} before being rejected`}>
                            peak {peak}
                          </span>
                        )}
                        <span className={`inline-block px-2 py-0.5 text-[11px] font-medium rounded-full ${badgeCls[a.stage]}`}>{a.stage}</span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{fmt(a.applicationDate)}</p>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </SlidePanel>
  );
}

/* ─── Main Component ─── */
export default function Companies() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [allApps, setAllApps] = useState<Application[]>([]);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pag, setPag] = useState<Pagination>({ page: 1, limit: 24, total: 0, pages: 0 });
  const [sidebarCompany, setSidebarCompany] = useState<Company | null>(null);
  const [sidebarApp, setSidebarApp] = useState<Application | null>(null);
  const [previewResume, setPreviewResume] = useState<Resume | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    debounceRef.current = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  const fetchData = useCallback(async () => {
    try {
      const [c, r, ct, dl, ap] = await Promise.all([
        companiesAPI.getAll({ page, limit: 24, search: debouncedSearch || undefined }),
        resumesAPI.getAll(),
        contactsAPI.getAll({ limit: 500 }),
        deadlinesAPI.getAll({ limit: 500, status: "upcoming" }),
        applicationsAPI.getAll({ limit: 1000, archived: "all" }),
      ]);
      setCompanies(c.data); setPag(c.pagination); setResumes(r); setContacts(ct.data); setDeadlines(dl.data); setAllApps(ap.data);
    } catch {} finally { setLoading(false); }
  }, [page, debouncedSearch]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* Auto-fetch missing logos. Mirrors the Applications page: any rendered
   * company without a cached logoUrl gets a fire-and-forget POST /logo,
   * deduped within the session so refetch/page changes don't re-spam. The
   * backend handles the 30-day retry interval. */
  useEffect(() => {
    if (companies.length === 0) return;
    companies.forEach((c) => {
      if (c.logoUrl) return;
      if (requestedLogoIds.has(c._id)) return;
      requestedLogoIds.add(c._id);
      void companiesAPI.fetchLogo(c._id).then((res) => {
        if (!res?.logoUrl) return;
        setCompanies((prev) => prev.map((p) => (p._id === c._id ? { ...p, logoUrl: res.logoUrl, logoFetchedAt: res.logoFetchedAt ?? null } : p)));
      }).catch(() => undefined);
    });
  }, [companies]);

  const handleStageChange = async (id: string, stage: Stage) => {
    try {
      await applicationsAPI.update(id, { stage });
      toast.success("Stage updated");
      if (sidebarApp && sidebarApp._id === id) {
        setSidebarApp((prev) => prev ? { ...prev, stage } : null);
      }
      await fetchData();
    } catch {}
  };

  if (loading) return <div className="fade-up"><SkeletonTable rows={6} /></div>;

  return (
    <div className="fade-up">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Companies</h1>
      </div>

      <div className="sticky top-[49px] z-20 backdrop-blur-sm py-3 -mx-4 md:-mx-6 px-4 md:px-6">
        <input className="input-premium max-w-[320px]" placeholder="Search companies..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {companies.length === 0 ? (
        search ? (
          <EmptyState
            intent="filtered"
            title="No companies match your search"
            description="Try a different keyword, or clear the search to see all companies."
            actions={[{ label: "Clear search", variant: "secondary", onClick: () => setSearch("") }]}
          />
        ) : (
          <EmptyState
            intent="welcome"
            title="No companies tracked yet"
            description="Companies show up here automatically when you add applications or contacts. Start tracking jobs to populate this view."
          />
        )
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {companies.map((c) => {
              const linkedContacts = contacts.filter((ct) => ct.company.toLowerCase() === c.name.toLowerCase());
              const visibleAvatars = linkedContacts.slice(0, 3);
              const overflow = Math.max(0, linkedContacts.length - visibleAvatars.length);
              // Stage breakdown for the status bar — counts per stage from the
              // user's full apps array, case-insensitive name match.
              const companyApps = allApps.filter((a) => a.company.toLowerCase() === c.name.toLowerCase());
              const stageCounts = STAGES.reduce<Record<Stage, number>>((acc, s) => {
                acc[s] = companyApps.filter((a) => a.stage === s).length;
                return acc;
              }, { Drafting: 0, Applied: 0, OA: 0, Interview: 0, Offer: 0, Rejected: 0 });
              const totalApps = companyApps.length;
              return (
                <div key={c._id} className="card-premium p-4">
                  <div className="flex items-start gap-3 mb-3">
                    {/* Bare 56px logo — no wrapping tile, no white background,
                     *  no padding. The brand mark sits directly on the card
                     *  surface. Monogram fallback still keeps its tinted
                     *  background (handled inside CompanyLogo). */}
                    <CompanyLogo name={c.name} logoUrl={c.logoUrl} size="lg" bare />
                    <div className="flex-1 min-w-0">
                      <h3 className="text-[15px] font-semibold text-foreground truncate">{c.name}</h3>
                      {c.website ? (
                        <a href={c.website} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-foreground hover:underline truncate block">{c.domain || c.website}</a>
                      ) : (
                        <p className="text-xs text-muted-foreground">No website</p>
                      )}
                    </div>
                  </div>

                  {/* Status breakdown bar — stacked horizontal showing the
                   *  distribution of the user's apps at this company across
                   *  stages. Empty when there are no apps yet. */}
                  {totalApps > 0 && (
                    <div className="mb-3">
                      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        {STAGES.map((s) => {
                          const w = stageCounts[s] / totalApps;
                          if (w === 0) return null;
                          return (
                            <div
                              key={s}
                              className="h-full"
                              style={{ width: `${w * 100}%`, backgroundColor: STAGE_BAR_HEX[s] }}
                              title={`${stageCounts[s]} ${s}`}
                            />
                          );
                        })}
                      </div>
                      <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1 text-[10px] text-muted-foreground">
                        {STAGES.filter((s) => stageCounts[s] > 0).map((s) => (
                          <span key={s} className="inline-flex items-center gap-1 tabular-nums">
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: STAGE_BAR_HEX[s] }} aria-hidden />
                            {stageCounts[s]} {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {linkedContacts.length > 0 && (
                    <div className="flex items-center gap-1 mb-3" title={linkedContacts.map((ct) => ct.name).join(", ")}>
                      <div className="flex -space-x-1.5">
                        {visibleAvatars.map((ct) => (
                          <div
                            key={ct._id}
                            className="w-6 h-6 rounded-full bg-muted text-secondary-foreground border-2 border-card flex items-center justify-center text-[10px] font-semibold"
                            title={`${ct.name}${ct.role ? ` — ${ct.role}` : ""}`}
                          >
                            {ct.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "?"}
                          </div>
                        ))}
                        {overflow > 0 && (
                          <div
                            className="w-6 h-6 rounded-full bg-muted text-muted-foreground border-2 border-card flex items-center justify-center text-[9px] font-semibold"
                            title={`${overflow} more contact${overflow === 1 ? "" : "s"} at ${c.name}`}
                          >
                            +{overflow}
                          </div>
                        )}
                      </div>
                      <span className="text-[11px] text-muted-foreground ml-1">
                        {linkedContacts.length} contact{linkedContacts.length === 1 ? "" : "s"}
                      </span>
                    </div>
                  )}

                  {/* Quick-jump external research links. Glassdoor / Levels.fyi
                   *  / Blind / careers — each opens in a new tab so the user
                   *  doesn't lose their HireTrail context. */}
                  {(() => {
                    const urls = quickJumpUrls(c);
                    return (
                      <div className="flex items-center gap-1 mb-2.5">
                        <a href={urls.glassdoor} target="_blank" rel="noopener noreferrer" title="Glassdoor reviews" aria-label="Glassdoor reviews" className="px-1.5 py-0.5 text-[10px] font-semibold rounded-md border border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground/50 transition-colors">GD</a>
                        <a href={urls.levels} target="_blank" rel="noopener noreferrer" title="Levels.fyi compensation" aria-label="Levels.fyi compensation" className="px-1.5 py-0.5 text-[10px] font-semibold rounded-md border border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground/50 transition-colors">L.fyi</a>
                        <a href={urls.blind} target="_blank" rel="noopener noreferrer" title="Blind discussions" aria-label="Blind discussions" className="px-1.5 py-0.5 text-[10px] font-semibold rounded-md border border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground/50 transition-colors">Blind</a>
                        <a href={urls.careers} target="_blank" rel="noopener noreferrer" title="Careers page" aria-label="Careers page" className="px-1.5 py-0.5 text-[10px] font-semibold rounded-md border border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground/50 transition-colors">Careers</a>
                      </div>
                    );
                  })()}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {c.applicationCount || 0} application{(c.applicationCount || 0) !== 1 ? "s" : ""}
                    </span>
                    <button onClick={() => setSidebarCompany(c)} className="text-xs text-muted-foreground hover:text-foreground hover:underline flex items-center gap-1">
                      View apps
                      <ChevronRight size={10} strokeWidth={2} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {pag.pages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1.5 text-sm border border-border rounded-lg disabled:opacity-30 hover:bg-muted text-secondary-foreground">Prev</button>
              <span className="text-sm text-muted-foreground">Page {page} of {pag.pages}</span>
              <button disabled={page >= pag.pages} onClick={() => setPage(page + 1)} className="px-3 py-1.5 text-sm border border-border rounded-lg disabled:opacity-30 hover:bg-muted text-secondary-foreground">Next</button>
            </div>
          )}
        </>
      )}

      {/* Company apps list sidebar */}
      {sidebarCompany && !sidebarApp && (
        <CompanyAppsSidebar
          company={sidebarCompany}
          onClose={() => setSidebarCompany(null)}
          onSelectApp={(app) => setSidebarApp(app)}
        />
      )}

      {/* Application detail sidebar (same as Applications page) */}
      {sidebarApp && (
        <AppDetailSidebar
          app={sidebarApp}
          resumes={resumes}
          contacts={contacts}
          deadlines={deadlines}
          onClose={() => { setSidebarApp(null); }}
          onStageChange={handleStageChange}
          onViewResume={(r) => setPreviewResume(r)}
        />
      )}

      {/* Resume preview with spotlight (same as Resumes page) */}
      {previewResume && previewResume.fileUrl && (
        <ResumePreview
          fileUrl={previewResume.fileUrl}
          name={previewResume.name}
          fileName={previewResume.fileName}
          onClose={() => setPreviewResume(null)}
        />
      )}
    </div>
  );
}
