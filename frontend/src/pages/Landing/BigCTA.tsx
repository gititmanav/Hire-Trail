import { ArrowRight, Download } from "lucide-react";
import { Reveal } from "./motion";
import { useOpenAuth } from "./context";

/* ─────────────────────────── Big gradient CTA ─────────────────────────── */

export default function BigCTA() {
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
          <h2 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight text-white mb-5 leading-[1.05]">
            Stop maintaining your tracker.<br className="hidden sm:block" />
            <span className="text-blue-200">Start using one that maintains itself.</span>
          </h2>
        </Reveal>
        <Reveal delay={140}>
          <p className="text-base sm:text-lg text-blue-100/90 max-w-2xl mx-auto mb-9">No card, no shared spreadsheet, no manual updates. Sign up, install the extension, and your next application is the last one you'll have to track by hand.</p>
        </Reveal>
        <Reveal delay={200}>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button type="button" onClick={() => openAuth("register")} className="group relative inline-flex items-center justify-center gap-2 font-semibold px-8 py-4 text-base rounded-lg text-[#1E3A8A] bg-white hover:bg-blue-50 shadow-xl shadow-blue-950/40 hover:-translate-y-px transition-[transform,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-blue-900 overflow-hidden">
              <span aria-hidden className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-[#3B82F6]/15 to-transparent group-hover:translate-x-full transition-transform duration-700" />
              <span className="relative">Create your account</span>
              <ArrowRight className="relative" size={14} strokeWidth={2.5} />
            </button>
            <a href="/extension.zip" download="HireTrail-Extension.zip" className="inline-flex items-center justify-center gap-2 font-medium px-7 py-4 text-base rounded-lg text-white bg-white/10 hover:bg-white/15 ring-1 ring-white/20 backdrop-blur-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-blue-900">
              <Download size={16} strokeWidth={2} />
              Get the extension
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
