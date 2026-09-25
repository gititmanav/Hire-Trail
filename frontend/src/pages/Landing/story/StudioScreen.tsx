/** Act 1 — Resume Studio: the gap (the posting's keywords light up), align
 *  (the missing ones are chosen), review (bullets rewrite, the match score
 *  climbs). Marked parts (`data-lp`) are driven by StoryScene. Copy follows
 *  the product's rule: the rewrite reuses the resume's own facts — every
 *  number in an "after" bullet is already in its "before". */
import { ArrowRight, Check, Plus } from "lucide-react";
import { AppShell } from "./shell.tsx";

export const STUDIO_KEYWORDS = ["React", "TypeScript", "design systems", "accessibility", "performance"] as const;
/** Which keywords the resume already covers before the rewrite. */
export const MATCHED_BEFORE = new Set(["React", "TypeScript"]);

export const STUDIO_BULLETS = [
  {
    before: "Worked on the React component library and fixed a11y bugs in 40 components.",
    after: "Improved accessibility across 40 design-system components in React.",
  },
  {
    before: "Sped up the analytics dashboard with code-splitting — pages load 38% quicker.",
    after: "Improved dashboard performance with code-splitting, cutting load time by 38%.",
  },
  {
    before: "Helped build the new checkout flow in React with the design team.",
    after: "Partnered with design to build the new checkout flow in React.",
  },
] as const;

/** The gauge's geometry — MatchScoreGauge's ring (r 46, stroke 9). */
export const GAUGE_R = 46;
export const GAUGE_CIRC = 2 * Math.PI * GAUGE_R;

function Keyword({ i, children }: { i: number; children: string }) {
  return (
    <mark
      data-lp={`kw-${i}`}
      className="lp-kw rounded-[3px] px-[2px] -mx-[2px] text-foreground"
    >
      {children}
    </mark>
  );
}

export default function StudioScreen() {
  return (
    <AppShell active="Resume Studio">
      <div className="h-14 px-5 flex items-center gap-3 border-b border-border">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="text-base font-semibold text-foreground">Resume Studio</span>
          <span className="text-[13px] text-muted-foreground">Senior Frontend Engineer · Stripe</span>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          {["See the gap", "Align", "Review"].map((label, i) => (
            <span key={label} className="flex items-center gap-1.5">
              <span data-lp={`step-${i}`} data-state={i === 0 ? "active" : "todo"} className="lp-step inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[12.5px] font-medium">
                <span className="lp-step-dot w-[18px] h-[18px] rounded-full text-[10.5px] font-semibold flex items-center justify-center tabular-nums">{i + 1}</span>
                {label}
              </span>
              {i < 2 && <ArrowRight size={14} className="text-muted-foreground/50" />}
            </span>
          ))}
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 top-14 p-5 grid grid-cols-[316px_1fr] gap-5">
        {/* The posting */}
        <div className="rounded-xl border border-border bg-card shadow-panel p-4 flex flex-col min-h-0">
          <p className="text-[13px] font-semibold text-foreground">Job description</p>
          <p className="text-[12px] text-muted-foreground mt-0.5">Stripe · Senior Frontend Engineer · Remote</p>
          <div className="mt-3 text-[12.5px] leading-[1.65] text-foreground/85 space-y-2.5">
            <p>
              We&rsquo;re looking for a frontend engineer to build the interfaces millions of businesses use every day.
              You&rsquo;ll work in <Keyword i={0}>React</Keyword> and <Keyword i={1}>TypeScript</Keyword>, help evolve
              our <Keyword i={2}>design systems</Keyword>, and hold a high bar for{" "}
              <Keyword i={3}>accessibility</Keyword> and <Keyword i={4}>performance</Keyword>.
            </p>
            <p>You&rsquo;ve shipped product alongside designers, you care about craft, and you write code others enjoy reading.</p>
          </div>
          <div className="mt-auto pt-4">
            <p className="text-[10.5px] uppercase tracking-wider font-bold text-muted-foreground mb-2">What the role asks for</p>
            <div className="flex flex-wrap gap-1.5">
              {STUDIO_KEYWORDS.map((k, i) => (
                <span key={k} data-lp={`chip-${i}`} className="lp-chip relative inline-grid">
                  {MATCHED_BEFORE.has(k) ? (
                    <span className="lp-chip-face inline-flex items-center gap-1 h-6 px-2 rounded-md text-[11.5px] font-medium border bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800/50">
                      <Check size={11} strokeWidth={2.6} /> {k}
                    </span>
                  ) : (
                    <>
                      <span data-lp={`chip-${i}-off`} className="lp-chip-face inline-flex items-center gap-1 h-6 px-2 rounded-md text-[11.5px] font-medium border border-dashed border-border text-muted-foreground bg-background">
                        <Plus size={11} strokeWidth={2.6} /> {k}
                      </span>
                      <span data-lp={`chip-${i}-on`} className="lp-chip-face inline-flex items-center gap-1 h-6 px-2 rounded-md text-[11.5px] font-medium border bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800/50" style={{ opacity: 0 }}>
                        <Check size={11} strokeWidth={2.6} /> {k}
                      </span>
                    </>
                  )}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* The resume, and its score */}
        <div className="relative rounded-xl border border-border bg-muted/70 overflow-hidden">
          <div className="absolute left-6 top-6 w-[350px] bg-paper text-[#1a1a1a] shadow-floating rounded-[3px] px-7 pt-6 pb-8">
            <p className="text-[19px] font-bold tracking-[-0.01em] text-[#111]">Alex Rivera</p>
            <p className="text-[9.5px] text-[#666] mt-0.5">alex.rivera@email.com · linkedin.com/in/alexrivera · New York, NY</p>
            <p className="mt-4 text-[9.5px] font-bold uppercase tracking-[0.12em] text-[#111] pb-1 border-b border-[#ddd]">Experience</p>
            <div className="mt-2">
              <div className="flex items-baseline justify-between">
                <p className="text-[11px] font-semibold text-[#111]">Frontend Engineer · Lumen Labs</p>
                <p className="text-[9.5px] text-[#666]">2022 – Present</p>
              </div>
              <ul className="mt-1.5 space-y-1.5">
                {STUDIO_BULLETS.map((b, i) => (
                  <li key={i} className="flex gap-1.5 text-[10.5px] leading-[1.5] text-[#222]">
                    <span className="shrink-0 mt-[1px]">•</span>
                    <span className="grid">
                      <span data-lp={`b${i}-old`} className="[grid-area:1/1]">{b.before}</span>
                      <span data-lp={`b${i}-new`} className="[grid-area:1/1]" style={{ opacity: 0 }}>
                        <span data-lp={`b${i}-mark`} className="lp-changed">{b.after}</span>
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-3">
              <div className="flex items-baseline justify-between">
                <p className="text-[11px] font-semibold text-[#111]">Software Engineer · Northwind</p>
                <p className="text-[9.5px] text-[#666]">2020 – 2022</p>
              </div>
              <ul className="mt-1.5 space-y-1.5">
                <li className="flex gap-1.5 text-[10.5px] leading-[1.5] text-[#222]"><span>•</span><span>Built internal tools in Vue and Node.js used by 200 support agents.</span></li>
                <li className="flex gap-1.5 text-[10.5px] leading-[1.5] text-[#222]"><span>•</span><span>Moved the test suite to Jest, taking CI from 22 minutes to 9.</span></li>
              </ul>
            </div>
            <p className="mt-4 text-[9.5px] font-bold uppercase tracking-[0.12em] text-[#111] pb-1 border-b border-[#ddd]">Skills</p>
            <p className="mt-1.5 text-[10.5px] text-[#222]">React, TypeScript, Vue, Node.js, GraphQL, Jest, Figma</p>
          </div>

          <div className="absolute right-[18px] top-6 w-[164px] rounded-xl border border-border bg-card shadow-panel p-4 flex flex-col items-center">
            <p className="text-[11px] font-medium text-muted-foreground">Match score</p>
            <div className="relative mt-2" style={{ width: 104, height: 104 }}>
              <svg width={104} height={104} viewBox="0 0 110 110" className="-rotate-90">
                <circle cx="55" cy="55" r={GAUGE_R} fill="none" strokeWidth="9" style={{ stroke: "hsl(var(--muted))" }} />
                <circle
                  data-lp="gauge-ring"
                  cx="55" cy="55" r={GAUGE_R} fill="none" strokeWidth="9" strokeLinecap="round"
                  strokeDasharray={GAUGE_CIRC}
                  strokeDashoffset={GAUGE_CIRC * (1 - 0.64)}
                  style={{ stroke: "rgb(var(--palette-amber-500))" }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span data-lp="gauge-num" className="text-[26px] font-bold tabular-nums text-foreground leading-none">6.4</span>
                <span className="text-[10px] font-medium text-muted-foreground mt-0.5">/ 10</span>
              </div>
            </div>
            <p data-lp="gauge-label" className="text-sm font-semibold mt-2" style={{ color: "rgb(var(--palette-amber-500))" }}>Good</p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
