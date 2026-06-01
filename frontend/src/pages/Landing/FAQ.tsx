import { useState, type ReactNode } from "react";
import { HelpCircle, ChevronDown, ArrowRight } from "lucide-react";
import { Reveal, GridTexture } from "./motion";
import { useOpenAuth } from "./context";

/* ─────────────────────────── FAQ (2-column with sidecar) ─────────────────────────── */

function FAQItem({ q, a, open: defaultOpen = false }: { q: string; a: ReactNode; open?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-gray-200 bg-white hover:border-blue-200 transition-colors">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-4 sm:gap-6 px-4 sm:px-5 py-4 text-left text-gray-900 hover:text-[#1E3A8A] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6] focus-visible:ring-offset-2 rounded-xl"
        aria-expanded={open}
      >
        <span className="text-[14px] sm:text-[15px] font-semibold flex items-center gap-2.5 sm:gap-3">
          <span className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center transition-colors shrink-0 ${open ? "bg-gradient-to-br from-[#3B82F6] to-[#1E3A8A] text-white" : "bg-blue-50 text-[#3B82F6]"}`}>
            <HelpCircle size={18} strokeWidth={2.4} aria-hidden />
          </span>
          {q}
        </span>
        <ChevronDown size={18} strokeWidth={2.5} className={`shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <div className={`overflow-hidden transition-[max-height,opacity] duration-300 ease-out ${open ? "max-h-80 opacity-100" : "max-h-0 opacity-0"}`}>
        <div className="px-4 sm:px-5 pb-5 text-[14px] text-gray-600 leading-relaxed pl-14 sm:pl-[60px]">{a}</div>
      </div>
    </div>
  );
}

export default function FAQ() {
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
                  <button type="button" onClick={() => openAuth("register")} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-[#1E3A8A] text-sm font-semibold hover:bg-blue-50 transition-colors">Try it free<ArrowRight size={12} strokeWidth={2.5} /></button>
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
