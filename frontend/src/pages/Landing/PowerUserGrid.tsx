import { Reveal, GlowCard, GridTexture } from "./motion";
import { StageChip } from "./brand";

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

/* ─────────────────────────── Power-user grid ─────────────────────────── */

export default function PowerUserGrid() {
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
