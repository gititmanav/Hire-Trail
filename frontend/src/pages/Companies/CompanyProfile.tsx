/** Company detail page: header, stats, applications list, timeline. */
import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { companiesAPI } from "../../utils/api.ts";
import type { CompanyDetail, Application, Stage } from "../../types";
import { STAGE_BADGE_CLASS } from "../../utils/stageStyles.ts";

const stageColors: Record<Stage, string> = STAGE_BADGE_CLASS;

const fmt = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

function buildTimeline(apps: Application[]) {
  const events: { date: string; label: string; type: string }[] = [];
  for (const a of apps) {
    for (const sh of a.stageHistory) {
      events.push({ date: sh.date, label: `${a.role} — moved to ${sh.stage}`, type: sh.stage === "Rejected" ? "rejected" : sh.stage === "Offer" ? "offer" : "stage" });
    }
  }
  return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

type Tab = "applications" | "timeline";

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
  const rejections = data.applications.filter((a) => a.stage === "Rejected").length;
  const timeline = buildTimeline(data.applications);

  return (
    <div>
      <button onClick={() => navigate("/companies")} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M10 3L5 8l5 5" /></svg>
        Back to Companies
      </button>

      <div className="bg-card border border-border rounded-xl p-6 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-xl bg-muted text-muted-foreground flex items-center justify-center shrink-0">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-semibold text-foreground">{data.name}</h1>
            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
              {data.website && <a href={data.website} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground hover:underline">{data.domain || data.website.replace(/^https?:\/\//, "")}</a>}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Applications", value: data.applications.length },
          { label: "Interviews", value: interviews },
          { label: "Offers", value: offers },
          { label: "Rejections", value: rejections },
        ].map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-foreground">{s.value}</div>
            <div className="text-xs text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-1 mb-4 border-b border-border">
        {(["applications", "timeline"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2.5 text-sm font-medium border-b-2 ${tab === t ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {t === "applications" ? `Applications (${data.applications.length})` : `Timeline (${timeline.length})`}
          </button>
        ))}
      </div>

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
            </Link>
          ))}
        </div>
      )}

      {tab === "timeline" && (
        <div className="space-y-0">
          {timeline.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No activity yet</p>
          ) : timeline.map((e, i) => (
            <div key={i} className="flex gap-3 py-3 border-b border-border/50 last:border-0">
              <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${e.type === "rejected" ? "bg-red-400" : e.type === "offer" ? "bg-green-400" : "bg-muted-foreground/30"}`} />
              <div>
                <div className="text-sm text-foreground">{e.label}</div>
                <div className="text-xs text-muted-foreground">{fmt(e.date)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
