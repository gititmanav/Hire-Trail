/**
 * Companies page: card grid with company details, links, and application sidebar.
 */
import { useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import toast from "react-hot-toast";
import { applicationsAPI, companiesAPI, resumesAPI, contactsAPI, deadlinesAPI } from "../../utils/api.ts";
import { SkeletonTable } from "../../components/Skeleton/Skeleton.tsx";
import ResumePreview from "../../components/ResumePreview/ResumePreview.tsx";
import type { Company, Application, Resume, Contact, Deadline, Stage, Pagination } from "../../types";

const STAGES: Stage[] = ["Applied", "OA", "Interview", "Offer", "Rejected"];
const badgeCls: Record<Stage, string> = { Applied: "bg-primary/10 text-primary", OA: "bg-warning-light text-yellow-800", Interview: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300", Offer: "bg-success-light text-emerald-800", Rejected: "bg-danger-light text-red-800" };
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
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="3" x2="11" y2="11"/><line x1="11" y1="3" x2="3" y2="11"/></svg>
        </button>
      </div>
      <div className="p-6 space-y-5 overflow-y-auto flex-1">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Company</label>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">{app.company}</span>
            {app.jobUrl && <a href={app.jobUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-xs">Visit</a>}
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Stage</label>
          <div className="flex flex-wrap gap-1.5">
            {STAGES.map((s) => (
              <button key={s} onClick={() => onStageChange(app._id, s)}
                className={`px-3 py-1 text-xs font-medium rounded-full border transition-all ${app.stage === s ? badgeCls[s] + " border-current" : "bg-muted border-border text-muted-foreground hover:border-primary hover:text-primary"}`}>
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
            <button onClick={() => onViewResume(resume)} className="text-sm text-primary hover:underline flex items-center gap-1">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9l-7-7z"/><path d="M13 2v7h7"/></svg>
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

  return (
    <SlidePanel onClose={onClose}>
      <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between shrink-0">
        <h2 className="text-lg font-semibold text-foreground truncate">{company.name} — Applications</h2>
        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground">
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="3" x2="11" y2="11"/><line x1="11" y1="3" x2="3" y2="11"/></svg>
        </button>
      </div>
      <div className="p-6 overflow-y-auto flex-1">
        {loading ? <div className="spinner" /> : apps.length === 0 ? (
          <p className="text-sm text-muted-foreground">No applications found</p>
        ) : (
          <div className="space-y-2">
            {apps.map((a) => (
              <button key={a._id} onClick={() => onSelectApp(a)} className="w-full text-left p-3 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">{a.role}</span>
                  <span className={`inline-block px-2 py-0.5 text-[11px] font-medium rounded-full ${badgeCls[a.stage]}`}>{a.stage}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{fmt(a.applicationDate)}</p>
              </button>
            ))}
          </div>
        )}
      </div>
    </SlidePanel>
  );
}

/* ─── Main Component ─── */
export default function Companies() {
  const [companies, setCompanies] = useState<Company[]>([]);
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
      const [c, r, ct, dl] = await Promise.all([
        companiesAPI.getAll({ page, limit: 24, search: debouncedSearch || undefined }),
        resumesAPI.getAll(),
        contactsAPI.getAll({ limit: 500 }),
        deadlinesAPI.getAll({ limit: 500, status: "upcoming" }),
      ]);
      setCompanies(c.data); setPag(c.pagination); setResumes(r); setContacts(ct.data); setDeadlines(dl.data);
    } catch {} finally { setLoading(false); }
  }, [page, debouncedSearch]);

  useEffect(() => { fetchData(); }, [fetchData]);

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

      <div className="sticky top-[49px] z-20 backdrop-blur-sm py-3 -mx-8 px-8">
        <input className="input-premium max-w-[320px]" placeholder="Search companies..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {companies.length === 0 ? (
        <div className="card-premium p-12 text-center text-muted-foreground">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" className="mx-auto mb-3 text-muted-foreground/40"><path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0H5m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>
          <h3 className="font-medium text-secondary-foreground mb-1">No companies found</h3>
          <p className="text-sm">{search ? "Try a different search" : "Companies are created automatically when you add applications. Start tracking jobs to see companies here!"}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {companies.map((c) => {
              const initials = c.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
              return (
                <div key={c._id} className="card-premium p-4">
                  <div className="flex items-start gap-3 mb-3">
                    {c.domain ? (
                      <img src={`https://logo.clearbit.com/${c.domain}`} alt="" className="w-10 h-10 rounded-lg bg-muted object-contain"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden"); }} />
                    ) : null}
                    <div className={`w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-sm font-bold text-muted-foreground ${c.domain ? "hidden" : ""}`}>{initials}</div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-foreground truncate">{c.name}</h3>
                      {c.website ? (
                        <a href={c.website} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline truncate block">{c.domain || c.website}</a>
                      ) : (
                        <p className="text-xs text-muted-foreground">No website</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {c.applicationCount || 0} application{(c.applicationCount || 0) !== 1 ? "s" : ""}
                    </span>
                    <button onClick={() => setSidebarCompany(c)} className="text-xs text-primary hover:underline flex items-center gap-1">
                      View apps
                      <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 1l5 4-5 4"/></svg>
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
