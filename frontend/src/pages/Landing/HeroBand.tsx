import { Link } from "react-router-dom";
import { Info } from "lucide-react";
import { useOpenAuth } from "./context";
import { Reveal, Parallax } from "./motion";
import { BrandLogo, PrimaryCTA, SecondaryCTA, StageChip } from "./brand";

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
      {/* Floating notification chips — already hidden on mobile */}
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

/* ─────────────────────────── Hero ─────────────────────────── */

function Hero() {
  const openAuth = useOpenAuth();
  return (
    <section className="relative">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 pt-6 pb-6 sm:pt-10 sm:pb-8 text-center">
        <Reveal>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/90 border border-blue-200 text-[11px] font-medium text-[#1E3A8A] shadow-sm mb-5">
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
          <h1 className="text-[2.5rem] leading-[1.1] sm:text-5xl md:text-6xl lg:text-[76px] lg:leading-[1.02] font-black tracking-tight text-gray-900 mb-5">
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

/* ─────────────────────────── Board strip ─────────────────────────── */

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
              <div key={b.name} className="group flex items-center justify-center gap-2.5 px-3 py-3.5 rounded-xl bg-white/90 border border-blue-100 hover:border-blue-200 hover:shadow-sm hover:-translate-y-0.5 transition-[border-color,box-shadow,transform]">
                <img src={b.src} alt={`${b.name} logo`} loading="lazy" className="w-6 h-6 object-contain shrink-0" />
                <span className="hidden sm:inline text-sm font-semibold text-gray-700">{b.name}</span>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ─────────────────────────── Founder bar ─────────────────────────── */

function FounderBar() {
  return (
    <section className="relative max-w-7xl mx-auto px-5 sm:px-8 py-5 sm:py-9">
      <Reveal>
        <div className="rounded-2xl border border-blue-100 bg-white/95 shadow-[0_30px_60px_-30px_rgba(30,58,138,0.25)] px-6 py-5 sm:px-8 sm:py-6 flex flex-col sm:flex-row items-start sm:items-center gap-5">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#3B82F6] to-[#1E3A8A] flex items-center justify-center text-white font-bold text-sm shadow-md shadow-blue-500/30 shrink-0">MK</div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#1E3A8A]/70 mb-1">Built by a job seeker, for job seekers</div>
            <p className="text-gray-900 text-[15px] leading-relaxed">
              I built HireTrail in grad school, after 40 applications turned my spreadsheet into a graveyard and every better tool I tried asked for my credit card. The point is simple: the people who need a tracker the most shouldn&rsquo;t have to pay for one.
            </p>
            <div className="text-[12px] text-gray-500 mt-1.5">— Manav Kaneria, creator</div>
          </div>
          {/* Buttons stack on mobile (full-width), sit side-by-side on desktop. */}
          <div className="self-stretch sm:self-auto flex flex-col sm:flex-row gap-2 shrink-0">
            <Link
              to="/about"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-[13px] font-medium text-gray-700 transition-colors"
            >
              <Info size={14} strokeWidth={2} aria-hidden />
              About us
            </Link>
            <a
              href="https://github.com/gititmanav/Hire-Trail"
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-[13px] font-medium text-gray-700 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.8 10.9.6.1.8-.2.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.6-.3-5.3-1.3-5.3-5.8 0-1.3.5-2.3 1.2-3.2-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2 1-.3 2-.4 3-.4s2 .1 3 .4c2.3-1.5 3.3-1.2 3.3-1.2.6 1.6.2 2.8.1 3.1.8.8 1.2 1.9 1.2 3.2 0 4.5-2.7 5.5-5.3 5.8.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6 4.5-1.5 7.8-5.8 7.8-10.9C23.5 5.7 18.3.5 12 .5z"/></svg>
              Open source
            </a>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/* ─────────────────────────── HERO BAND (continuous blue gradient covering hero + board + founder) ─────────────────────────── */

export default function HeroBand() {
  return (
    /* Uniform sky-blue field (jobright-style) — solid blue from the top of the
     *  page through the founder bar, ending in a curved bottom that flows into
     *  the white section below. The base sky-blue lives DIRECTLY on this
     *  container (not in an absolute -z-10 backdrop) so it's painted as the
     *  element's own background, sidestepping all stacking-context issues with
     *  the LandingPage's outer bg-white. Decorative orbs/grid sit on top of
     *  that base but below the content, via plain source-order stacking. */
    <div className="relative overflow-hidden -mt-[66px] pt-[66px] rounded-b-[40px] sm:rounded-b-[80px] bg-[#cfe7ff] shadow-[0_30px_60px_-30px_rgba(30,58,138,0.20)]">
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
