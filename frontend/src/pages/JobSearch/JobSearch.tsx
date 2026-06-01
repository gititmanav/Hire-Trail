/**
 * JSearch-backed listings; "Track" creates applications via the API. State lifted in `JobSearchContext`.
 */
import { useState, useCallback, FormEvent } from "react";
import { Loader2, Search, Briefcase, MapPin, ExternalLink, Check, Plus } from "lucide-react";
import toast from "react-hot-toast";
import { api, applicationsAPI } from "../../utils/api.ts";
import { useJobSearch } from "../../hooks/useJobSearchState.ts";

interface Job {
  id: string; title: string; company: string; companyLogo: string | null;
  location: string; remote: boolean; type: string; description: string;
  fullDescription: string; applyUrl: string; postedAt: string;
  salary: string | null; source: string;
}

const DATE_OPTIONS = [
  { label: "Any time", value: "all" },
  { label: "Past 24h", value: "today" },
  { label: "Past week", value: "week" },
  { label: "Past month", value: "month" },
];

export default function JobSearch() {
  const { state: s, setState: setS } = useJobSearch();
  const [loading, setLoading] = useState(false);

  const update = (patch: Partial<typeof s>) => setS((prev) => ({ ...prev, ...patch }));

  const search = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const res = await api.get("/jobs/search", {
        params: {
          query: s.query,
          location: s.location,
          remote: s.remote ? "true" : undefined,
          datePosted: s.datePosted,
          page: p,
        },
      });
      update({
        jobs: res.data.jobs,
        total: res.data.total,
        page: p,
        searched: true,
      });
    } catch (err: any) {
      const msg = err.response?.data?.error || "Search failed";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [s.query, s.location, s.remote, s.datePosted]);

  const handleSubmit = (e: FormEvent) => { e.preventDefault(); search(1); };

  const trackJob = async (job: Job) => {
    try {
      update({ tracking: new Set(s.tracking).add(job.id) });
      await applicationsAPI.create({
        company: job.company,
        role: job.title,
        jobUrl: job.applyUrl,
        stage: "Applied",
        notes: `Source: ${job.source}${job.salary ? ` | Salary: ${job.salary}` : ""}${job.remote ? " | Remote" : ""}`,
        resumeId: "",
        companyId: "",
        contactId: "",
        outreachStatus: "none",
      });
      toast.success(`Tracking ${job.company} — ${job.title}`);
    } catch {
      const reverted = new Set(s.tracking);
      reverted.delete(job.id);
      update({ tracking: reverted });
    }
  };

  const timeAgo = (date: string) => {
    if (!date) return "";
    const diff = Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
    if (diff === 0) return "Today";
    if (diff === 1) return "Yesterday";
    if (diff < 7) return `${diff}d ago`;
    if (diff < 30) return `${Math.floor(diff / 7)}w ago`;
    return `${Math.floor(diff / 30)}mo ago`;
  };

  return (
    <div className="fade-up max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Job Search</h1>
        <p className="text-sm text-muted-foreground mt-1">Find internships and jobs, then track them with one click</p>
      </div>

      <form onSubmit={handleSubmit} className="card-premium p-5 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 mb-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Job title or keyword</label>
            <input className="input-premium" value={s.query} onChange={(e) => update({ query: e.target.value })} placeholder="e.g. Software Engineer Intern" required />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Location</label>
            <input className="input-premium" value={s.location} onChange={(e) => update({ location: e.target.value })} placeholder="e.g. Boston, MA" />
          </div>
          <div className="flex items-end">
            <button type="submit" disabled={loading} className="btn-accent w-full md:w-auto justify-center h-[38px]">
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Search size={16} strokeWidth={2} />
              )}
              Search
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => update({ remote: !s.remote })} className={`inline-flex items-center gap-1.5 px-3 py-1 text-[13px] font-medium rounded-full border ${s.remote ? "bg-primary/10 border-primary text-primary" : "bg-card border-border text-muted-foreground hover:border-primary"}`}>
            <Briefcase size={14} strokeWidth={1.5} />
            Remote only
          </button>
          {DATE_OPTIONS.map((opt) => (
            <button key={opt.value} type="button" onClick={() => update({ datePosted: opt.value })} className={`px-3 py-1 text-[13px] font-medium rounded-full border ${s.datePosted === opt.value ? "bg-primary/10 border-primary text-primary" : "bg-card border-border text-muted-foreground hover:border-primary"}`}>
              {opt.label}
            </button>
          ))}
        </div>
      </form>

      {loading && (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="card-premium p-5 animate-pulse"><div className="h-5 bg-border rounded w-1/3 mb-3" /><div className="h-4 bg-border rounded w-1/2 mb-2" /><div className="h-3 bg-border rounded w-2/3" /></div>)}</div>
      )}

      {!loading && s.searched && s.jobs.length === 0 && (
        <div className="card-premium p-12 text-center"><h3 className="font-medium text-muted-foreground mb-1">No jobs found</h3><p className="text-sm text-muted-foreground">Try different keywords or broaden your filters</p></div>
      )}

      {!loading && s.jobs.length > 0 && (
        <>
          <p className="text-sm text-muted-foreground mb-3">
            {s.total > 10 ? `Showing ${s.jobs.length} of ${s.total}+ results` : `${s.jobs.length} results`}
          </p>
          <div className="space-y-3">
            {s.jobs.map((job: Job) => (
              <div key={job.id} className="card-premium overflow-visible">
                <div className="p-5">
                  <div className="flex items-start gap-3">
                    {job.companyLogo ? (
                      <img src={job.companyLogo} alt="" className="w-10 h-10 rounded-lg object-contain bg-muted shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-muted-foreground text-sm font-bold shrink-0">{job.company.charAt(0)}</div>
                    )}

                    <div className="flex-1 min-w-0">
                      <h3 className="text-[15px] font-semibold text-foreground">{job.title}</h3>
                      <p className="text-sm text-secondary-foreground">{job.company}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-1.5">
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin size={12} strokeWidth={1.5} />
                          {job.location}
                        </span>
                        {job.remote && <span className="text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full font-medium">Remote</span>}
                        {job.salary && <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full font-medium">{job.salary}</span>}
                        {job.type && <span className="text-xs text-muted-foreground">{job.type.replace("_", " ")}</span>}
                        {job.postedAt && <span className="text-xs text-muted-foreground">{timeAgo(job.postedAt)}</span>}
                      </div>
                    </div>

                    <div className="flex gap-2 shrink-0">
                      {job.applyUrl && (
                        <a href={job.applyUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary !py-1.5 !px-3 !text-xs">
                          Apply
                          <ExternalLink size={12} strokeWidth={2} />
                        </a>
                      )}
                      <button
                        onClick={() => trackJob(job)}
                        disabled={s.tracking.has(job.id)}
                        className={`!py-1.5 !px-3 !text-xs ${s.tracking.has(job.id) ? "btn-secondary !text-success !border-success" : "btn-accent"}`}
                      >
                        {s.tracking.has(job.id) ? (
                          <><Check size={12} strokeWidth={2} />Tracked</>
                        ) : (
                          <><Plus size={12} strokeWidth={2} />Track</>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="mt-3">
                    <p className="text-[13px] text-muted-foreground leading-relaxed">
                      {s.expanded === job.id ? job.fullDescription : job.description}
                      {job.fullDescription.length > 500 && (
                        <button onClick={() => update({ expanded: s.expanded === job.id ? null : job.id })} className="text-primary hover:underline ml-1 text-[13px]">
                          {s.expanded === job.id ? "Show less" : "...Read more"}
                        </button>
                      )}
                    </p>
                  </div>

                  {job.source && <p className="text-[11px] text-muted-foreground mt-2">via {job.source}</p>}
                </div>
              </div>
            ))}
          </div>

          {s.jobs.length >= 10 && (
            <div className="flex justify-center mt-6">
              <button onClick={() => search(s.page + 1)} disabled={loading} className="btn-secondary">
                Load more results
              </button>
            </div>
          )}
        </>
      )}

      {!s.searched && !loading && (
        <div className="card-premium p-12 text-center">
          <Search className="mx-auto mb-4 text-muted-foreground dark:text-secondary-foreground" size={48} strokeWidth={1.5} />
          <h3 className="text-base font-medium text-muted-foreground mb-1">Search for jobs</h3>
          <p className="text-sm text-muted-foreground">Find internships and positions, then track them in your pipeline</p>
        </div>
      )}
    </div>
  );
}