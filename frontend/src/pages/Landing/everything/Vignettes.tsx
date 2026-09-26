/** Small, real-looking pieces of the app for "And everything else" — each
 *  drawn with the app's dark tokens (the chapter is dark). Decorative. */
import { Building2, Check, Clock, FileSpreadsheet, FileText, Mail, Search, Sparkles, Users } from "lucide-react";
import { STAGE_BADGE_CLASS, STAGE_COLOR } from "../../../utils/stageStyles.ts";

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

/** A replica of the real calendar's Week scale (views/calendar): deadlines as
 *  a type glyph + bold title, records as a stage-colour dot + company. */
export function CalendarVignette() {
  const days = ["Mon 21", "Tue 22", "Wed 23", "Thu 24", "Fri 25"];
  const items: { day: number; kind: "deadline" | "record"; title: string; meta: string; stage?: keyof typeof STAGE_COLOR; overdue?: boolean }[] = [
    { day: 0, kind: "record", title: "Linear", meta: "Applied", stage: "Applied" },
    { day: 0, kind: "record", title: "Figma", meta: "Applied", stage: "Applied" },
    { day: 1, kind: "deadline", title: "OA due", meta: "Airbnb", overdue: true },
    { day: 2, kind: "deadline", title: "Follow up", meta: "Vercel" },
    { day: 2, kind: "record", title: "Notion", meta: "→ OA", stage: "OA" },
    { day: 3, kind: "record", title: "Stripe", meta: "→ Interview", stage: "Interview" },
    { day: 3, kind: "deadline", title: "Interview prep", meta: "Stripe" },
    { day: 4, kind: "record", title: "Ramp", meta: "→ Offer", stage: "Offer" },
  ];
  return (
    <Card>
      <div className="flex items-center justify-between px-4 h-12 border-b border-border">
        <span className="text-[14px] font-semibold text-foreground">September <span className="font-normal text-muted-foreground">2026</span></span>
        <span className="inline-flex items-center gap-0.5 p-0.5 rounded-lg border border-border text-[11.5px]">
          <span className="px-2 py-0.5 rounded-md text-muted-foreground">Day</span>
          <span className="px-2 py-0.5 rounded-md bg-control text-foreground">Week</span>
          <span className="px-2 py-0.5 rounded-md text-muted-foreground">Month</span>
        </span>
      </div>
      <div className="grid grid-cols-5">
        {days.map((d, i) => (
          <div key={d} className={`h-[168px] p-1 ${i ? "border-l border-border/70" : ""}`}>
            <p className="flex items-center gap-1.5 px-1.5 pt-1 pb-1.5 text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground">
              {d.split(" ")[0]}
              <span className={`text-[11px] tabular-nums ${i === 3 ? "inline-grid place-items-center h-[18px] min-w-[18px] px-1 rounded-full bg-primary text-primary-foreground font-semibold" : "text-foreground/80"}`}>{d.split(" ")[1]}</span>
            </p>
            {items.filter((c) => c.day === i).map((c) => (
              <span key={c.title + c.meta} className="flex items-start gap-1.5 px-1.5 py-1 text-[11px] leading-[1.35]">
                {c.kind === "deadline"
                  ? <Clock size={11} strokeWidth={2} className={`mt-[2px] shrink-0 ${c.overdue ? "text-destructive" : "text-foreground/55"}`} />
                  : <span className="mt-[5px] w-1.5 h-1.5 rounded-full shrink-0" style={{ background: STAGE_COLOR[c.stage!] }} />}
                <span className="min-w-0">
                  <span className={`block truncate ${c.kind === "deadline" ? `font-semibold ${c.overdue ? "text-destructive" : "text-foreground"}` : "font-medium text-foreground/85"}`}>{c.title}</span>
                  <span className="block truncate text-[10.5px] text-muted-foreground">{c.meta}</span>
                </span>
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
