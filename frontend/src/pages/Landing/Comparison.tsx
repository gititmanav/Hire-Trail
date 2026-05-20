import { Reveal, GridTexture } from "./motion";
import { BrandLogo } from "./brand";

export default function Comparison() {
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
          <div className="rounded-2xl border border-gray-200 bg-white overflow-x-auto shadow-[0_30px_80px_-30px_rgba(15,23,42,0.25)]">
            <div className="min-w-[600px]">
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
          </div>
        </Reveal>
      </div>
    </section>
  );
}
