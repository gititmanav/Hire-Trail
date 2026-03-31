/** Company detail page: header, stats, applications tab, contacts tab, timeline, notes. */
import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { companiesAPI } from "../../utils/api.ts";
import type { CompanyDetail, Application, Contact } from "../../types";

const stageColors: Record<string, string> = {
  Applied: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  OA: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  Interview: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  Offer: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  Rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

const outreachColors: Record<string, string> = {
  not_contacted: "bg-muted text-secondary-foreground",
  reached_out: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  responded: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  meeting_scheduled: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  follow_up_needed: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  gone_cold: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

const fmt = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const ini = (n: string) => n.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

type Tab = "applications" | "contacts" | "timeline";

function buildTimeline(apps: Application[], contacts: Contact[]) {
  const events: { date: string; label: string; type: string }[] = [];
  for (const a of apps) {
    for (const sh of a.stageHistory) {
      events.push({ date: sh.date, label: `${a.role} — moved to ${sh.stage}`, type: sh.stage === "Rejected" ? "rejected" : sh.stage === "Offer" ? "offer" : "stage" });
    }
  }
  for (const c of contacts) {
    if (c.lastOutreachDate) {
      events.push({ date: c.lastOutreachDate, label: `Reached out to ${c.name}`, type: "outreach" });
    }
  }
  return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export default function CompanyProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<CompanyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("applications");

  useEffect(() => {
    if (!id) return;
    companiesAPI.getOne(id).then(setData).catch(() => navigate("/companies")).finally(() => setLoading(false));
  }, [id, navigate]);

  if (loading) return <div className="spinner" />;
  if (!data) return null;

  const interviews = data.applications.filter((a) => a.stage === "Interview").length;
  const offers = data.applications.filter((a) => a.stage === "Offer").length;
  const timeline = buildTimeline(data.applications, data.contacts);

  return (
    <div>
      {/* Back link */}
      <button onClick={() => navigate("/companies")} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-4">
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M10 3L5 8l5 5" /></svg>
        Back to Companies
      </button>

      {/* Header */}
      <div className="bg-card border border-border rounded-xl p-6 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className={`text-2xl font-semibold text-foreground ${data.blacklisted ? "line-through" : ""}`}>{data.name}</h1>
              {data.blacklisted && <span className="text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-full">Blacklisted</span>}
            </div>
            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
              {data.industry && <span>{data.industry}</span>}
              {data.website && <a href={data.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{data.website.replace(/^https?:\/\//, "")}</a>}
            </div>
            {data.blacklisted && data.blacklistReason && <p className="text-sm text-red-500 mt-1">Reason: {data.blacklistReason}</p>}
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        {[
          { label: "Applications", value: data.applications.length },
          { label: "Interviews", value: interviews },
          { label: "Offers", value: offers },
          { label: "Rejections", value: data.rejectionCount },
          { label: "Contacts", value: data.contacts.length },
        ].map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-foreground">{s.value}</div>
            <div className="text-xs text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-border">
        {(["applications", "contacts", "timeline"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === t ? "border-accent text-accent" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {t === "applications" ? `Applications (${data.applications.length})` : t === "contacts" ? `Contacts (${data.contacts.length})` : `Timeline (${timeline.length})`}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "applications" && (
        <div className="space-y-2">
          {data.applications.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No applications at this company yet</p>
          ) : data.applications.map((a) => (
            <Link key={a._id} to="/applications" className="flex items-center gap-3 bg-card border border-border rounded-lg p-4 hover:shadow-sm transition-shadow">
              <div className="flex-1">
                <div className="text-sm font-medium text-foreground">{a.role}</div>
                <div className="text-xs text-muted-foreground">Applied {fmt(a.applicationDate)}</div>
              </div>
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${stageColors[a.stage] || ""}`}>{a.stage}</span>
              {a.outreachStatus !== "none" && <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">{a.outreachStatus.replace(/_/g, " ")}</span>}
            </Link>
          ))}
        </div>
      )}

      {tab === "contacts" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.contacts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center col-span-full">No contacts at this company yet</p>
          ) : data.contacts.map((c) => (
            <div key={c._id} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">{ini(c.name)}</div>
                <div>
                  <div className="text-sm font-medium text-foreground">{c.name}</div>
                  <div className="text-xs text-muted-foreground">{c.role}</div>
                </div>
              </div>
              <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${outreachColors[c.outreachStatus] || outreachColors.not_contacted}`}>
                {c.outreachStatus.replace(/_/g, " ")}
              </span>
              {c.linkedinUrl && <a href={c.linkedinUrl} target="_blank" rel="noopener noreferrer" className="block text-xs text-primary hover:underline mt-1">LinkedIn</a>}
            </div>
          ))}
        </div>
      )}

      {tab === "timeline" && (
        <div className="space-y-0">
          {timeline.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No activity yet</p>
          ) : timeline.map((e, i) => (
            <div key={i} className="flex gap-3 py-3 border-b border-border/50 last:border-0">
              <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${e.type === "rejected" ? "bg-red-400" : e.type === "offer" ? "bg-green-400" : e.type === "outreach" ? "bg-blue-400" : "bg-muted-foreground/30"}`} />
              <div>
                <div className="text-sm text-foreground">{e.label}</div>
                <div className="text-xs text-muted-foreground">{fmt(e.date)}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Notes */}
      {data.notes && (
        <div className="mt-6 bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-medium text-foreground mb-2">Notes</h3>
          <p className="text-sm text-secondary-foreground whitespace-pre-wrap">{data.notes}</p>
        </div>
      )}
    </div>
  );
}
