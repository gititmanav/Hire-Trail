/** The phone story's screens: the same four beats as the desktop window, each
 *  recomposed for a narrow frame (360 × 468 under a 32px browser bar) so its
 *  subject stays readable at phone scale — not the desktop screens shrunk.
 *  Built from the app's own tokens and pieces (the list's group strips, the
 *  inbox review card, the Personalize cards, the Studio gauge, the
 *  extension's panel). Marked parts (`data-lp`) are driven by MobileStory.
 *  Decorative: the device is aria-hidden and inert. */
import { ArrowLeft, Check, ChevronRight, Copy, Lock, Mail, Plus, Search, Sparkles } from "lucide-react";
import { STAGE_STRIPE_CLASS } from "../../../../utils/stageStyles.ts";
import { HEALTH_DOT_CLASS } from "../../../../utils/applicationHealth.ts";
import { GAUGE_CIRC, GAUGE_R, MATCHED_BEFORE, STUDIO_BULLETS, STUDIO_KEYWORDS } from "../StudioScreen.tsx";
import { BookmarkIcon, Glyph } from "../PostingScreen.tsx";
import { CUSTOM_PREVIEW, MODES, ShellPreview } from "../SettingsScreen.tsx";

/** One list row's height, and the moving row's travel unit. */
export const M_ROW_H = 52;
/** The theme preview's design height (the frame's width is DEVICE_W). */
export const M_PREVIEW_H = 268;

/** The narrow frame's browser bar (32px). */
export function MiniBar({ url, dark }: { url: string; dark?: boolean }) {
  return (
    <div className={`absolute inset-x-0 top-0 h-8 flex items-center gap-2 px-3 border-b ${dark ? "bg-[#1f1f1f] border-white/[0.06]" : "bg-[#f3f3f3] border-black/[0.06]"}`}>
      <div className="w-[34px] flex items-center gap-[5px]">
        {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
          <span key={c} className="w-2 h-2 rounded-full" style={{ background: c, opacity: 0.9 }} />
        ))}
      </div>
      <div className={`flex-1 min-w-0 flex items-center justify-center gap-1.5 h-5 px-2 rounded-md text-[10.5px] ${dark ? "bg-white/[0.07] text-white/70" : "bg-black/[0.045] text-black/60"}`}>
        <Lock size={9} strokeWidth={2.4} className="shrink-0 opacity-60" />
        <span data-lp="m-url" className="truncate tracking-[-0.01em]">{url}</span>
      </div>
      <div className="w-[34px]" />
    </div>
  );
}

function ScreenHeader({ children }: { children: React.ReactNode }) {
  return <div className="h-12 shrink-0 px-4 flex items-center gap-2 bg-sidebar border-b border-border">{children}</div>;
}

/* ─── Tailor — Resume Studio ─── */

const CHIP = "inline-flex items-center gap-1 h-7 px-2.5 rounded-lg text-[12.5px] font-medium border";
const CHIP_ON = `${CHIP} bg-emerald-50 text-emerald-700 border-emerald-200`;

export function MStudio() {
  return (
    <div className="absolute inset-0 flex flex-col bg-background text-foreground">
      <ScreenHeader>
        <div className="flex-1 flex items-center justify-center gap-0.5">
          {["See the gap", "Align", "Review"].map((label, i) => (
            <span key={label} className="flex items-center gap-0.5">
              <span data-lp={`m-step-${i}`} data-state={i === 0 ? "active" : "todo"} className="lp-step inline-flex items-center gap-1.5 h-8 px-2 rounded-lg text-[12.5px] font-medium">
                <span className="lp-step-dot w-[18px] h-[18px] rounded-full text-[10.5px] font-semibold flex items-center justify-center tabular-nums">{i + 1}</span>
                {label}
              </span>
              {i < 2 && <ChevronRight size={13} className="text-muted-foreground/50" />}
            </span>
          ))}
        </div>
      </ScreenHeader>

      <div className="flex-1 min-h-0 flex flex-col gap-2.5 px-3 pt-3">
        <div className="shrink-0 rounded-xl border border-border bg-card shadow-panel px-3.5 py-2.5 flex items-center gap-3.5">
          <div className="relative shrink-0" style={{ width: 54, height: 54 }}>
            <svg width={54} height={54} viewBox="0 0 110 110" className="-rotate-90">
              <circle cx="55" cy="55" r={GAUGE_R} fill="none" strokeWidth="11" style={{ stroke: "hsl(var(--muted))" }} />
              <circle
                data-lp="m-gauge-ring"
                cx="55" cy="55" r={GAUGE_R} fill="none" strokeWidth="11" strokeLinecap="round"
                strokeDasharray={GAUGE_CIRC}
                strokeDashoffset={GAUGE_CIRC * (1 - 0.64)}
                style={{ stroke: "rgb(var(--palette-amber-500))" }}
              />
            </svg>
            <span data-lp="m-gauge-num" className="absolute inset-0 flex items-center justify-center text-[16px] font-bold tabular-nums">6.4</span>
          </div>
          <div className="min-w-0">
            <p className="text-[11.5px] text-muted-foreground">Match score · Stripe</p>
            <p className="text-[13.5px] font-semibold truncate">Senior Frontend Engineer</p>
          </div>
          <p data-lp="m-gauge-label" className="ml-auto text-[13px] font-semibold" style={{ color: "rgb(var(--palette-amber-500))" }}>Good</p>
        </div>

        <div className="shrink-0 rounded-xl border border-border bg-card shadow-panel px-3.5 py-3">
          <p className="text-[10.5px] uppercase tracking-wider font-bold text-muted-foreground">What the role asks for</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {STUDIO_KEYWORDS.map((k, i) =>
              MATCHED_BEFORE.has(k) ? (
                <span key={k} className={CHIP_ON}><Check size={12} strokeWidth={2.6} /> {k}</span>
              ) : (
                <span key={k} className="relative inline-grid">
                  <span data-lp={`m-chip-${i}-off`} className={`lp-gap-chip [grid-area:1/1] ${CHIP} border-dashed border-border text-muted-foreground bg-background`}>
                    <Plus size={12} strokeWidth={2.6} /> {k}
                  </span>
                  <span data-lp={`m-chip-${i}-on`} className={`[grid-area:1/1] ${CHIP_ON}`} style={{ opacity: 0 }}>
                    <Check size={12} strokeWidth={2.6} /> {k}
                  </span>
                </span>
              ),
            )}
          </div>
        </div>

        {/* The resume page, running off the bottom of the frame. */}
        <div className="flex-1 min-h-0 rounded-t-[4px] bg-paper text-[#1a1a1a] shadow-floating px-4 pt-3.5 overflow-hidden">
          <p className="text-[15px] font-bold tracking-[-0.01em] text-[#111]">Alex Rivera</p>
          <div className="mt-0.5 flex items-baseline justify-between text-[10.5px] text-[#666]">
            <span>Frontend Engineer · Lumen Labs</span>
            <span>2022 – Present</span>
          </div>
          <ul className="mt-2.5 space-y-2">
            {STUDIO_BULLETS.map((b, i) => (
              <li key={i} className="flex gap-1.5 text-[12px] leading-[1.45] text-[#222]">
                <span className="shrink-0">•</span>
                <span className="grid">
                  <span data-lp={`m-b${i}-old`} className="[grid-area:1/1]">{b.before}</span>
                  <span data-lp={`m-b${i}-new`} className="[grid-area:1/1]" style={{ opacity: 0 }}>
                    <span data-lp={`m-b${i}-mark`} className="lp-changed">{b.after}</span>
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/* ─── Apply — a posting, and the extension's edge tab and panel ─── */

export function MApply() {
  return (
    <div className="absolute inset-0 bg-white text-[#1d1d1f] overflow-hidden">
      <div className="h-12 px-4 flex items-center justify-between border-b border-black/[0.07]">
        <span className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-md bg-[#1d1d1f] text-white text-[12px] font-bold flex items-center justify-center">S</span>
          <span className="text-[14px] font-semibold">Stripe</span>
        </span>
        <span className="text-[12px] text-black/45 mr-7">All open roles</span>
      </div>
      <div className="px-4 pt-4">
        <p className="text-[21px] font-bold tracking-[-0.025em] leading-tight">Senior Frontend Engineer</p>
        <p className="mt-1 text-[12.5px] text-black/50">Remote · Full-time · $180k – $220k</p>
        <span className="mt-3.5 inline-flex h-9 px-4 rounded-lg bg-[#1d1d1f] text-white text-[13px] font-semibold items-center">Apply for this job</span>
        <div className="mt-5 space-y-3 [mask-image:linear-gradient(to_bottom,#000_40%,transparent)]">
          <p className="text-[13.5px] font-semibold">About the role</p>
          <p className="text-[12.5px] leading-[1.65] text-black/60">
            Build the interfaces millions of businesses use to run their companies — in React and TypeScript, with a high bar for accessibility and performance.
          </p>
          <p className="text-[13.5px] font-semibold">What you&rsquo;ll do</p>
          <p className="text-[12.5px] leading-[1.65] text-black/60">Ship product with designers and engineers, from first sketch to launch.</p>
        </div>
      </div>

      {/* The extension's edge tab */}
      <span data-lp="m-ext-tab" className="absolute right-0 top-[58px] w-[30px] h-[42px] rounded-l-xl bg-white border border-r-0 border-black/10 shadow-[0_8px_24px_-8px_rgba(15,23,42,0.35)] flex items-center justify-center">
        <span className="w-5 h-5 rounded-[5px] text-white text-[10px] font-bold flex items-center justify-center" style={{ background: "linear-gradient(135deg,#3B82F6,#1E3A8A)" }}>H</span>
        <span data-lp="m-ext-tab-ring" className="absolute inset-[-4px] rounded-l-[14px] border-2 border-[#3B82F6]" style={{ opacity: 0 }} />
      </span>

      {/* The extension's panel, opening from the tab */}
      <div
        data-lp="m-ext-panel"
        className="absolute right-[38px] top-[34px] w-[282px] rounded-[14px] bg-white border border-black/[0.08] shadow-[0_28px_70px_-24px_rgba(15,23,42,0.5),0_2px_8px_rgba(15,23,42,0.08)] overflow-hidden"
        style={{ opacity: 0 }}
      >
        <div className="h-10 px-3 flex items-center justify-between border-b border-black/[0.06]">
          <span className="flex items-center gap-2 text-[13px] font-semibold">
            <span className="w-5 h-5 rounded-[5px] text-white text-[10px] font-bold flex items-center justify-center" style={{ background: "linear-gradient(135deg,#3B82F6,#1E3A8A)" }}>H</span>
            HireTrail
          </span>
          <span className="text-[10.5px] px-2 py-0.5 rounded-full bg-black/[0.04] text-black/50">boards.greenhouse.io</span>
        </div>
        <div data-lp="m-ext-detected" className="mx-2.5 mt-2.5 rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2" style={{ opacity: 0 }}>
          <p className="flex items-center gap-1 text-[10.5px] font-semibold text-emerald-700"><Check size={11} strokeWidth={3} /> Detected on this page</p>
          <p className="mt-0.5 text-[13px] font-semibold">Senior Frontend Engineer</p>
          <p className="text-[11.5px] text-black/50">Stripe · Remote</p>
        </div>
        <div className="p-1.5">
          <div data-lp="m-ext-track" className="flex items-center gap-3 h-12 px-2 rounded-lg">
            <Glyph gradient="linear-gradient(135deg,#3B82F6,#1E3A8A)"><BookmarkIcon /></Glyph>
            <span className="flex-1 text-[13.5px] font-semibold">Track this job</span>
            <ChevronRight size={14} className="text-black/30" />
          </div>
          <div className="mx-2 h-px bg-black/[0.06]" />
          <div className="flex items-center gap-3 h-12 px-2 rounded-lg">
            <Glyph gradient="linear-gradient(135deg,#8b5cf6,#6366f1)"><Sparkles size={16} fill="currentColor" strokeWidth={0} /></Glyph>
            <span className="flex-1 text-[13.5px] font-semibold">Tailor with AI</span>
            <ChevronRight size={14} className="text-black/30" />
          </div>
          <div className="mx-2 h-px bg-black/[0.06]" />
          <div className="flex items-center gap-3 h-12 px-2 rounded-lg">
            <Glyph gradient="linear-gradient(135deg,#0ea5e9,#0369a1)"><Copy size={15} strokeWidth={2} /></Glyph>
            <span className="flex-1 text-[13.5px] font-semibold">Copy JD</span>
            <ChevronRight size={14} className="text-black/30" />
          </div>
        </div>
        <div data-lp="m-ext-status" className="mx-2.5 mb-2.5 rounded-lg bg-emerald-600 text-white px-3 py-2 text-[12.5px] font-semibold flex items-center gap-2" style={{ opacity: 0 }}>
          <span className="w-4 h-4 rounded-full bg-white/25 flex items-center justify-center"><Check size={10} strokeWidth={3.5} /></span>
          Tracked! Saved to Applied
        </div>
      </div>
    </div>
  );
}

/* ─── Track — the inbox, the merge, the move ─── */

type ListStage = "Applied" | "Interview";

function Strip({ stage, count, lp }: { stage: ListStage; count: number; lp?: string }) {
  return (
    <div className="h-8 px-4 flex items-center gap-2 bg-sidebar border-y border-border/60">
      <span className={`w-2 h-2 rounded-full ${STAGE_STRIPE_CLASS[stage]}`} />
      <span className="text-[12px] font-semibold text-foreground">{stage}</span>
      <span data-lp={lp} className="text-[12px] text-muted-foreground tabular-nums">{count}</span>
    </div>
  );
}

interface RowData { company: string; role: string; age: string; health: keyof typeof HEALTH_DOT_CLASS }

function Row({ company, role, age, health }: RowData) {
  return (
    <div className="h-[52px] px-4 flex items-center gap-3 bg-background">
      <span className="w-[30px] h-[30px] shrink-0 rounded-lg bg-control text-foreground text-[12.5px] font-bold flex items-center justify-center">{company[0]}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-[13.5px] font-semibold text-foreground truncate">{company}</span>
        <span className="block text-[12px] text-muted-foreground truncate">{role}</span>
      </span>
      <span className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground tabular-nums">
        <span className={`w-1.5 h-1.5 rounded-full ${HEALTH_DOT_CLASS[health]}`} />{age}
      </span>
    </div>
  );
}

const STRIPE_ROW: RowData = { company: "Stripe", role: "Senior Frontend Engineer", age: "Today", health: "fresh" };
const APPLIED_ROWS: RowData[] = [
  { company: "Linear", role: "Software Engineer, Web", age: "6d", health: "fresh" },
  { company: "Vercel", role: "Frontend Engineer", age: "12d", health: "warm" },
  { company: "Plaid", role: "Frontend Engineer", age: "15d", health: "warm" },
];
const INTERVIEW_ROWS: RowData[] = [
  { company: "Shopify", role: "Senior Developer", age: "3d", health: "fresh" },
  { company: "Duolingo", role: "Software Engineer", age: "8d", health: "warm" },
];

function ListHeader() {
  return (
    <ScreenHeader>
      <span className="text-[15px] font-semibold text-foreground">Applications</span>
      <span className="ml-auto inline-flex items-center gap-0.5 p-0.5 rounded-lg border border-border">
        {["List", "Board", "Calendar"].map((v, i) => (
          <span key={v} className={`h-6 px-2 inline-flex items-center rounded-md text-[12px] font-medium ${i === 0 ? "bg-control text-foreground" : "text-muted-foreground"}`}>{v}</span>
        ))}
      </span>
      <Search size={16} strokeWidth={1.8} className="text-muted-foreground" />
    </ScreenHeader>
  );
}

export function MTrack() {
  return (
    <div className="absolute inset-0 flex flex-col bg-background text-foreground">
      <ListHeader />

      {/* The inbox review card (EmailScanReview's candidate); it opens above
          the list and folds away once merged. */}
      <div data-lp="m-review-wrap" className="shrink-0 overflow-hidden" style={{ height: 0 }}>
        <div data-lp="m-review" className="px-3 pt-3 pb-3" style={{ opacity: 0 }}>
          <p className="mb-2 flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground"><Mail size={13} strokeWidth={2} /> From your inbox · 1 update</p>
          <div className="rounded-xl border border-border bg-card shadow-floating p-3.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[14.5px] font-semibold text-foreground">Stripe</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border bg-purple-50 text-purple-700 border-purple-200">Interview</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border border-amber-300 bg-amber-50 text-amber-700">Already tracked</span>
            </div>
            <p className="mt-1.5 text-[12.5px] font-medium text-foreground truncate">Interview invitation — Senior Frontend Engineer</p>
            <p className="mt-0.5 text-[12px] text-muted-foreground truncate">Hi Alex — we&rsquo;d love to set up a 30-minute call…</p>
            <div className="mt-3 flex items-center gap-2">
              <span data-lp="m-merge-btn" className="h-8 px-3 inline-flex items-center rounded-lg text-[12.5px] font-medium border border-amber-400 text-amber-700 bg-amber-50/50">Merge with existing</span>
              <span className="h-8 px-3 inline-flex items-center rounded-lg text-[12.5px] font-medium border border-border text-secondary-foreground">Skip</span>
            </div>
          </div>
        </div>
      </div>

      <div data-lp="m-list" className="relative flex-1 min-h-0 overflow-hidden">
        <Strip stage="Applied" count={8} lp="m-count-applied" />
        <div data-lp="m-slot-applied" style={{ height: M_ROW_H }} />
        {APPLIED_ROWS.map((r) => <Row key={r.company} {...r} />)}
        <Strip stage="Interview" count={2} lp="m-count-interview" />
        <div data-lp="m-slot-interview" style={{ height: 0 }} />
        {INTERVIEW_ROWS.map((r) => <Row key={r.company} {...r} />)}

        {/* The Stripe row sits above the list so it can travel between groups. */}
        <div data-lp="m-flyer" className="absolute inset-x-0 top-0" style={{ height: M_ROW_H }}>
          <div data-lp="m-flyer-row" className="relative h-full">
            <Row {...STRIPE_ROW} />
            <span className={`absolute left-0 top-2 bottom-2 w-[3px] rounded-r ${STAGE_STRIPE_CLASS.Applied}`} />
            <span data-lp="m-flyer-stripe" className={`absolute left-0 top-2 bottom-2 w-[3px] rounded-r ${STAGE_STRIPE_CLASS.Interview}`} style={{ opacity: 0 }} />
          </div>
        </div>
      </div>

      {/* The toast the app shows after a merge */}
      <div data-lp="m-toast" className="absolute left-1/2 top-[58px] flex items-center gap-2.5 px-3 py-2.5 rounded-[10px] bg-card border border-border shadow-floating text-[13px] font-medium text-foreground whitespace-nowrap" style={{ opacity: 0, borderLeft: "3px solid hsl(var(--success))" }}>
        <span className="w-4 h-4 rounded-full bg-success text-white flex items-center justify-center"><Check size={10} strokeWidth={3.5} /></span>
        Merged into existing Stripe.
      </div>
    </div>
  );
}

/** The list at rest, for the theme preview: Stripe already in Interview. */
export function MListPreview() {
  return (
    <div className="absolute inset-0 flex flex-col bg-background text-foreground">
      <ListHeader />
      <div className="px-3 py-2.5 flex items-center gap-2 border-b border-border">
        <span className="h-8 flex-1 px-2.5 inline-flex items-center gap-2 rounded-lg border border-border bg-background text-[12.5px] text-muted-foreground">
          <Search size={13} strokeWidth={2} /> Search applications
        </span>
        <span className="h-8 px-3 inline-flex items-center gap-1 rounded-lg bg-primary text-primary-foreground text-[12.5px] font-semibold">
          <Plus size={13} strokeWidth={2.6} /> New
        </span>
      </div>
      <Strip stage="Interview" count={3} />
      <div className="relative">
        <Row {...STRIPE_ROW} />
        <span className={`absolute left-0 top-2 bottom-2 w-[3px] rounded-r ${STAGE_STRIPE_CLASS.Interview}`} />
      </div>
      {INTERVIEW_ROWS.map((r) => <Row key={r.company} {...r} />)}
      <Strip stage="Applied" count={7} />
      {APPLIED_ROWS.map((r) => <Row key={r.company} {...r} />)}
    </div>
  );
}

/* ─── The bridge — Settings → Personalize ─── */

export function MPersonalize({ selected }: { selected: "light" | "dark" }) {
  return (
    <div className="absolute inset-0 flex flex-col bg-background text-foreground">
      <ScreenHeader>
        <span className="flex items-center gap-1 text-[13px] font-medium text-muted-foreground"><ArrowLeft size={15} strokeWidth={1.8} /> Settings</span>
      </ScreenHeader>
      <div className="px-4 pt-4">
        <p className="text-[19px] font-semibold">Personalize</p>
        <p className="mt-0.5 text-[12.5px] text-muted-foreground">How HireTrail looks. Saved to your account.</p>
        <p className="mt-5 text-[13px] font-semibold">Theme</p>
        <div className="mt-2 grid grid-cols-2 gap-2.5">
          {MODES.map(({ mode, label, Icon }) => {
            const on = mode === selected;
            return (
              <div key={mode} className={`relative rounded-xl border bg-card p-2 shadow-panel ${on ? "border-primary ring-1 ring-primary" : "border-border"}`}>
                {on && (
                  <span className="absolute top-1.5 right-1.5 z-10 w-[18px] h-[18px] rounded-full bg-primary text-primary-foreground flex items-center justify-center"><Check size={11} strokeWidth={3} /></span>
                )}
                <div className="h-[66px] rounded-lg overflow-hidden border border-border flex">
                  {mode === "system" ? (
                    <><ShellPreview scope="theme-light" /><ShellPreview scope="theme-dark" /></>
                  ) : mode === "custom" ? (
                    <ShellPreview style={CUSTOM_PREVIEW} />
                  ) : (
                    <ShellPreview scope={mode === "light" ? "theme-light" : "theme-dark"} lp={mode === "dark" && selected === "dark" ? "m-zoom-target" : undefined} />
                  )}
                </div>
                <p className="mt-1.5 flex items-center gap-1.5 text-[12.5px] font-medium"><Icon size={13} strokeWidth={1.8} className="text-muted-foreground" /> {label}</p>
              </div>
            );
          })}
        </div>
        <p className="mt-5 text-[13px] font-semibold">Applications list</p>
        <div className="mt-2 grid grid-cols-2 gap-2.5">
          {["Classic", "Table"].map((name, i) => (
            <div key={name} className={`rounded-xl border bg-card p-2 shadow-panel ${i === 0 ? "border-primary ring-1 ring-primary" : "border-border"}`}>
              <div className="h-[46px] rounded-lg border border-border bg-background p-1.5 space-y-1.5">
                {[0, 1, 2].map((r) => (
                  <div key={r} className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded bg-control" />
                    <span className="h-1.5 rounded-full bg-control" style={{ width: i === 0 ? `${62 - r * 12}%` : "30%" }} />
                    {i === 1 && <span className="h-1.5 rounded-full bg-control w-[22%] ml-auto" />}
                  </div>
                ))}
              </div>
              <p className="mt-1.5 text-[12.5px] font-medium">{name}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
