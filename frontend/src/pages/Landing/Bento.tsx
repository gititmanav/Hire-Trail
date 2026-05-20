import { Reveal, GlowCard } from "./motion";

/* ─────────────────────────── Bento (DARK, mouse-tracked glow) ─────────────────────────── */

export default function Bento() {
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
