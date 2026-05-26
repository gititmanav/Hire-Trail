import type { ReactNode } from "react";
import { Reveal, GridTexture } from "./motion";
import { BrandLogo, StageChip, STAGE_CHIP } from "./brand";

/* ─────────────────────────── feature section layout ─────────────────────────── */

function FeatureSection({ eyebrow, number, title, body, mockup, reverse, bullets, tone = "light" }: {
  eyebrow: string;
  number: string;
  title: string;
  body: string;
  mockup: ReactNode;
  reverse?: boolean;
  bullets?: string[];
  tone?: "light" | "muted";
}) {
  const bg = tone === "muted" ? "bg-gradient-to-br from-gray-50/80 via-blue-50/30 to-gray-50/80 border-y border-gray-200/70" : "bg-white";
  return (
    <section className={`relative overflow-hidden py-10 sm:py-14 ${bg}`}>
      <GridTexture />
      <div className="relative max-w-7xl mx-auto px-5 sm:px-8">
        <div className={`grid lg:grid-cols-2 gap-10 lg:gap-16 items-center ${reverse ? "lg:[&>div:first-child]:order-2" : ""}`}>
          <Reveal>
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <span className="text-[12px] font-mono font-semibold text-[#3B82F6]">{number}</span>
                <span className="h-px w-8 bg-[#3B82F6]/40" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">{eyebrow}</span>
              </div>
              <h2 className="text-3xl sm:text-[40px] sm:leading-[1.1] font-black tracking-tight text-gray-900 mb-3">{title}</h2>
              <p className="text-[16px] text-gray-600 leading-relaxed">{body}</p>
              {bullets && (
                <ul className="mt-5 space-y-2.5">
                  {bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2.5 text-[14px] text-gray-700">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="mt-1 text-[#3B82F6] shrink-0" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Reveal>
          <Reveal delay={120}>
            <div>{mockup}</div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────── mockup: Kanban ─────────────────────────── */

function KanbanMockup() {
  // Stripe color per stage — mirrors the live `STAGE_STRIPE_CLASS` palette
  // from utils/stageStyles.ts. Used here as the left-edge 3px stripe on each
  // card so the landing mock matches the in-app card design.
  const STRIPE: Record<string, string> = {
    Drafting: "bg-slate-500",
    Applied: "bg-blue-500",
    OA: "bg-amber-500",
    Interview: "bg-purple-500",
  };
  const cols: Array<{ stage: keyof typeof STAGE_CHIP; cards: { co: string; ro: string }[]; tone: string; hidden?: boolean }> = [
    { stage: "Drafting", tone: "border-slate-200 bg-slate-50/40", cards: [{ co: "Anthropic", ro: "Research Intern" }, { co: "Notion", ro: "Frontend Intern" }] },
    { stage: "Applied", tone: "border-blue-200 bg-blue-50/40", cards: [{ co: "Linear", ro: "Product Eng" }, { co: "Figma", ro: "SWE Intern" }, { co: "Loom", ro: "Backend" }] },
    { stage: "OA", tone: "border-amber-200 bg-amber-50/40", cards: [{ co: "Vercel", ro: "Frontend" }], hidden: true },
    { stage: "Interview", tone: "border-purple-200 bg-purple-50/40", cards: [{ co: "Stripe", ro: "Backend" }], hidden: true },
  ];
  return (
    <div className="rounded-xl overflow-hidden border border-gray-200 bg-white shadow-[0_20px_60px_-25px_rgba(15,23,42,0.3)] p-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {cols.map((c) => (
          <div key={c.stage} className={`rounded-lg border ${c.tone} p-2 ${c.hidden ? "hidden sm:block" : ""}`}>
            <div className="flex items-center justify-between mb-2 px-1">
              <StageChip stage={c.stage} />
              <span className="text-[10px] font-semibold text-gray-500">{c.cards.length}</span>
            </div>
            <div className="space-y-1.5">
              {c.cards.map((card, i) => (
                <div
                  key={card.co}
                  className={`relative overflow-hidden rounded-md bg-white border border-gray-200 p-2 pl-2.5 ${c.stage === "Drafting" && i === 0 ? "ring-2 ring-[#3B82F6] ring-offset-1" : ""}`}
                >
                  {/* Left-edge stage stripe — matches the in-app card design. */}
                  <span aria-hidden className={`absolute left-0 top-0 bottom-0 w-[3px] ${STRIPE[c.stage] ?? "bg-slate-400"}`} />
                  <div className="text-[11px] font-semibold text-gray-900 truncate">{card.co}</div>
                  <div className="text-[10px] text-gray-500 truncate">{card.ro}</div>
                  {c.stage === "Drafting" && i === 0 && (
                    <div className="mt-1.5 flex items-center gap-1 text-[9px] text-[#1E3A8A] font-medium">
                      <BrandLogo size={10} />
                      Open in Tailor →
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────── mockup: Tailor ─────────────────────────── */

function TailorMockup() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-3">
      <div className="rounded-xl border border-gray-200 bg-white shadow-[0_20px_60px_-25px_rgba(15,23,42,0.3)] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50/60">
          <div className="flex items-center gap-2">
            <BrandLogo size={18} />
            <span className="text-sm font-semibold text-gray-900">Tailoring · Backend SWE @ Stripe</span>
          </div>
          <span className="text-[10px] font-medium text-emerald-600 inline-flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />Analysis complete
          </span>
        </div>
        <div className="divide-y divide-gray-100">
          {[
            { tag: "EXPERIENCE", kind: "REWRITE", target: "Stripe-internal API gateway", strike: "Built a service to handle internal requests across our backend.", rewrite: "Architected a multi-tenant API gateway in Go handling 8k RPS across 14 internal services, cutting p95 latency from 480 ms → 95 ms.", rationale: "Mirrors the JD's emphasis on distributed systems and quantifies impact." },
            { tag: "SKILLS", kind: "ADD", strike: "", rewrite: "Add: gRPC · Postgres replication · OpenTelemetry", rationale: "Directly requested in the JD; you list these on your projects." },
          ].map((s, i) => (
            <div key={i} className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-bold tracking-wider text-gray-500">{s.tag}</span>
                <span className="text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded bg-[#3B82F6]/10 text-[#1E3A8A]">{s.kind}</span>
                {s.target && <span className="text-[11px] text-gray-500 truncate">→ {s.target}</span>}
                <div className="ml-auto flex flex-wrap gap-1.5">
                  <button className="px-2 py-1 text-[11px] font-medium rounded border border-gray-200 text-gray-700 hover:bg-gray-50">Reject</button>
                  <button className="px-2 py-1 text-[11px] font-medium rounded text-white bg-gray-900 hover:bg-gray-800">Accept</button>
                </div>
              </div>
              {s.strike && <p className="text-[12px] text-gray-400 line-through mb-1">{s.strike}</p>}
              <p className="text-[13px] text-gray-900 leading-relaxed">{s.rewrite}</p>
              <p className="text-[11px] text-gray-500 italic mt-2"><span className="not-italic font-semibold text-gray-600 mr-1">Why:</span>{s.rationale}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-xl border border-gray-200 bg-white shadow-[0_20px_60px_-25px_rgba(15,23,42,0.3)] p-4 self-start">
        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2">Fit</div>
        <div className="flex items-end gap-3">
          <div className="w-12 h-12 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center text-2xl font-black">A</div>
          <div>
            <div className="text-2xl font-bold text-gray-900 leading-none">4<span className="text-base text-gray-400"> / 5</span></div>
            <div className="text-[11px] text-gray-500 mt-0.5">A-grade match</div>
          </div>
        </div>
        <div className="mt-4 text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">Matched</div>
        <div className="flex flex-wrap gap-1">
          {["Go", "gRPC", "Distributed systems", "Postgres"].map((s) => (
            <span key={s} className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200">{s}</span>
          ))}
        </div>
        <div className="mt-3 text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">Gaps</div>
        <div className="flex flex-wrap gap-1">
          {["Kafka", "Kubernetes"].map((s) => (
            <span key={s} className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200">{s}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── mockup: stage suggestions ─────────────────────────── */

function StageSuggestionsMockup() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-[0_20px_60px_-25px_rgba(15,23,42,0.3)] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50/60">
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-[#3B82F6]"><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z" strokeLinecap="round" strokeLinejoin="round"/></svg>
          <span className="text-sm font-semibold text-gray-900">Stage suggestions from email</span>
        </div>
        <span className="text-[10px] text-gray-500">3 pending</span>
      </div>
      <ul className="divide-y divide-gray-100">
        {[
          { tone: "purple", label: "Interview", title: "Interview invite: Stripe", body: "Detected interview invite for \"Backend SWE\" at Stripe. Stage updated to Interview." },
          { tone: "red", label: "Rejection", title: "Rejection: Vercel", body: "We've decided to move forward with other candidates." },
          { tone: "emerald", label: "Offer", title: "Offer: Linear", body: "Offer letter attached. Stage updated to Offer." },
        ].map((n, i) => (
          <li key={i} className="px-4 py-3 flex items-start gap-3">
            <span className={`shrink-0 mt-0.5 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
              n.tone === "purple" ? "bg-purple-100 text-purple-800" :
              n.tone === "red" ? "bg-red-100 text-red-800" :
              "bg-emerald-100 text-emerald-800"
            }`}>{n.label}</span>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium text-gray-900 truncate">{n.title}</div>
              <div className="text-[11px] text-gray-500 line-clamp-2">{n.body}</div>
              <div className="text-[10px] text-gray-400 mt-0.5">via gmail · just now</div>
            </div>
            <div className="flex gap-1 shrink-0">
              <button className="px-2 py-1 text-[10px] font-medium rounded border border-gray-200 text-gray-700 hover:bg-gray-50">Revert</button>
              <button className="px-2 py-1 text-[10px] font-medium rounded text-white bg-[#3B82F6] hover:bg-[#3071dc]">Confirm</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ─────────────────────────── mockup: extension popover ─────────────────────────── */

function ExtensionPopoverMockup() {
  return (
    <div className="relative rounded-xl overflow-hidden border border-gray-200 bg-white shadow-[0_20px_60px_-25px_rgba(15,23,42,0.3)]">
      <div className="p-5 bg-gradient-to-br from-gray-50 to-white">
        <div className="flex items-center gap-2 mb-3">
          <img src="/linkedin-svgrepo-com.svg" alt="LinkedIn" className="w-6 h-6 object-contain" />
          <div className="text-[11px] text-gray-500">linkedin.com / jobs</div>
        </div>
        <div className="text-base font-bold text-gray-900">Backend Software Engineer Intern</div>
        <div className="text-[12px] text-gray-500 mb-3">Stripe · San Francisco, CA (Hybrid)</div>
        <div className="space-y-1.5">
          <div className="h-2 bg-gray-100 rounded w-full" />
          <div className="h-2 bg-gray-100 rounded w-5/6" />
          <div className="h-2 bg-gray-100 rounded w-11/12" />
          <div className="h-2 bg-gray-100 rounded w-3/4" />
        </div>
      </div>
      {/* FAB button — always visible */}
      <div className="absolute right-0 top-12 w-9 h-9 rounded-l-xl bg-gradient-to-br from-[#3B82F6] to-[#1E3A8A] flex items-center justify-center shadow-[0_8px_24px_-6px_rgba(59,130,246,0.55)]">
        <BrandLogo size={18} />
      </div>
      {/* Popover — hidden on small screens to prevent overflow */}
      <div className="hidden sm:block absolute right-12 top-8 w-[260px] rounded-xl bg-white shadow-[0_20px_50px_-15px_rgba(15,23,42,0.35)] border border-gray-200 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-gray-100 flex items-center gap-2">
          <BrandLogo size={16} />
          <span className="text-[12px] font-semibold text-gray-900">HireTrail</span>
          <span className="ml-auto text-[10px] text-gray-400">JD detected</span>
        </div>
        <div className="p-3 space-y-2">
          <button className="w-full text-left rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 px-3 py-2.5 transition-colors">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 11l3 3 8-8"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-semibold text-gray-900">Track this JD</div>
                <div className="text-[10px] text-gray-500">Save as Applied · 1 click</div>
              </div>
            </div>
          </button>
          <button className="w-full text-left rounded-lg border-2 border-[#3B82F6]/30 bg-[#3B82F6]/5 hover:bg-[#3B82F6]/10 px-3 py-2.5 transition-colors">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-md bg-gradient-to-br from-[#3B82F6] to-[#1E3A8A] text-white flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.4 7.4H22l-6.2 4.5L18.2 22 12 17.5 5.8 22l2.4-8.1L2 9.4h7.6L12 2z"/></svg>
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-semibold text-gray-900">Tailor with AI</div>
                <div className="text-[10px] text-gray-500">Bullets · skills · fit score · PDF</div>
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── mockup: Resume performance + tailored tree ─────────────────────────── */

function ResumesMockup() {
  // Per-resume metrics chip — mirrors the in-app `<MetricChip>` styling
  // (light bg + dark text per stage tone). Same palette as the funnel.
  const Chip = ({ label, value, tone }: { label: string; value: string; tone: "blue" | "amber" | "purple" | "emerald" }) => {
    const cls = {
      blue: "bg-blue-50 text-blue-700",
      amber: "bg-amber-50 text-amber-700",
      purple: "bg-purple-50 text-purple-700",
      emerald: "bg-emerald-50 text-emerald-700",
    }[tone];
    return (
      <span className={`inline-flex items-baseline gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium tabular-nums ${cls}`}>
        <span className="text-[9px] uppercase tracking-wider opacity-70">{label}</span>
        <span className="font-semibold">{value}</span>
      </span>
    );
  };
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-[0_20px_60px_-25px_rgba(15,23,42,0.3)] overflow-hidden">
      {/* Primary resume hero */}
      <div className="px-4 py-3 border-b border-gray-200 bg-emerald-50/50">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">★ Primary</span>
          <span className="text-[13px] font-semibold text-gray-900 truncate">SWE Resume v3 — Backend Focus</span>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <Chip label="Resp" value="64%" tone="blue" />
          <Chip label="OA"   value="44%" tone="amber" />
          <Chip label="Int"  value="31%" tone="purple" />
          <Chip label="Off"  value="8%"  tone="emerald" />
        </div>
      </div>
      {/* Two more resumes with weaker metrics */}
      <div className="divide-y divide-gray-100">
        {[
          { name: "ML Resume", role: "Machine Learning", resp: "57%", oa: "32%", int: "21%", off: "9%" },
          { name: "Frontend Focus Resume", role: "Frontend", resp: "51%", oa: "38%", int: "27%", off: "11%" },
        ].map((r) => (
          <div key={r.name} className="px-4 py-3">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="min-w-0">
                <div className="text-[12px] font-semibold text-gray-900 truncate">{r.name}</div>
                <div className="text-[10px] text-gray-500">{r.role}</div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <Chip label="Resp" value={r.resp} tone="blue" />
              <Chip label="OA"   value={r.oa}   tone="amber" />
              <Chip label="Int"  value={r.int}  tone="purple" />
              <Chip label="Off"  value={r.off}  tone="emerald" />
            </div>
          </div>
        ))}
      </div>
      {/* Tailored variants tree */}
      <div className="px-4 py-3 border-t border-gray-200 bg-gray-50/40">
        <div className="flex items-center gap-2 mb-2">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-gray-500"><polyline points="9 6 15 12 9 18"/></svg>
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-600">Tailored variants</span>
          <span className="ml-auto text-[10px] text-gray-500">2 from this base</span>
        </div>
        <div className="border-l-2 border-[#3B82F6]/30 pl-3 space-y-1.5">
          <div className="rounded-md border border-gray-200 bg-white px-2.5 py-1.5">
            <div className="text-[11px] font-medium text-gray-900 truncate">Tailored — Stripe / Backend SWE</div>
            <div className="text-[10px] text-gray-500">Generated 3 days ago · 1 application</div>
          </div>
          <div className="rounded-md border border-gray-200 bg-white px-2.5 py-1.5">
            <div className="text-[11px] font-medium text-gray-900 truncate">Tailored — Vercel / Frontend</div>
            <div className="text-[10px] text-gray-500">Generated 6 days ago · 1 application</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── FeatureShowcase (default export) ─────────────────────────── */

export default function FeatureShowcase() {
  return (
    <>
      <FeatureSection
        number="01"
        eyebrow="The funnel that fits reality"
        title="Resumes-in-progress finally have a home."
        body="Every other tracker forces you to mark a job 'Applied' the second you save it. HireTrail introduces a Drafting stage — for when the resume is tailored but you haven't hit Apply yet. The whole flow becomes one continuous funnel."
        bullets={[
          "Drafting cards link straight to their tailor session",
          "Auto-transitions to Applied when you click Apply on the JD",
          "Excluded from response-rate analytics so the numbers stay honest",
        ]}
        mockup={<KanbanMockup />}
      />
      <FeatureSection
        number="02"
        eyebrow="Targeted tailoring"
        title="Rewrites your bullets. Won't invent your experience."
        body="HireTrail compares the JD to your structured master profile and suggests specific rewrites — line by line, with the reasoning. The AI never adds a project you don't have or a skill you've never used."
        bullets={[
          "Suggestion-level Accept / Reject — keep the bullets you like",
          "A–F fit score with matched skills + concrete gaps",
          "Renders a real one-page PDF when you're done",
        ]}
        mockup={<TailorMockup />}
        reverse
        tone="muted"
      />
      <FeatureSection
        number="03"
        eyebrow="Zero manual maintenance"
        title="The recruiter replies. Your tracker updates."
        body="The Gmail integration reads recent messages, classifies interview invites, rejections, and offers, and moves the relevant card automatically. A toast asks you to Confirm or Revert — one click, you're done."
        bullets={[
          "Read-only Gmail scope · refresh tokens encrypted at rest",
          "Outlook supported too",
          "Every stage move is reversible from the dashboard",
        ]}
        mockup={<StageSuggestionsMockup />}
      />
      <FeatureSection
        number="04"
        eyebrow="Works where you apply"
        title="One button on every job board."
        body="Click the extension on LinkedIn, Indeed, Greenhouse, Lever, Glassdoor, or Workday. Track in one click, or kick off a tailored resume. The popover knows what page you're on and what to do."
        bullets={[
          "Auto-detects when you click Apply — no double-bookkeeping",
          "Manifest V3 · works in any Chromium browser",
          "No autofill — recruiters can't tell you're using us",
        ]}
        mockup={<ExtensionPopoverMockup />}
        reverse
        tone="muted"
      />
      <FeatureSection
        number="05"
        eyebrow="Know which resume is working"
        title="Stop guessing which version gets responses."
        body="Every resume carries its own funnel — response rate, OA rate, interview rate, offer rate — computed from your actual application history. Tailored variants nest under their source resume so the lineage is always clear."
        bullets={[
          "Per-resume metrics computed from real stage history, not just current stage",
          "Tailored variants grouped under their base — see what the AI changed and how it performed",
          "Version timeline on every card: every rename, retag, file replace is tracked",
        ]}
        mockup={<ResumesMockup />}
      />
    </>
  );
}
