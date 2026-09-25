/** Small, real-looking pieces of the app for "And everything else" — each
 *  drawn with the app's dark tokens (the chapter is dark). Decorative. */
import { Building2, CalendarDays, Check, Clock, FileSpreadsheet, FileText, Mail, Search, Sparkles, Users } from "lucide-react";
import { STAGE_BADGE_CLASS, STAGE_CALENDAR_COLOR } from "../../../utils/stageStyles.ts";

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-border bg-card shadow-floating overflow-hidden ${className}`}>{children}</div>;
}

export function SearchVignette() {
  const rows = [
    { group: "Applications", title: "Stripe — Senior Frontend Engineer", meta: <span className={`px-1.5 py-0.5 rounded text-[10.5px] font-semibold ${STAGE_BADGE_CLASS.Interview}`}>Interview</span>, Icon: FileText, active: true },
    { group: "Companies", title: "Stripe", meta: <span className="text-[11.5px] text-muted-foreground">2 applications</span>, Icon: Building2 },
    { group: "Contacts", title: "Jordan Lee", meta: <span className="text-[11.5px] text-muted-foreground">Recruiter · Stripe</span>, Icon: Users },
    { group: "Deadlines", title: "Thank-you note — Stripe", meta: <span className="text-[11.5px] text-muted-foreground">Today</span>, Icon: Clock },
  ];
  return (
    <Card>
      <div className="flex items-center gap-2.5 px-4 h-12 border-b border-border">
        <Search size={15} strokeWidth={2} className="text-muted-foreground" />
        <span className="text-[14px] text-foreground">stri<span className="inline-block w-[1.5px] h-4 -mb-0.5 ml-px bg-foreground animate-pulse motion-reduce:animate-none" /></span>
        <kbd className="ml-auto text-[10.5px] font-mono text-muted-foreground border border-border rounded px-1.5 py-0.5">esc</kbd>
      </div>
      <div className="p-1.5">
        {rows.map((r) => (
          <div key={r.title} className={`flex items-center gap-3 h-11 px-3 rounded-lg ${r.active ? "bg-control" : ""}`}>
            <r.Icon size={15} strokeWidth={1.8} className="text-muted-foreground shrink-0" />
            <span className="flex-1 min-w-0">
              <span className="block text-[13px] font-medium text-foreground truncate">{r.title}</span>
              <span className="block text-[10.5px] uppercase tracking-wider text-muted-foreground/80">{r.group}</span>
            </span>
            {r.meta}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-4 px-4 h-10 border-t border-border text-[11px] text-muted-foreground">
        <span>↑ ↓ to move</span><span>↵ to open</span><span className="ml-auto font-mono">⌘K</span>
      </div>
    </Card>
  );
}

export function CalendarVignette() {
  const days = ["Mon 21", "Tue 22", "Wed 23", "Thu 24", "Fri 25"];
  const chips: { day: number; top: number; label: string; color: { backgroundColor: string; borderColor: string } }[] = [
    { day: 0, top: 10, label: "Applied · Linear", color: STAGE_CALENDAR_COLOR.Applied },
    { day: 1, top: 44, label: "OA due · Airbnb", color: STAGE_CALENDAR_COLOR.OA },
    { day: 2, top: 10, label: "Follow up · Vercel", color: STAGE_CALENDAR_COLOR.Drafting },
    { day: 3, top: 26, label: "Interview · Stripe", color: STAGE_CALENDAR_COLOR.Interview },
    { day: 4, top: 60, label: "Offer · Ramp", color: STAGE_CALENDAR_COLOR.Offer },
  ];
  return (
    <Card>
      <div className="flex items-center justify-between px-4 h-12 border-b border-border">
        <span className="flex items-center gap-2 text-[13.5px] font-semibold text-foreground"><CalendarDays size={15} strokeWidth={1.8} className="text-muted-foreground" /> September 2026</span>
        <span className="inline-flex items-center gap-0.5 p-0.5 rounded-lg border border-border text-[11.5px]">
          <span className="px-2 py-0.5 rounded-md text-muted-foreground">Month</span>
          <span className="px-2 py-0.5 rounded-md bg-control text-foreground">Week</span>
        </span>
      </div>
      <div className="grid grid-cols-5">
        {days.map((d, i) => (
          <div key={d} className={`relative h-[168px] ${i ? "border-l border-border" : ""}`}>
            <p className={`px-2.5 pt-2 text-[11px] font-medium ${i === 3 ? "text-foreground" : "text-muted-foreground"}`}>{d}</p>
            {chips.filter((c) => c.day === i).map((c) => (
              <span
                key={c.label}
                className="absolute left-1.5 right-1.5 rounded-md px-2 py-1.5 text-[10.5px] font-semibold leading-tight text-white border"
                style={{ top: 26 + c.top, ...c.color }}
              >
                {c.label}
              </span>
            ))}
          </div>
        ))}
      </div>
    </Card>
  );
}

export function DeadlinesVignette() {
  const buckets = [
    { label: "Today", rows: [{ title: "Thank-you note", co: "Stripe", tone: "bg-red-500" }] },
    { label: "Tomorrow", rows: [{ title: "OA due date", co: "Airbnb", tone: "bg-amber-500" }] },
    { label: "This week", rows: [{ title: "Follow-up reminder", co: "Vercel", tone: "bg-slate-400" }, { title: "Offer decision", co: "Ramp", tone: "bg-emerald-500" }] },
  ];
  return (
    <Card>
      {buckets.map((b, bi) => (
        <div key={b.label} className={bi ? "border-t border-border" : ""}>
          <p className="px-4 pt-3 pb-1.5 text-[10.5px] uppercase tracking-wider font-semibold text-muted-foreground">{b.label}</p>
          {b.rows.map((r) => (
            <div key={r.title} className="flex items-center gap-3 px-4 h-11">
              <span className={`w-2 h-2 rounded-full shrink-0 ${r.tone}`} />
              <span className="flex-1 min-w-0 text-[13px] font-medium text-foreground truncate">{r.title}</span>
              <span className="text-[12px] text-muted-foreground">{r.co}</span>
              <span className="w-5 h-5 rounded-md border border-border" />
            </div>
          ))}
        </div>
      ))}
      <div className="h-2" />
    </Card>
  );
}

export function ContactsVignette() {
  return (
    <Card className="p-5">
      <div className="flex items-start gap-3.5">
        <span className="w-11 h-11 rounded-full bg-control text-foreground text-[14px] font-semibold flex items-center justify-center shrink-0">JL</span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-foreground">Jordan Lee</p>
          <p className="text-[12.5px] text-muted-foreground">Technical Recruiter</p>
          <span className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-medium text-foreground">
            <span className="w-5 h-5 rounded-md bg-paper text-[#111] text-[10px] font-bold flex items-center justify-center">S</span> Stripe
          </span>
        </div>
        <span className="text-[11px] text-muted-foreground">Last contact 3d ago</span>
      </div>
      <div className="mt-4 rounded-xl border border-border bg-background/60 p-3 text-[12.5px] text-muted-foreground leading-relaxed">
        Referred by Sam at the Boston meetup. Prefers email. Following up after the interview.
      </div>
      <div className="mt-4 flex items-center gap-2">
        <span className="h-8 px-3 rounded-lg bg-primary text-primary-foreground text-[12.5px] font-medium inline-flex items-center gap-1.5"><Mail size={13} strokeWidth={2} /> Email</span>
        <span className="h-8 px-3 rounded-lg border border-border text-[12.5px] font-medium text-foreground inline-flex items-center">2 applications at Stripe</span>
      </div>
    </Card>
  );
}

export function ImportVignette() {
  return (
    <Card>
      <div className="p-4 flex items-center gap-3 border-b border-border">
        <span className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center"><FileSpreadsheet size={18} strokeWidth={1.8} /></span>
        <div className="flex-1 min-w-0">
          <p className="text-[13.5px] font-semibold text-foreground">job-search-2026.csv</p>
          <p className="text-[12px] text-muted-foreground">128 applications · 34 contacts</p>
        </div>
        <span className="inline-flex items-center gap-1 text-[12px] font-medium text-emerald-400"><Check size={13} strokeWidth={2.6} /> Imported</span>
      </div>
      <div className="px-4 py-3 grid grid-cols-[1.2fr_1.4fr_0.8fr] gap-x-3 gap-y-2 text-[12px]">
        {[["Company", "Role", "Stage"], ["Stripe", "Frontend Engineer", "Interview"], ["Linear", "Software Engineer", "Applied"], ["Ramp", "Frontend Engineer", "Offer"]].map((row, i) =>
          row.map((cell, j) => (
            <span key={`${i}-${j}`} className={i === 0 ? "text-[10.5px] uppercase tracking-wider font-semibold text-muted-foreground" : j === 0 ? "font-medium text-foreground" : "text-muted-foreground"}>
              {cell}
            </span>
          )),
        )}
      </div>
      <div className="px-4 pb-4 pt-1 flex items-center gap-2">
        <span className="text-[12px] text-muted-foreground mr-1">Export</span>
        {["CSV", "JSON"].map((f) => (
          <span key={f} className="h-7 px-2.5 rounded-lg border border-border text-[12px] font-semibold text-foreground inline-flex items-center">{f}</span>
        ))}
      </div>
    </Card>
  );
}

export function AIVignette() {
  const providers = ["Anthropic", "OpenAI", "Google", "Mistral", "Groq", "DeepSeek", "xAI", "Perplexity", "Cohere", "OpenRouter", "Amazon Bedrock"];
  return (
    <Card className="p-5">
      <div className="flex items-center gap-3">
        <span className="lp-ai-glow w-10 h-10 rounded-xl bg-control text-foreground flex items-center justify-center"><Sparkles size={17} strokeWidth={1.8} /></span>
        <div>
          <p className="text-[14px] font-semibold text-foreground">Built-in AI</p>
          <p className="text-[12px] text-muted-foreground">Free to use — or bring your own key</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {providers.map((p) => (
          <span key={p} className="h-7 px-2.5 rounded-full border border-border text-[12px] font-medium text-foreground/90 inline-flex items-center">{p}</span>
        ))}
        <span className="h-7 px-2.5 rounded-full text-[12px] font-medium text-muted-foreground inline-flex items-center">and more</span>
      </div>
    </Card>
  );
}
