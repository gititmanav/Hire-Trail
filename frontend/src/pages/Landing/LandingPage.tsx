/**
 * Public landing page — shown at "/" when the user is signed out.
 *
 * Design intent:
 *   - Continuous color rhythm. Upper third of the page shares a single
 *     blue → white gradient backdrop so the hero, board strip, and founder
 *     bar all read as one unit instead of three white walls.
 *   - HTML mockups inspired by real components in the app (Dashboard,
 *     Kanban, Tailor, StageSuggestions, extension popover, ⌘K palette).
 *     What visitors see matches what they get post-signup.
 *   - Theme: brand gradient (#3B82F6 → #1E3A8A) + the same stage palette
 *     used in stageStyles.ts.
 *   - Motion: IntersectionObserver + pure CSS keyframes. No animation
 *     libraries (bundle is already 1.7 MB).
 *
 * Section order:
 *   1. Nav (sticky, glass-on-scroll)
 *   2. Hero (blue-tinted, scroll-parallax dashboard mockup)
 *   3. Board strip (still on the blue gradient)
 *   4. Founder bar (tail end of the blue gradient)
 *   5. Feature 01 — Drafting stage (Kanban)
 *   6. Feature 02 — Targeted tailoring (Tailor) — muted bg
 *   7. Feature 03 — Gmail auto-detection (StageSuggestions)
 *   8. Feature 04 — Extension popover — muted bg
 *   9. Comparison (moved up — "why visitors switch")
 *  10. Bento — "Everything in one place" (DARK, mouse-tracked glow on cards)
 *  11. Power-user grid (Cmd+K, PDFs, BYOK)
 *  12. Stats strip (gradient bg, gradient numbers, ambient orbs)
 *  13. FAQ (2-column with sidecar)
 *  14. Big gradient CTA
 *  15. Dark footer
 */
import { createContext, useContext, useEffect, useRef, useState, type ReactNode, type CSSProperties } from "react";
import { Link, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import AuthModal, { type AuthMode } from "../../components/AuthModal/AuthModal.tsx";
import { UserContext } from "../../App.tsx";
import { authAPI } from "../../utils/api.ts";

const DEMO_EMAIL = "demo@hiretrail.com";
const DEMO_PASSWORD = "password123";

/** Lets any nested section open the auth modal in the requested mode, or
 *  one-click sign in as the demo user. */
interface LandingAuthApi {
  openAuth: (mode: AuthMode) => void;
  loginDemo: () => void;
  demoLoading: boolean;
}
const LandingAuthCtx = createContext<LandingAuthApi>({ openAuth: () => {}, loginDemo: () => {}, demoLoading: false });
const useOpenAuth = () => useContext(LandingAuthCtx).openAuth;
const useDemoLogin = () => {
  const { loginDemo, demoLoading } = useContext(LandingAuthCtx);
  return { loginDemo, demoLoading };
};

/* ─────────────────────────── motion utilities ─────────────────────────── */

function Reveal({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") { setShown(true); return; }
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) { setShown(true); obs.disconnect(); }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      style={{ transitionDelay: shown ? `${delay}ms` : "0ms" }}
      className={`transition-[opacity,transform] duration-700 ease-out ${shown ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"} ${className}`}
    >
      {children}
    </div>
  );
}

/** Counts up from 0 → value once visible. */
function Counter({ value, suffix = "", duration = 1100 }: { value: number; suffix?: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [n, setN] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let started = false;
    const obs = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting && !started) {
          started = true;
          obs.disconnect();
          const t0 = performance.now();
          const tick = (t: number) => {
            const k = Math.min(1, (t - t0) / duration);
            const eased = 1 - Math.pow(1 - k, 3);
            setN(Math.round(value * eased));
            if (k < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      }
    }, { threshold: 0.3 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [value, duration]);
  return <span ref={ref}>{n}{suffix}</span>;
}

/** Translates a child along Y based on viewport scroll relative to its container.
 *  Used for the hero parallax — subtle (about 60 px of travel) so it adds depth
 *  without seasickness. Disabled on prefers-reduced-motion. */
function Parallax({ children, factor = 0.18, className = "" }: { children: ReactNode; factor?: number; className?: string }) {
  const wrap = useRef<HTMLDivElement | null>(null);
  const [y, setY] = useState(0);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = wrap.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        // Distance from viewport center; clamp so it doesn't run forever.
        const center = rect.top + rect.height / 2 - window.innerHeight / 2;
        setY(Math.max(-60, Math.min(60, -center * factor)));
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); cancelAnimationFrame(raf); };
  }, [factor]);
  return (
    <div ref={wrap} className={className}>
      <div style={{ transform: `translate3d(0, ${y}px, 0)` }} className="transition-transform duration-75 ease-out will-change-transform">
        {children}
      </div>
    </div>
  );
}

/** Card with a mouse-tracked radial glow (Vercel/Linear style). Pure CSS via
 *  CSS variables — no re-renders on mousemove, just style mutation. */
function GlowCard({ children, className = "", glow = "rgba(59,130,246,0.22)" }: { children: ReactNode; className?: string; glow?: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  return (
    <div
      ref={ref}
      onMouseMove={(e) => {
        const el = ref.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        el.style.setProperty("--mx", `${e.clientX - rect.left}px`);
        el.style.setProperty("--my", `${e.clientY - rect.top}px`);
      }}
      style={{ ["--glow" as string]: glow } as CSSProperties}
      className={`relative group ${className}`}
    >
      <div aria-hidden className="absolute inset-0 rounded-[inherit] opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{ background: "radial-gradient(280px circle at var(--mx) var(--my), var(--glow), transparent 80%)" }}
      />
      {children}
    </div>
  );
}

/* ─────────────────────────── brand + CTAs ─────────────────────────── */

function BrandLogo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true" className="flex-shrink-0">
      <defs>
        <linearGradient id="ht-brand-grad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3B82F6" />
          <stop offset="1" stopColor="#1E3A8A" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="7" fill="url(#ht-brand-grad)" />
      <path d="M10 8h3v6h6V8h3v16h-3v-7h-6v7h-3V8z" fill="#FFFFFF" />
    </svg>
  );
}

/** Primary CTA — renders as a <button> when `onClick` is provided, else <Link to={to}>. */
function PrimaryCTA({ to, onClick, children, size = "lg", shape = "rounded", className = "" }: { to?: string; onClick?: () => void; children: ReactNode; size?: "lg" | "md"; shape?: "rounded" | "pill"; className?: string }) {
  const sizes = { lg: "px-7 py-3.5 text-base", md: "px-5 py-2.5 text-sm" };
  const shapeCls = shape === "pill" ? "rounded-full" : "rounded-lg";
  const cls = `group relative inline-flex items-center justify-center gap-2 font-semibold ${shapeCls} text-white bg-gradient-to-br from-[#3B82F6] to-[#1E3A8A] shadow-[0_10px_30px_-10px_rgba(59,130,246,0.6)] hover:shadow-[0_14px_36px_-10px_rgba(59,130,246,0.75)] hover:-translate-y-px active:translate-y-0 transition-[box-shadow,transform,border-radius] duration-300 overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6] focus-visible:ring-offset-2 ${sizes[size]} ${className}`;
  const inner = (
    <>
      <span aria-hidden className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent group-hover:translate-x-full transition-transform duration-700 ease-out" />
      <span className="relative">{children}</span>
      <svg className="relative transition-transform group-hover:translate-x-0.5" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
    </>
  );
  if (onClick) return <button type="button" onClick={onClick} className={cls}>{inner}</button>;
  return <Link to={to!} className={cls}>{inner}</Link>;
}

function SecondaryCTA({ to, onClick, children, size = "lg" }: { to?: string; onClick?: () => void; children: ReactNode; size?: "lg" | "md" }) {
  const sizes = { lg: "px-7 py-3.5 text-base", md: "px-5 py-2.5 text-sm" };
  const cls = `inline-flex items-center justify-center font-medium rounded-lg text-gray-900 bg-white/80 backdrop-blur-sm border border-gray-200 hover:bg-white hover:border-gray-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6] focus-visible:ring-offset-2 ${sizes[size]}`;
  if (onClick) return <button type="button" onClick={onClick} className={cls}>{children}</button>;
  return <Link to={to!} className={cls}>{children}</Link>;
}

/* ─────────────────────────── decorative grid texture ─────────────────────────── */

/** Subtle dotted-grid backdrop, masked to fade at the edges. Drop inside any
 *  `relative overflow-hidden` section. `tone` swaps line color between
 *  near-black (for light sections) and white (for dark sections). */
function GridTexture({ tone = "light" }: { tone?: "light" | "dark" }) {
  const cls = tone === "dark"
    ? "bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:56px_56px]"
    : "bg-[linear-gradient(to_right,rgba(15,23,42,0.045)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.045)_1px,transparent_1px)] bg-[size:56px_56px]";
  return <div aria-hidden className={`absolute inset-0 pointer-events-none ${cls} [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_70%)]`} />;
}

/* ─────────────────────────── chips ─────────────────────────── */

const STAGE_CHIP: Record<string, string> = {
  Drafting: "bg-slate-100 text-slate-700 ring-slate-200",
  Applied: "bg-blue-100 text-blue-700 ring-blue-200",
  OA: "bg-amber-100 text-amber-700 ring-amber-200",
  Interview: "bg-purple-100 text-purple-700 ring-purple-200",
  Offer: "bg-emerald-100 text-emerald-700 ring-emerald-200",
  Rejected: "bg-red-100 text-red-700 ring-red-200",
};

function StageChip({ stage, className = "" }: { stage: keyof typeof STAGE_CHIP; className?: string }) {
  return (
    <span className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ring-1 ring-inset ${STAGE_CHIP[stage]} ${className}`}>
      {stage}
    </span>
  );
}

/* ─────────────────────────── mockup: hero dashboard ─────────────────────────── */

function DashboardHeroMockup() {
  return (
    <div className="relative w-full max-w-6xl mx-auto">
      <div className="rounded-2xl overflow-hidden border border-gray-200 bg-white shadow-[0_50px_120px_-30px_rgba(15,23,42,0.45),0_20px_60px_-20px_rgba(59,130,246,0.35)]">
        <div className="flex items-center gap-1.5 px-4 py-2.5 bg-gray-50 border-b border-gray-200">
          <span className="w-2.5 h-2.5 rounded-full bg-red-400/80" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400/80" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/80" />
          <div className="ml-3 flex-1 max-w-[300px] px-3 py-1 rounded-md bg-white border border-gray-200 text-[11px] text-gray-400 truncate">app.hiretrail.com</div>
        </div>
        <div className="flex">
          <aside className="hidden sm:flex flex-col w-48 shrink-0 border-r border-gray-200 bg-[#fafbfc] p-3 gap-1">
            <div className="flex items-center gap-2 px-2 py-2"><BrandLogo size={20} /><span className="text-sm font-semibold text-gray-900">HireTrail</span></div>
            <div className="text-[9px] font-semibold uppercase tracking-wider text-gray-400 mt-3 px-2">Overview</div>
            <div className="flex items-center gap-2 px-2 py-1.5 rounded text-[12px] bg-[#3B82F6]/10 text-[#1E3A8A] font-medium">Dashboard</div>
            <div className="text-[9px] font-semibold uppercase tracking-wider text-gray-400 mt-2 px-2">Track</div>
            <div className="flex items-center gap-2 px-2 py-1.5 rounded text-[12px] text-gray-600">Applications</div>
            <div className="flex items-center gap-2 px-2 py-1.5 rounded text-[12px] text-gray-600">Kanban</div>
            <div className="flex items-center gap-2 px-2 py-1.5 rounded text-[12px] text-gray-600">Calendar</div>
            <div className="text-[9px] font-semibold uppercase tracking-wider text-gray-400 mt-2 px-2">Tools</div>
            <div className="flex items-center gap-2 px-2 py-1.5 rounded text-[12px] text-gray-600">Resumes</div>
            <div className="flex items-center gap-2 px-2 py-1.5 rounded text-[12px] text-gray-600">AI Tailor <span className="ml-auto text-[8px] font-bold text-[#1E3A8A] bg-[#3B82F6]/15 px-1 rounded">BETA</span></div>
          </aside>
          <main className="flex-1 p-4 md:p-6 bg-white min-w-0">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-4">
              {[
                { l: "Total", v: "47" },
                { l: "Active", v: "31" },
                { l: "Response rate", v: "23%" },
                { l: "Offers", v: "2" },
              ].map((s) => (
                <div key={s.l} className="rounded-lg border border-gray-200 bg-white p-3">
                  <div className="text-[10px] font-medium uppercase tracking-wider text-gray-500">{s.l}</div>
                  <div className="text-xl font-bold text-gray-900 mt-0.5">{s.v}</div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <div className="md:col-span-3 rounded-lg border border-gray-200 bg-white p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-semibold text-gray-900">Funnel</div>
                  <div className="text-[10px] text-gray-400">Last 90 days</div>
                </div>
                <div className="space-y-2">
                  {[
                    { s: "Applied", w: "100%", c: "bg-blue-500" },
                    { s: "OA", w: "62%", c: "bg-amber-500" },
                    { s: "Interview", w: "34%", c: "bg-purple-500" },
                    { s: "Offer", w: "12%", c: "bg-emerald-500" },
                  ].map((r) => (
                    <div key={r.s} className="flex items-center gap-2">
                      <div className="w-16 text-[11px] text-gray-600">{r.s}</div>
                      <div className="flex-1 h-5 rounded-md bg-gray-100 overflow-hidden">
                        <div className={`h-full ${r.c} rounded-md transition-[width] duration-1000`} style={{ width: r.w }} />
                      </div>
                      <div className="w-9 text-right text-[11px] font-medium text-gray-700">{r.w}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="md:col-span-2 rounded-lg border border-gray-200 bg-white p-4">
                <div className="text-sm font-semibold text-gray-900 mb-3">Recent</div>
                <ul className="space-y-2.5">
                  {[
                    { co: "Stripe", ro: "Backend SWE Intern", st: "Interview" as const },
                    { co: "Vercel", ro: "Frontend Intern", st: "OA" as const },
                    { co: "Linear", ro: "Product Eng Intern", st: "Applied" as const },
                    { co: "Anthropic", ro: "Research Intern", st: "Drafting" as const },
                  ].map((row) => (
                    <li key={row.co} className="flex items-center gap-2 min-w-0">
                      <div className="w-6 h-6 rounded bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-600">{row.co[0]}</div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[12px] font-medium text-gray-900 truncate">{row.co}</div>
                        <div className="text-[10px] text-gray-500 truncate">{row.ro}</div>
                      </div>
                      <StageChip stage={row.st} />
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </main>
        </div>
      </div>
      <div className="hidden md:flex absolute -right-6 top-12 items-center gap-2 px-3 py-2 rounded-lg bg-white shadow-[0_12px_30px_-10px_rgba(15,23,42,0.35)] border border-gray-200 animate-[ht-float_4s_ease-in-out_infinite]">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-[11px] font-medium text-gray-900">Stripe → Interview</span>
        <span className="text-[10px] text-gray-400">auto-detected</span>
      </div>
      <div className="hidden md:flex absolute -left-6 bottom-16 items-center gap-2 px-3 py-2 rounded-lg bg-white shadow-[0_12px_30px_-10px_rgba(15,23,42,0.35)] border border-gray-200 animate-[ht-float_5s_ease-in-out_-1s_infinite]">
        <BrandLogo size={18} />
        <span className="text-[11px] font-medium text-gray-900">Resume tailored · A grade</span>
      </div>
    </div>
  );
}

/* ─────────────────────────── mockup: Kanban ─────────────────────────── */

function KanbanMockup() {
  const cols: Array<{ stage: keyof typeof STAGE_CHIP; cards: { co: string; ro: string }[]; tone: string }> = [
    { stage: "Drafting", tone: "border-slate-200 bg-slate-50/40", cards: [{ co: "Anthropic", ro: "Research Intern" }, { co: "Notion", ro: "Frontend Intern" }] },
    { stage: "Applied", tone: "border-blue-200 bg-blue-50/40", cards: [{ co: "Linear", ro: "Product Eng" }, { co: "Figma", ro: "SWE Intern" }, { co: "Loom", ro: "Backend" }] },
    { stage: "OA", tone: "border-amber-200 bg-amber-50/40", cards: [{ co: "Vercel", ro: "Frontend" }] },
    { stage: "Interview", tone: "border-purple-200 bg-purple-50/40", cards: [{ co: "Stripe", ro: "Backend" }] },
  ];
  return (
    <div className="rounded-xl overflow-hidden border border-gray-200 bg-white shadow-[0_20px_60px_-25px_rgba(15,23,42,0.3)] p-3">
      <div className="grid grid-cols-4 gap-2.5">
        {cols.map((c) => (
          <div key={c.stage} className={`rounded-lg border ${c.tone} p-2`}>
            <div className="flex items-center justify-between mb-2 px-1">
              <StageChip stage={c.stage} />
              <span className="text-[10px] font-semibold text-gray-500">{c.cards.length}</span>
            </div>
            <div className="space-y-1.5">
              {c.cards.map((card, i) => (
                <div
                  key={card.co}
                  className={`rounded-md bg-white border border-gray-200 p-2 ${c.stage === "Drafting" && i === 0 ? "ring-2 ring-[#3B82F6] ring-offset-1" : ""}`}
                >
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
                <div className="ml-auto flex gap-1.5">
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
      <div className="absolute right-0 top-12 w-9 h-9 rounded-l-xl bg-gradient-to-br from-[#3B82F6] to-[#1E3A8A] flex items-center justify-center shadow-[0_8px_24px_-6px_rgba(59,130,246,0.55)]">
        <BrandLogo size={18} />
      </div>
      <div className="absolute right-12 top-8 w-[260px] rounded-xl bg-white shadow-[0_20px_50px_-15px_rgba(15,23,42,0.35)] border border-gray-200 overflow-hidden">
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

/* ─────────────────────────── mockups: ⌘K + PDF ─────────────────────────── */

function CommandPaletteMockup() {
  return (
    <div className="relative rounded-xl border border-gray-200 bg-white shadow-[0_20px_60px_-25px_rgba(15,23,42,0.3)] overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input aria-label="Search" readOnly value="stri" className="flex-1 text-sm text-gray-900 bg-transparent outline-none" />
        <kbd className="text-[10px] font-mono text-gray-400 border border-gray-200 rounded px-1.5 py-0.5">esc</kbd>
      </div>
      <ul className="py-2">
        {[
          { kind: "Application", title: "Stripe — Backend SWE Intern", tone: "Interview" as const },
          { kind: "Company", title: "Stripe", meta: "1 application" },
          { kind: "Contact", title: "Patrick Collison", meta: "stripe.com" },
        ].map((r, i) => (
          <li key={i} className={`px-4 py-2 flex items-center gap-3 ${i === 0 ? "bg-blue-50/60" : ""}`}>
            <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500 w-16">{r.kind}</span>
            <span className="text-[13px] font-medium text-gray-900 flex-1 truncate">{r.title}</span>
            {"tone" in r && r.tone ? <StageChip stage={r.tone} /> : <span className="text-[11px] text-gray-400">{r.meta}</span>}
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-3 px-4 py-2 border-t border-gray-200 bg-gray-50/60">
        <span className="text-[10px] text-gray-500">↑ ↓ navigate</span>
        <span className="text-[10px] text-gray-500">↵ select</span>
        <kbd className="ml-auto text-[10px] font-mono text-gray-500 border border-gray-200 rounded px-1.5 py-0.5 bg-white">⌘ K</kbd>
      </div>
    </div>
  );
}

function PdfMockup() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-[0_20px_60px_-25px_rgba(15,23,42,0.3)] p-6 relative">
      <div className="absolute top-2 right-2 text-[9px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 ring-1 ring-inset ring-emerald-200 rounded px-1.5 py-0.5">1 page</div>
      <div className="text-center mb-3">
        <div className="text-base font-bold text-gray-900">Manav Kaneria</div>
        <div className="text-[10px] text-gray-500">kaneria.ma@northeastern.edu · linkedin.com/in/manavk</div>
      </div>
      <div className="h-px bg-gray-200 my-2" />
      <div className="text-[10px] font-bold uppercase tracking-wider text-gray-700 mb-1">Experience</div>
      <div className="space-y-1.5">
        <div className="h-1.5 bg-gray-100 rounded w-full" />
        <div className="h-1.5 bg-gray-100 rounded w-11/12" />
        <div className="h-1.5 bg-gray-100 rounded w-5/6" />
      </div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-gray-700 mt-3 mb-1">Projects</div>
      <div className="space-y-1.5">
        <div className="h-1.5 bg-gray-100 rounded w-11/12" />
        <div className="h-1.5 bg-gray-100 rounded w-3/4" />
      </div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-gray-700 mt-3 mb-1">Skills</div>
      <div className="flex flex-wrap gap-1">
        {["Go", "TypeScript", "React", "Postgres", "AWS", "Kubernetes"].map((s) => (
          <span key={s} className="text-[9px] font-medium text-gray-700 px-1.5 py-0.5 rounded bg-gray-100">{s}</span>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────── nav ─────────────────────────── */

function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const openAuth = useOpenAuth();
  const { loginDemo, demoLoading } = useDemoLogin();
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /** Smooth-scroll instead of the browser's instant jump.
   *  scrollIntoView with `behavior: smooth` lets us also offset for the
   *  sticky header by adjusting scroll position after the fact. */
  const scrollTo = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (!el) return;
    const headerOffset = 96;
    const top = el.getBoundingClientRect().top + window.scrollY - headerOffset;
    window.scrollTo({ top, behavior: "smooth" });
  };

  return (
    /* Two-state nav: at page top the nav is FULLY TRANSPARENT — the HeroBand
     *  extends 14px behind the nav (via -mt-14 pt-14) so its base bg + top
     *  accent gradient + dotted grid all show through, making the nav strip
     *  indistinguishable from the hero below it. After ~30px scroll the nav
     *  transforms into a floating white pill (jobright-style) with shadow +
     *  rounded-full container, and the Sign-up button morphs from rounded-lg
     *  → rounded-full to match the pill. */
    <header className={`sticky top-0 z-50 transition-[padding] duration-300 ease-out ${scrolled ? "pt-3 sm:pt-4 pb-1" : "pt-0 pb-0"}`}>
      <div className={`mx-auto transition-all duration-300 ease-out ${
        scrolled
          ? "max-w-5xl rounded-full bg-white/95 backdrop-blur shadow-[0_12px_36px_-12px_rgba(15,23,42,0.18)] border border-gray-200/70"
          : "max-w-7xl bg-transparent border-transparent"
      }`}>
        <div className={`flex items-center justify-between transition-[height,padding] duration-300 ease-out ${scrolled ? "h-12 px-5 sm:px-6" : "h-14 px-5 sm:px-8"}`}>
          <Link to="/" className="flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6] focus-visible:ring-offset-2 rounded">
            <BrandLogo size={scrolled ? 26 : 30} />
            <span className="font-semibold tracking-tight text-base text-gray-900">HireTrail</span>
          </Link>
          <nav className="flex items-center gap-1.5 sm:gap-3">
            <a href="#features" onClick={scrollTo("features")} className="hidden md:inline-flex text-sm font-medium text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md transition-colors">Features</a>
            <a href="#compare" onClick={scrollTo("compare")} className="hidden md:inline-flex text-sm font-medium text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md transition-colors">Compare</a>
            <a href="#faq" onClick={scrollTo("faq")} className="hidden md:inline-flex text-sm font-medium text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md transition-colors">FAQ</a>
            <button
              type="button"
              onClick={loginDemo}
              disabled={demoLoading}
              className="hidden sm:inline-flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:text-gray-900 px-3 py-1.5 rounded-full bg-white/70 hover:bg-white border border-gray-200 hover:border-gray-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6] focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-wait"
              title="Skip signup and explore with the demo account"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polygon points="6 4 20 12 6 20 6 4"/></svg>
              {demoLoading ? "Signing in…" : "Try demo"}
            </button>
            <button type="button" onClick={() => openAuth("login")} className="hidden sm:inline-flex text-sm font-medium text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6] focus-visible:ring-offset-2">Log in</button>
            <PrimaryCTA onClick={() => openAuth("register")} size="md" shape={scrolled ? "pill" : "rounded"}>Sign up free</PrimaryCTA>
          </nav>
        </div>
      </div>
    </header>
  );
}

/* ─────────────────────────── HERO BAND (continuous blue gradient covering hero + board + founder) ─────────────────────────── */

function HeroBand() {
  return (
    /* Uniform sky-blue field (jobright-style) — solid blue from the top of the
     *  page through the founder bar, ending in a curved bottom that flows into
     *  the white section below. The base sky-blue lives DIRECTLY on this
     *  container (not in an absolute -z-10 backdrop) so it's painted as the
     *  element's own background, sidestepping all stacking-context issues with
     *  the LandingPage's outer bg-white. Decorative orbs/grid sit on top of
     *  that base but below the content, via plain source-order stacking. */
    <div className="relative overflow-hidden -mt-14 pt-14 rounded-b-[40px] sm:rounded-b-[80px] bg-[#cfe7ff] shadow-[0_30px_60px_-30px_rgba(30,58,138,0.20)]">
      {/* Decorative layer — paints before the content sections (no z-index needed). */}
      <div aria-hidden className="absolute inset-0 pointer-events-none overflow-hidden rounded-b-[40px] sm:rounded-b-[80px]">
        {/* Top accent — extra saturation only at the very top */}
        <div className="absolute top-0 inset-x-0 h-[300px] bg-gradient-to-b from-[#a5cffb]/70 to-transparent" />
        {/* Radial wash behind the hero mockup */}
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[1200px] h-[1200px] rounded-full bg-[radial-gradient(closest-side,rgba(59,130,246,0.22),transparent)]" />
        {/* Animated drifting orbs for depth */}
        <div className="absolute top-32 -left-32 w-[500px] h-[500px] rounded-full bg-[radial-gradient(closest-side,rgba(96,165,250,0.25),transparent)] animate-[ht-drift_18s_ease-in-out_infinite]" />
        <div className="absolute top-64 -right-24 w-[400px] h-[400px] rounded-full bg-[radial-gradient(closest-side,rgba(30,58,138,0.18),transparent)] animate-[ht-drift_22s_ease-in-out_-6s_infinite]" />
        {/* Faint dotted grid for texture */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(15,23,42,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.06)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_70%)]" />
      </div>

      <Hero />
      <BoardStrip />
      <FounderBar />
    </div>
  );
}

function Hero() {
  const openAuth = useOpenAuth();
  return (
    <section className="relative">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 pt-6 pb-6 sm:pt-10 sm:pb-8 text-center">
        <Reveal>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/80 backdrop-blur-sm border border-blue-200 text-[11px] font-medium text-[#1E3A8A] shadow-sm mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Drafting</span>
            <span className="text-gray-400">·</span>
            <span>Applied</span>
            <span className="text-gray-400">·</span>
            <span>OA</span>
            <span className="text-gray-400">·</span>
            <span>Interview</span>
            <span className="text-gray-400">·</span>
            <span className="text-emerald-700 font-semibold">Offer</span>
          </div>
        </Reveal>
        <Reveal delay={60}>
          <h1 className="text-5xl sm:text-6xl md:text-[76px] md:leading-[1.02] font-black tracking-tight text-gray-900 mb-5">
            <span className="block">Tailor. Apply. Track.</span>
            <span className="block bg-clip-text text-transparent bg-gradient-to-r from-[#3B82F6] via-[#2563eb] to-[#1E3A8A] animate-[ht-shimmer_8s_ease-in-out_infinite] bg-[length:200%_100%]">One funnel.</span>
          </h1>
        </Reveal>
        <Reveal delay={120}>
          <p className="text-base sm:text-lg text-gray-700 max-w-2xl mx-auto leading-relaxed mb-7">
            Tailor a resume to any job description in one click. Track every stage from drafting to offer. Let your Gmail update the tracker for you.
          </p>
        </Reveal>
        <Reveal delay={180}>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-12">
            <PrimaryCTA onClick={() => openAuth("register")}>Start your job search — free</PrimaryCTA>
            <SecondaryCTA onClick={() => openAuth("login")}>Log in</SecondaryCTA>
          </div>
        </Reveal>
      </div>
      <Reveal delay={220} className="max-w-7xl mx-auto px-5 sm:px-8 pb-4 sm:pb-8">
        <Parallax factor={0.12}><DashboardHeroMockup /></Parallax>
      </Reveal>
    </section>
  );
}

function BoardStrip() {
  const boards: Array<{ name: string; src: string }> = [
    { name: "LinkedIn", src: "/linkedin-svgrepo-com.svg" },
    { name: "Indeed", src: "/png-transparent-indeed-thumbnail-review-platforms-logos-thumbnail.png" },
    { name: "Greenhouse", src: "/greenhouse-logo-freelogovectors.net_.png" },
    { name: "Lever", src: "/lever.webp" },
    { name: "Glassdoor", src: "/glassdoor-svgrepo-com.svg" },
    { name: "Workday", src: "/icons8-workday.svg" },
  ];
  return (
    <section className="relative">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-5 sm:py-7">
        <Reveal>
          <div className="text-center mb-5">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#1E3A8A]/80">One extension. Every major board.</div>
          </div>
        </Reveal>
        <Reveal delay={80}>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 sm:gap-4">
            {boards.map((b) => (
              <div key={b.name} className="group flex items-center justify-center gap-2.5 px-3 py-3.5 rounded-xl bg-white/80 backdrop-blur-sm border border-blue-100 hover:border-blue-200 hover:shadow-sm hover:-translate-y-0.5 transition-[border-color,box-shadow,transform]">
                <img src={b.src} alt={`${b.name} logo`} loading="lazy" className="w-6 h-6 object-contain shrink-0" />
                <span className="text-sm font-semibold text-gray-700">{b.name}</span>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function FounderBar() {
  return (
    <section className="relative max-w-7xl mx-auto px-5 sm:px-8 py-5 sm:py-9">
      <Reveal>
        <div className="rounded-2xl border border-blue-100 bg-white/85 backdrop-blur-md shadow-[0_30px_60px_-30px_rgba(30,58,138,0.25)] px-6 py-5 sm:px-8 sm:py-6 flex flex-col sm:flex-row items-start sm:items-center gap-5">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#3B82F6] to-[#1E3A8A] flex items-center justify-center text-white font-bold text-sm shadow-md shadow-blue-500/30">MK</div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#1E3A8A]/70 mb-1">Built by a job seeker, for job seekers</div>
            <p className="text-gray-900 text-[15px] leading-relaxed">
              I made HireTrail because the other trackers either bloated into enterprise software, hallucinated my resume into fiction, or felt like privacy vacuums. This one respects your data and the work you put in.
            </p>
            <div className="text-[12px] text-gray-500 mt-1.5">— Manav Kaneria, creator</div>
          </div>
          <a href="https://github.com/gititmanav/Hire-Trail" target="_blank" rel="noreferrer noopener" className="self-stretch sm:self-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-[13px] font-medium text-gray-700 transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.8 10.9.6.1.8-.2.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.6-.3-5.3-1.3-5.3-5.8 0-1.3.5-2.3 1.2-3.2-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2 1-.3 2-.4 3-.4s2 .1 3 .4c2.3-1.5 3.3-1.2 3.3-1.2.6 1.6.2 2.8.1 3.1.8.8 1.2 1.9 1.2 3.2 0 4.5-2.7 5.5-5.3 5.8.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6 4.5-1.5 7.8-5.8 7.8-10.9C23.5 5.7 18.3.5 12 .5z"/></svg>
            Open source
          </a>
        </div>
      </Reveal>
    </section>
  );
}

/* ─────────────────────────── feature sections ─────────────────────────── */

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

/* ─────────────────────────── Comparison (moved up — strong visual) ─────────────────────────── */

function Comparison() {
  const rows: Array<{ feature: string; them: string; us: string }> = [
    { feature: "Resumes-in-progress", them: "Live in a separate Google Doc", us: "Real Drafting stage on the funnel" },
    { feature: "Stage updates", them: "Manually edit a spreadsheet", us: "Gmail intake → auto, with one-click Revert" },
    { feature: "AI tailoring", them: "Free-form ChatGPT, often invents experience", us: "Bullet-level Accept/Reject against your real profile" },
    { feature: "PDF output", them: "Canva template, no guarantee on length", us: "Typst-rendered, auto-trimmed to one page" },
    { feature: "AI cost", them: "Metered per analyze, opaque", us: "Free default · BYOK for unlimited" },
    { feature: "Your data", them: "Vendor lock-in, no real export", us: "Full JSON + CSV export, open-source code" },
  ];
  return (
    <section id="compare" className="relative py-12 sm:py-16 overflow-hidden">
      <div aria-hidden className="absolute inset-0 -z-10 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50/40 via-white to-blue-50/30" />
        <div className="absolute -bottom-32 -right-32 w-[500px] h-[500px] rounded-full bg-[radial-gradient(closest-side,rgba(59,130,246,0.12),transparent)]" />
      </div>
      <GridTexture />
      <div className="max-w-6xl mx-auto px-5 sm:px-8">
        <Reveal>
          <div className="text-center max-w-2xl mx-auto mb-10">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#3B82F6] mb-3">Why visitors switch</div>
            <h2 className="text-3xl sm:text-[44px] sm:leading-[1.08] font-black tracking-tight text-gray-900 mb-3">Pick the right tool. <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#3B82F6] to-[#1E3A8A]">Not the loudest one.</span></h2>
            <p className="text-[15px] text-gray-600">The six things that actually matter once you're 50+ applications deep.</p>
          </div>
        </Reveal>
        <Reveal delay={80}>
          <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-[0_30px_80px_-30px_rgba(15,23,42,0.25)]">
            <div className="grid grid-cols-[1.1fr_1fr_1fr] px-5 py-4 border-b border-gray-200 bg-gradient-to-br from-gray-50 to-white text-[11px] font-bold uppercase tracking-wider text-gray-500">
              <div>Capability</div>
              <div>Other trackers</div>
              <div className="flex items-center gap-1.5"><BrandLogo size={14} /> HireTrail</div>
            </div>
            <div className="divide-y divide-gray-100">
              {rows.map((r, i) => (
                <Reveal key={r.feature} delay={i * 60}>
                  <div className="grid grid-cols-[1.1fr_1fr_1fr] px-5 py-4 items-start hover:bg-gray-50/60 transition-colors">
                    <div className="text-[14px] font-semibold text-gray-900 pr-3">{r.feature}</div>
                    <div className="text-[13px] text-gray-500 leading-relaxed flex items-start gap-2 pr-3">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-gray-400 shrink-0 mt-0.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      {r.them}
                    </div>
                    <div className="text-[13px] text-gray-900 leading-relaxed flex items-start gap-2">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-emerald-500 shrink-0 mt-0.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      {r.us}
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ─────────────────────────── Bento (DARK, mouse-tracked glow) ─────────────────────────── */

function Bento() {
  return (
    <section className="relative bg-slate-950 text-white overflow-hidden rounded-t-[40px] sm:rounded-t-[64px]">
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-32 -left-32 w-[700px] h-[700px] rounded-full bg-[radial-gradient(closest-side,rgba(59,130,246,0.22),transparent)] animate-[ht-drift_20s_ease-in-out_infinite]" />
        <div className="absolute -bottom-40 -right-32 w-[800px] h-[800px] rounded-full bg-[radial-gradient(closest-side,rgba(30,58,138,0.28),transparent)] animate-[ht-drift_24s_ease-in-out_-8s_infinite]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_75%)]" />
      </div>
      <div className="relative max-w-7xl mx-auto px-5 sm:px-8 py-14 sm:py-20">
        <Reveal>
          <div className="max-w-2xl mb-12">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-blue-300 mb-4">Everything in one place</div>
            <h2 className="text-4xl sm:text-[52px] sm:leading-[1.05] font-black tracking-tight text-white mb-4">A whole job-search toolkit. <span className="text-blue-300">Free, open, all yours.</span></h2>
            <p className="text-lg text-slate-300 leading-relaxed">No upsells, no metered AI, no shared spreadsheet. Twelve features pulling in the same direction.</p>
          </div>
        </Reveal>
        <div className="grid grid-cols-12 gap-4">
          {/* Row 1 */}
          <Reveal delay={40} className="col-span-12 md:col-span-7">
            <GlowCard className="h-full rounded-2xl bg-gradient-to-br from-white/[0.06] to-white/[0.02] border border-white/10 p-6 hover:border-white/20 transition-colors overflow-hidden">
              <div className="relative">
                <div className="flex items-center gap-2 mb-3"><span className="text-[10px] font-bold uppercase tracking-wider text-blue-300">Tailor</span></div>
                <h3 className="text-xl font-bold mb-2">AI suggestions that don't make things up</h3>
                <p className="text-sm text-slate-300 leading-relaxed mb-5">Compares the JD to your structured master profile and rewrites your actual bullets to mirror the role. Suggestion-level Accept / Reject. A–F fit score with concrete gaps.</p>
                <div className="rounded-lg bg-slate-900/60 border border-white/10 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-bold tracking-wider text-blue-300">REWRITE</span>
                    <span className="text-[10px] text-slate-400">→ Stripe API gateway</span>
                  </div>
                  <div className="text-[11px] text-slate-400 line-through">Built a service to handle internal requests across our backend.</div>
                  <div className="text-[12px] text-white">Architected a multi-tenant API gateway in Go handling 8k RPS, cutting p95 latency 480ms → 95ms.</div>
                  <div className="flex gap-1.5 pt-1">
                    <span className="px-1.5 py-0.5 text-[9px] font-medium rounded bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30">distributed-systems</span>
                    <span className="px-1.5 py-0.5 text-[9px] font-medium rounded bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30">go</span>
                  </div>
                </div>
              </div>
            </GlowCard>
          </Reveal>
          <Reveal delay={80} className="col-span-12 md:col-span-5">
            <GlowCard className="h-full rounded-2xl bg-gradient-to-br from-white/[0.06] to-white/[0.02] border border-white/10 p-6 hover:border-white/20 transition-colors flex flex-col">
              <div className="relative flex flex-col flex-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-300 mb-3">Drafting → Applied</span>
                <h3 className="text-xl font-bold mb-2">The funnel that fits reality</h3>
                <p className="text-sm text-slate-300 leading-relaxed mb-4">Resumes-in-progress live in a Drafting stage. The card transitions to Applied automatically when you actually hit Apply.</p>
                <div className="mt-auto flex items-center gap-2 text-[11px] flex-wrap">
                  <span className="px-2 py-1 rounded ring-1 ring-slate-700 bg-slate-900 text-slate-300">Drafting</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-500"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                  <span className="px-2 py-1 rounded ring-1 ring-blue-500/30 bg-blue-500/10 text-blue-200">Applied</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-500"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                  <span className="px-2 py-1 rounded ring-1 ring-purple-500/30 bg-purple-500/10 text-purple-200">Interview</span>
                </div>
              </div>
            </GlowCard>
          </Reveal>
          {/* Row 2 */}
          {[
            { eyebrow: "Inbox sync", title: "Gmail + Outlook auto-detect", body: "Reads recent mail, classifies interview / rejection / offer, updates the card. One-click Revert if it's wrong." },
            { eyebrow: "Real PDFs", title: "Typst one-page render", body: "Auto-trims when content overflows. ATS-friendly, no Canva templates, no 'one-page' lies." },
            { eyebrow: "Apply detect", title: "Extension sees the Apply click", body: "When you actually apply on a JD page, the linked Drafting card flips to Applied — automatically." },
          ].map((card, i) => (
            <Reveal key={card.title} delay={120 + i * 50} className="col-span-12 md:col-span-4">
              <GlowCard className="h-full rounded-2xl bg-gradient-to-br from-white/[0.06] to-white/[0.02] border border-white/10 p-6 hover:border-white/20 transition-colors">
                <div className="relative">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-blue-300 mb-3">{card.eyebrow}</div>
                  <h3 className="text-lg font-bold mb-2">{card.title}</h3>
                  <p className="text-sm text-slate-300 leading-relaxed">{card.body}</p>
                </div>
              </GlowCard>
            </Reveal>
          ))}
          {/* Row 3 */}
          {[
            { eyebrow: "⌘ K", title: "Global command palette", body: "Jump to any application, company, contact, or deadline. Full keyboard, zero mouse." },
            { eyebrow: "Kanban + Calendar", title: "Three views, one source of truth", body: "Table for filtering, Kanban for momentum, Calendar for deadlines. Drag to reschedule." },
            { eyebrow: "Background jobs", title: "Refresh-safe analyze + parse", body: "Long AI calls run server-side. Refresh the tab, your progress card reattaches." },
          ].map((card, i) => (
            <Reveal key={card.title} delay={250 + i * 50} className="col-span-12 md:col-span-4">
              <GlowCard className="h-full rounded-2xl bg-gradient-to-br from-white/[0.06] to-white/[0.02] border border-white/10 p-6 hover:border-white/20 transition-colors">
                <div className="relative">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-blue-300 mb-3">{card.eyebrow}</div>
                  <h3 className="text-lg font-bold mb-2">{card.title}</h3>
                  <p className="text-sm text-slate-300 leading-relaxed">{card.body}</p>
                </div>
              </GlowCard>
            </Reveal>
          ))}
          {/* Row 4 */}
          <Reveal delay={400} className="col-span-12 md:col-span-5">
            <GlowCard className="h-full rounded-2xl bg-gradient-to-br from-white/[0.06] to-white/[0.02] border border-white/10 p-6 hover:border-white/20 transition-colors">
              <div className="relative">
                <div className="text-[10px] font-bold uppercase tracking-wider text-blue-300 mb-3">Bring your own AI</div>
                <h3 className="text-lg font-bold mb-2">No metered AI. Pick your provider.</h3>
                <p className="text-sm text-slate-300 leading-relaxed mb-4">Use the default for free, or plug in your own Anthropic, OpenAI, Google, or OpenRouter key for full control.</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { name: "Anthropic", note: "Claude" },
                    { name: "OpenAI", note: "GPT-4o" },
                    { name: "Google", note: "Gemini" },
                    { name: "OpenRouter", note: "Any model" },
                  ].map((p) => (
                    <div key={p.name} className="flex items-center gap-2 p-2 rounded-lg ring-1 ring-white/10 bg-white/5">
                      <div className="w-6 h-6 rounded bg-white/10 flex items-center justify-center text-[10px] font-bold text-white">{p.name[0]}</div>
                      <div className="min-w-0">
                        <div className="text-[11px] font-semibold text-white">{p.name}</div>
                        <div className="text-[10px] text-slate-400">{p.note}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </GlowCard>
          </Reveal>
          <Reveal delay={440} className="col-span-12 md:col-span-4">
            <GlowCard className="h-full rounded-2xl bg-gradient-to-br from-white/[0.06] to-white/[0.02] border border-white/10 p-6 hover:border-white/20 transition-colors">
              <div className="relative">
                <div className="text-[10px] font-bold uppercase tracking-wider text-blue-300 mb-3">Privacy</div>
                <h3 className="text-lg font-bold mb-2">Read-only Gmail. Encrypted tokens.</h3>
                <p className="text-sm text-slate-300 leading-relaxed">We never send, modify, or delete mail. Refresh tokens are encrypted at rest. Disconnect anytime and we revoke immediately.</p>
              </div>
            </GlowCard>
          </Reveal>
          <Reveal delay={480} className="col-span-12 md:col-span-3">
            <GlowCard className="h-full rounded-2xl bg-gradient-to-br from-white/[0.06] to-white/[0.02] border border-white/10 p-6 hover:border-white/20 transition-colors flex flex-col">
              <div className="relative flex flex-col flex-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-blue-300 mb-3">Open source</div>
                <h3 className="text-lg font-bold mb-2">Code is on GitHub</h3>
                <p className="text-sm text-slate-300 leading-relaxed mb-4">Read the code, file issues, send a PR.</p>
                <a href="https://github.com/gititmanav/Hire-Trail" target="_blank" rel="noreferrer noopener" className="mt-auto inline-flex items-center gap-2 text-sm font-medium text-blue-300 hover:text-blue-200">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.8 10.9.6.1.8-.2.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.6-.3-5.3-1.3-5.3-5.8 0-1.3.5-2.3 1.2-3.2-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2 1-.3 2-.4 3-.4s2 .1 3 .4c2.3-1.5 3.3-1.2 3.3-1.2.6 1.6.2 2.8.1 3.1.8.8 1.2 1.9 1.2 3.2 0 4.5-2.7 5.5-5.3 5.8.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6 4.5-1.5 7.8-5.8 7.8-10.9C23.5 5.7 18.3.5 12 .5z"/></svg>
                  View repo
                </a>
              </div>
            </GlowCard>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────── Power-user grid ─────────────────────────── */

function PowerUserGrid() {
  return (
    /* Inverted curve: bows UP into the dark Bento section above. The negative
     *  top margin + rounded-t-[64px] makes the white section appear to overlay
     *  the dark blue. Bg lives DIRECTLY on the section (not in an absolute
     *  -z-10 backdrop) so it paints reliably across stacking contexts. No
     *  upward shadow — at slate-950 the shadow color composites *lighter*
     *  than the bg and creates a visible band; the curve itself is enough. */
    <section className="relative py-12 sm:py-16 overflow-hidden -mt-10 sm:-mt-16 rounded-t-[40px] sm:rounded-t-[64px] bg-white z-10">
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-20 -left-20 w-[400px] h-[400px] rounded-full bg-[radial-gradient(closest-side,rgba(59,130,246,0.10),transparent)]" />
      </div>
      <GridTexture />
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        <Reveal>
          <div className="text-center max-w-2xl mx-auto mb-10">
            <div className="flex items-center justify-center gap-2.5 mb-4">
              <span className="text-[12px] font-mono font-semibold text-[#3B82F6]">05</span>
              <span className="h-px w-8 bg-[#3B82F6]/40" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Feels fast</span>
            </div>
            <h2 className="text-3xl sm:text-[40px] sm:leading-[1.1] font-black tracking-tight text-gray-900 mb-3">Built for keyboards, not clicks.</h2>
            <p className="text-[16px] text-gray-600 leading-relaxed">⌘K everything. Real one-page PDFs via Typst. Bring your own AI key — no upcharge for inference.</p>
          </div>
        </Reveal>
        <div className="grid md:grid-cols-3 gap-5">
          <Reveal>
            <GlowCard glow="rgba(59,130,246,0.18)" className="rounded-2xl border border-gray-200 bg-white p-5 h-full hover:-translate-y-0.5 hover:shadow-lg hover:shadow-blue-500/10 transition-[transform,box-shadow]">
              <div className="relative">
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2">Global search</div>
                <h3 className="text-base font-bold text-gray-900 mb-3">⌘K from anywhere</h3>
                <CommandPaletteMockup />
              </div>
            </GlowCard>
          </Reveal>
          <Reveal delay={80}>
            <GlowCard glow="rgba(16,185,129,0.18)" className="rounded-2xl border border-gray-200 bg-white p-5 h-full hover:-translate-y-0.5 hover:shadow-lg hover:shadow-emerald-500/10 transition-[transform,box-shadow]">
              <div className="relative">
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2">Real PDFs</div>
                <h3 className="text-base font-bold text-gray-900 mb-3">One page, every time</h3>
                <PdfMockup />
              </div>
            </GlowCard>
          </Reveal>
          <Reveal delay={160}>
            <GlowCard glow="rgba(139,92,246,0.18)" className="rounded-2xl border border-gray-200 bg-white p-5 h-full hover:-translate-y-0.5 hover:shadow-lg hover:shadow-purple-500/10 transition-[transform,box-shadow]">
              <div className="relative">
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2">Bring your own AI key</div>
                <h3 className="text-base font-bold text-gray-900 mb-3">No metered AI</h3>
                <div className="space-y-2.5">
                  {[
                    { name: "Anthropic", note: "Claude Sonnet / Haiku" },
                    { name: "OpenAI", note: "GPT-4o / mini" },
                    { name: "Google", note: "Gemini 2.5 Flash" },
                    { name: "OpenRouter", note: "Any model" },
                  ].map((p) => (
                    <div key={p.name} className="flex items-center gap-3 p-2.5 rounded-lg border border-gray-200">
                      <div className="w-7 h-7 rounded bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-700">{p.name[0]}</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] font-semibold text-gray-900">{p.name}</div>
                        <div className="text-[10px] text-gray-500">{p.note}</div>
                      </div>
                      <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 ring-1 ring-inset ring-emerald-200 rounded px-1.5 py-0.5">BYOK</span>
                    </div>
                  ))}
                </div>
              </div>
            </GlowCard>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────── Stats strip (upgraded: gradient bg, gradient numbers) ─────────────────────────── */

function StatsStrip() {
  const stats: Array<{ v: number; suffix: string; l: string; tone: string }> = [
    { v: 12, suffix: "s", l: "to a tailored resume", tone: "from-[#3B82F6] to-[#1E3A8A]" },
    { v: 6, suffix: "", l: "supported job boards", tone: "from-emerald-500 to-emerald-700" },
    { v: 5, suffix: "", l: "stages, zero manual updates", tone: "from-purple-500 to-purple-700" },
    { v: 1, suffix: "", l: "page, every time", tone: "from-amber-500 to-amber-700" },
  ];
  return (
    <section className="relative py-14 sm:py-18 overflow-hidden rounded-t-[40px] sm:rounded-t-[64px] rounded-b-[40px] sm:rounded-b-[64px]">
      <div aria-hidden className="absolute inset-0 -z-10 pointer-events-none rounded-t-[40px] sm:rounded-t-[64px] rounded-b-[40px] sm:rounded-b-[64px] overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900" />
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full bg-[radial-gradient(closest-side,rgba(59,130,246,0.18),transparent)] animate-[ht-drift_20s_ease-in-out_infinite]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] rounded-full bg-[radial-gradient(closest-side,rgba(139,92,246,0.14),transparent)] animate-[ht-drift_24s_ease-in-out_-6s_infinite]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_75%)]" />
      </div>
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        <Reveal>
          <div className="text-center mb-10">
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-300 mb-3">By the numbers</div>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white">Built fast. Stays fast.</h2>
          </div>
        </Reveal>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-y-12 gap-x-6">
          {stats.map((s, i) => (
            <Reveal key={s.l} delay={i * 80}>
              <div className="text-center group">
                <div className={`text-6xl sm:text-7xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-br ${s.tone} drop-shadow-[0_2px_20px_rgba(59,130,246,0.25)] group-hover:scale-105 transition-transform`}>
                  <Counter value={s.v} suffix={s.suffix} />
                </div>
                <div className="text-[13px] text-slate-300 mt-3">{s.l}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────── FAQ (2-column with sidecar) ─────────────────────────── */

function FAQItem({ q, a, open: defaultOpen = false }: { q: string; a: ReactNode; open?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-gray-200 bg-white hover:border-blue-200 transition-colors">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-6 px-5 py-4 text-left text-gray-900 hover:text-[#1E3A8A] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6] focus-visible:ring-offset-2 rounded-xl"
        aria-expanded={open}
      >
        <span className="text-[15px] font-semibold flex items-center gap-3">
          <span className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors shrink-0 ${open ? "bg-gradient-to-br from-[#3B82F6] to-[#1E3A8A] text-white" : "bg-blue-50 text-[#3B82F6]"}`}>
            {/* Proper question-mark glyph — curl + dot rendered as a rounded-cap line so the dot is actually visible at small sizes. */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9.5 9a2.5 2.5 0 1 1 4.5 1.5c-.8 1-2 1.3-2 2.5" />
              <line x1="12" y1="17" x2="12" y2="17" />
            </svg>
          </span>
          {q}
        </span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      <div className={`overflow-hidden transition-[max-height,opacity] duration-300 ease-out ${open ? "max-h-60 opacity-100" : "max-h-0 opacity-0"}`}>
        <div className="px-5 pb-5 text-[14px] text-gray-600 leading-relaxed pl-[60px]">{a}</div>
      </div>
    </div>
  );
}

function FAQ() {
  const openAuth = useOpenAuth();
  return (
    <section id="faq" className="relative py-14 sm:py-20 overflow-hidden">
      <div aria-hidden className="absolute inset-0 -z-10 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-white via-blue-50/30 to-white" />
        <div className="absolute top-1/3 -right-32 w-[500px] h-[500px] rounded-full bg-[radial-gradient(closest-side,rgba(59,130,246,0.08),transparent)]" />
      </div>
      <GridTexture />
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        <div className="grid lg:grid-cols-[1fr_2fr] gap-10 lg:gap-16">
          {/* Sidecar */}
          <div>
            <Reveal>
              <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#3B82F6] mb-3">FAQ</div>
              <h2 className="text-3xl sm:text-[40px] sm:leading-[1.1] font-black tracking-tight text-gray-900 mb-4">Quick answers.</h2>
              <p className="text-[15px] text-gray-600 leading-relaxed mb-6">If you don't see your question, the code is open and the issues board is friendly.</p>
              <a href="https://github.com/gititmanav/Hire-Trail/issues" target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-sm font-medium text-gray-700 transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.8 10.9.6.1.8-.2.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.6-.3-5.3-1.3-5.3-5.8 0-1.3.5-2.3 1.2-3.2-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2 1-.3 2-.4 3-.4s2 .1 3 .4c2.3-1.5 3.3-1.2 3.3-1.2.6 1.6.2 2.8.1 3.1.8.8 1.2 1.9 1.2 3.2 0 4.5-2.7 5.5-5.3 5.8.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6 4.5-1.5 7.8-5.8 7.8-10.9C23.5 5.7 18.3.5 12 .5z"/></svg>
                Ask on GitHub
              </a>
            </Reveal>
            <Reveal delay={120}>
              <div className="mt-8 rounded-xl bg-gradient-to-br from-[#3B82F6] to-[#1E3A8A] p-5 text-white relative overflow-hidden">
                <div aria-hidden className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-white/10" />
                <div className="relative">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-blue-200 mb-2">Still curious?</div>
                  <p className="text-[14px] leading-relaxed mb-4">Sign up, kick the tires, delete the account if it's not for you. No card needed.</p>
                  <button type="button" onClick={() => openAuth("register")} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-[#1E3A8A] text-sm font-semibold hover:bg-blue-50 transition-colors">Try it free<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></button>
                </div>
              </div>
            </Reveal>
          </div>
          {/* Q&A */}
          <div className="space-y-3">
            {[
              { q: "Is my Gmail data safe?", a: <>HireTrail asks for <code className="text-[13px] bg-gray-100 px-1 py-0.5 rounded">gmail.readonly</code> only — we can read recent messages, never send, modify, or delete. Refresh tokens are encrypted at rest. You can disconnect any time and we revoke immediately.</>, open: true },
              { q: "Do I need an OpenAI / Anthropic API key?", a: "No — we ship with a sensible default. Bring your own key in Settings if you want full control over model choice or to avoid shared quotas. Either way, you don't pay HireTrail for inference." },
              { q: "What makes the tailoring 'no hallucinations'?", a: "The AI only suggests edits referencing the bullets, projects, and skills already in your structured master profile. It can rewrite a bullet to mirror JD keywords, but it can't invent experience you don't have. You accept or reject each suggestion line by line." },
              { q: "Can I export my data?", a: "Yes. Settings → Import/Export. You get JSON for everything (applications, contacts, deadlines, profile) plus CSV for the application list. No lock-in." },
              { q: "How is this different from Simplify or Huntr?", a: "Three things: (1) the Drafting stage means resumes-in-progress live alongside real applications instead of in a separate spreadsheet; (2) Gmail intake is wired to update stages automatically, not just import emails; (3) it's open source and BYOK on the AI side, so you control your data and your cost." },
              { q: "Is it free?", a: "Yes for now. The web app and extension are free. If you want zero shared-quota latency, plug in your own AI key — that cost goes to the provider, not us." },
            ].map((item, i) => (
              <Reveal key={i} delay={i * 40}>
                <FAQItem q={item.q} a={item.a} open={item.open} />
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────── Big gradient CTA ─────────────────────────── */

function BigCTA() {
  const openAuth = useOpenAuth();
  return (
    <section className="relative overflow-hidden rounded-t-[40px] sm:rounded-t-[64px]">
      {/* Starts one shade darker than blue-500 so the CTA top doesn't feel
       *  too bright next to the footer. Goes blue-600 → blue-700 → blue-800;
       *  the footer continues from blue-800 down into navy. */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#2563eb] via-[#1d4ed8] to-[#1E40AF]" />
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(at_30%_0%,rgba(255,255,255,0.20),transparent_55%)]" />
      <div aria-hidden className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_75%)]" />
      <div aria-hidden className="absolute top-1/2 left-0 w-96 h-96 -translate-y-1/2 rounded-full bg-white/5 blur-3xl" />
      <div className="relative max-w-5xl mx-auto px-5 sm:px-8 py-16 sm:py-24 text-center">
        <Reveal>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 ring-1 ring-white/20 backdrop-blur-sm text-[11px] font-medium text-white/90 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
            Free to start · BYOK ready · open source
          </div>
        </Reveal>
        <Reveal delay={80}>
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight text-white mb-5 leading-[1.05]">
            Stop maintaining your tracker.<br className="hidden sm:block" />
            <span className="text-blue-200">Start using one that maintains itself.</span>
          </h2>
        </Reveal>
        <Reveal delay={140}>
          <p className="text-lg text-blue-100/90 max-w-2xl mx-auto mb-9">No card, no shared spreadsheet, no manual updates. Sign up, install the extension, and your next application is the last one you'll have to track by hand.</p>
        </Reveal>
        <Reveal delay={200}>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button type="button" onClick={() => openAuth("register")} className="group relative inline-flex items-center justify-center gap-2 font-semibold px-8 py-4 text-base rounded-lg text-[#1E3A8A] bg-white hover:bg-blue-50 shadow-xl shadow-blue-950/40 hover:-translate-y-px transition-[transform,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-blue-900 overflow-hidden">
              <span aria-hidden className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-[#3B82F6]/15 to-transparent group-hover:translate-x-full transition-transform duration-700" />
              <span className="relative">Create your account</span>
              <svg className="relative" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            </button>
            <a href="/extension.zip" download="HireTrail-Extension.zip" className="inline-flex items-center justify-center gap-2 font-medium px-7 py-4 text-base rounded-lg text-white bg-white/10 hover:bg-white/15 ring-1 ring-white/20 backdrop-blur-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-blue-900">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Get the extension
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ─────────────────────────── Dark footer ─────────────────────────── */

function Footer() {
  const openAuth = useOpenAuth();
  return (
    /* Footer continues the BigCTA's deep-blue gradient — the section above ends
       at #0c1d4e and the footer starts at the same color, so there's no visible
       seam between the "stop maintaining your tracker" CTA and the legal links. */
    <footer className="relative text-blue-100/80 overflow-hidden">
      <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-[#1E40AF] via-[#1E3A8A] to-[#0a1530]" />
      <div aria-hidden className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_70%)]" />
      <div className="relative max-w-7xl mx-auto px-5 sm:px-8 py-12 grid grid-cols-2 md:grid-cols-5 gap-8 md:gap-10">
        <div className="col-span-2">
          <div className="flex items-center gap-2 mb-3">
            <BrandLogo />
            <span className="font-semibold tracking-tight text-base text-white">HireTrail</span>
          </div>
          <p className="text-[13px] text-slate-400 max-w-xs leading-relaxed">The job tracker that updates itself. Built by a student for students.</p>
          <div className="mt-5 flex items-center gap-3">
            <a href="https://github.com/gititmanav/Hire-Trail" target="_blank" rel="noreferrer noopener" className="w-9 h-9 rounded-lg bg-white/5 ring-1 ring-white/10 hover:bg-white/10 flex items-center justify-center" aria-label="GitHub">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.8 10.9.6.1.8-.2.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.6-.3-5.3-1.3-5.3-5.8 0-1.3.5-2.3 1.2-3.2-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2 1-.3 2-.4 3-.4s2 .1 3 .4c2.3-1.5 3.3-1.2 3.3-1.2.6 1.6.2 2.8.1 3.1.8.8 1.2 1.9 1.2 3.2 0 4.5-2.7 5.5-5.3 5.8.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6 4.5-1.5 7.8-5.8 7.8-10.9C23.5 5.7 18.3.5 12 .5z"/></svg>
            </a>
          </div>
        </div>
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">Product</div>
          <ul className="space-y-2 text-[13px]">
            <li><button type="button" onClick={() => openAuth("login")} className="text-slate-300 hover:text-white">Log in</button></li>
            <li><button type="button" onClick={() => openAuth("register")} className="text-slate-300 hover:text-white">Sign up</button></li>
            <li><a href="/extension.zip" download="HireTrail-Extension.zip" className="text-slate-300 hover:text-white">Extension</a></li>
          </ul>
        </div>
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">Resources</div>
          <ul className="space-y-2 text-[13px]">
            <li><a href="#features" className="text-slate-300 hover:text-white">Features</a></li>
            <li><a href="#compare" className="text-slate-300 hover:text-white">Compare</a></li>
            <li><a href="#faq" className="text-slate-300 hover:text-white">FAQ</a></li>
          </ul>
        </div>
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">Legal</div>
          <ul className="space-y-2 text-[13px]">
            <li><Link to="/privacy" className="text-slate-300 hover:text-white">Privacy</Link></li>
            <li><Link to="/terms" className="text-slate-300 hover:text-white">Terms</Link></li>
            <li><a href="https://github.com/gititmanav/Hire-Trail" target="_blank" rel="noreferrer noopener" className="text-slate-300 hover:text-white">GitHub</a></li>
          </ul>
        </div>
      </div>
      <div className="relative border-t border-white/10">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-5 text-[12px] text-blue-100/60 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>© {new Date().getFullYear()} HireTrail. Built by Manav Kaneria.</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            All systems operational
          </span>
        </div>
      </div>
    </footer>
  );
}

/* ─────────────────────────── page ─────────────────────────── */

export default function LandingPage() {
  const { setUser } = useContext(UserContext);
  const [params, setParams] = useSearchParams();
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);
  const [demoLoading, setDemoLoading] = useState(false);

  // /login and /register both redirect here with ?auth=login|register so a
  // direct URL still pops the modal instead of dead-ending on the landing.
  useEffect(() => {
    const p = params.get("auth");
    if (p === "login" || p === "register") setAuthMode(p);
  }, [params]);

  const openAuth = (mode: AuthMode) => setAuthMode(mode);
  const closeAuth = () => {
    setAuthMode(null);
    if (params.has("auth")) {
      params.delete("auth");
      setParams(params, { replace: true });
    }
  };

  /** One-click sign-in as the demo user. Forces light theme so the demo always
   *  presents the same look — even if the demo account previously toggled dark. */
  const loginDemo = async () => {
    if (demoLoading) return;
    setDemoLoading(true);
    try {
      const u = await authAPI.login(DEMO_EMAIL, DEMO_PASSWORD);
      try {
        localStorage.setItem(`hiretrail-theme-id:${u._id}`, "modern-minimal");
        localStorage.setItem("hiretrail-theme-id", "modern-minimal");
      } catch { /* localStorage unavailable — fine */ }
      toast.success(`Welcome, ${u.name}!`);
      setUser(u);
    } catch {
      toast.error("Couldn't sign in as demo. Try again in a moment.");
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <LandingAuthCtx.Provider value={{ openAuth, loginDemo, demoLoading }}>
    <div className="bg-white text-gray-900 antialiased selection:bg-blue-100 selection:text-blue-900 min-h-screen">
      <style>{`
        @keyframes ht-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        @keyframes ht-drift {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(30px, -20px) scale(1.05); }
        }
        @keyframes ht-shimmer {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
      `}</style>
      <Nav />
      <main>
        <HeroBand />
        <div id="features" />
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
        <Comparison />
        <Bento />
        <PowerUserGrid />
        <StatsStrip />
        <FAQ />
        <BigCTA />
      </main>
      <Footer />
      <AuthModal
        open={authMode !== null}
        mode={authMode ?? "login"}
        onModeChange={(m) => setAuthMode(m)}
        onClose={closeAuth}
        onLogin={(u) => { setUser(u); closeAuth(); }}
      />
    </div>
    </LandingAuthCtx.Provider>
  );
}
