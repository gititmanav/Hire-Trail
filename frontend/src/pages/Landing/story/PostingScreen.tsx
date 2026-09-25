/** Act 2 — a job posting with the HireTrail extension: the edge tab, its
 *  panel ("Detected on this page", Track this job / Tailor with AI / Copy JD)
 *  and the "Tracked!" status, as the extension draws them (content.js). The
 *  posting itself is a generic job-board page. */
import { Check, ChevronRight, Copy, Sparkles } from "lucide-react";

function Glyph({ gradient, children }: { gradient: string; children: React.ReactNode }) {
  return (
    <span className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-white" style={{ background: gradient }}>
      {children}
    </span>
  );
}

function BookmarkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M19 4a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v17a1 1 0 0 0 1.55.83L12 18.2l5.45 3.63A1 1 0 0 0 19 21V4Z" />
    </svg>
  );
}

export default function PostingScreen() {
  return (
    <div className="absolute inset-0 bg-white text-[#1d1d1f]">
      <div className="h-14 px-10 flex items-center justify-between border-b border-black/[0.07]">
        <div className="flex items-center gap-2.5">
          <span className="w-7 h-7 rounded-md bg-[#1d1d1f] text-white text-[13px] font-bold flex items-center justify-center">S</span>
          <span className="text-[14px] font-semibold">Stripe</span>
        </div>
        <span className="text-[13px] text-black/45">All open roles</span>
      </div>

      <div className="relative h-[calc(100%-56px)] overflow-hidden">
        <div className="absolute left-[120px] top-9 w-[640px]">
          <h3 className="text-[30px] font-bold tracking-[-0.025em] leading-tight">Senior Frontend Engineer</h3>
          <p className="mt-1.5 text-[14px] text-black/50">Remote · United States · Full-time · $180k – $220k</p>
          <div className="mt-5 flex items-center gap-2">
            <span data-lp="apply-btn" className="h-10 px-5 rounded-lg bg-[#1d1d1f] text-white text-[13.5px] font-semibold flex items-center">Apply for this job</span>
            <span className="h-10 px-4 rounded-lg border border-black/10 text-[13.5px] font-medium text-black/70 flex items-center">Share</span>
          </div>
          <div className="mt-8 space-y-5 text-[13.5px] leading-[1.7] text-black/65 [mask-image:linear-gradient(to_bottom,#000_55%,transparent)]">
            <div>
              <p className="text-[15px] font-semibold text-[#1d1d1f] mb-1">About the role</p>
              <p>Build the interfaces millions of businesses use to run their companies — in React and TypeScript, on a design system used across every product, with a high bar for accessibility and performance.</p>
            </div>
            <div>
              <p className="text-[15px] font-semibold text-[#1d1d1f] mb-1">What you&rsquo;ll do</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Ship product with designers and engineers, from first sketch to launch.</li>
                <li>Evolve the shared component library and its accessibility standards.</li>
                <li>Make every page fast on every connection.</li>
                <li>Review code, mentor, and raise the bar for the team.</li>
              </ul>
            </div>
          </div>
        </div>

        {/* The extension's edge tab */}
        <span data-lp="ext-tab" className="absolute right-0 top-[64px] w-[34px] h-[46px] rounded-l-xl bg-white border border-r-0 border-black/10 shadow-[0_8px_24px_-8px_rgba(15,23,42,0.35)] flex items-center justify-center">
          <span className="w-[22px] h-[22px] rounded-md text-white text-[11px] font-bold flex items-center justify-center" style={{ background: "linear-gradient(135deg,#3B82F6,#1E3A8A)" }}>H</span>
          <span data-lp="ext-tab-ring" className="absolute inset-[-5px] rounded-l-[15px] border-2 border-[#3B82F6]" style={{ opacity: 0 }} />
        </span>

        {/* The extension's panel */}
        <div
          data-lp="ext-panel"
          className="absolute right-[46px] top-[40px] w-[304px] rounded-[14px] bg-white border border-black/[0.08] shadow-[0_28px_70px_-24px_rgba(15,23,42,0.45),0_2px_8px_rgba(15,23,42,0.06)] overflow-hidden"
          style={{ opacity: 0 }}
        >
          <div className="h-11 px-3.5 flex items-center justify-between border-b border-black/[0.06]">
            <span className="flex items-center gap-2 text-[13px] font-semibold">
              <span className="w-5 h-5 rounded-[5px] text-white text-[10px] font-bold flex items-center justify-center" style={{ background: "linear-gradient(135deg,#3B82F6,#1E3A8A)" }}>H</span>
              HireTrail
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-black/[0.04] text-black/50">boards.greenhouse.io</span>
          </div>
          <div data-lp="ext-detected" className="m-3 rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2.5" style={{ opacity: 0 }}>
            <p className="flex items-center gap-1 text-[10.5px] font-semibold text-emerald-700">
              <Check size={11} strokeWidth={3} /> Detected on this page
            </p>
            <p className="mt-1 text-[13px] font-semibold text-[#1d1d1f]">Senior Frontend Engineer</p>
            <p className="text-[12px] text-black/50">Stripe · Remote</p>
          </div>
          <div className="px-1.5 pb-1.5">
            <div data-lp="ext-track" className="relative flex items-center gap-3 h-[52px] px-2 rounded-lg">
              <Glyph gradient="linear-gradient(135deg,#3B82F6,#1E3A8A)"><BookmarkIcon /></Glyph>
              <span className="flex-1 text-[13.5px] font-semibold">Track this job</span>
              <ChevronRight size={14} className="text-black/30" />
            </div>
            <div className="mx-2 h-px bg-black/[0.06]" />
            <div className="flex items-center gap-3 h-[52px] px-2 rounded-lg">
              <Glyph gradient="linear-gradient(135deg,#8b5cf6,#6366f1)"><Sparkles size={16} fill="currentColor" strokeWidth={0} /></Glyph>
              <span className="flex-1 text-[13.5px] font-semibold">Tailor with AI</span>
              <ChevronRight size={14} className="text-black/30" />
            </div>
            <div className="mx-2 h-px bg-black/[0.06]" />
            <div className="flex items-center gap-3 h-[56px] px-2 rounded-lg">
              <Glyph gradient="linear-gradient(135deg,#0ea5e9,#0369a1)"><Copy size={15} strokeWidth={2} /></Glyph>
              <span className="flex-1 min-w-0">
                <span className="block text-[13.5px] font-semibold">Copy JD</span>
                <span className="block text-[11.5px] text-black/45 truncate">Copy the job description to your clipboard</span>
              </span>
              <ChevronRight size={14} className="text-black/30" />
            </div>
          </div>
          <div data-lp="ext-status" className="mx-3 mb-3 rounded-lg bg-emerald-600 text-white px-3 py-2 text-[12.5px] font-semibold flex items-center gap-2" style={{ opacity: 0 }}>
            <span className="w-4 h-4 rounded-full bg-white/25 flex items-center justify-center"><Check size={10} strokeWidth={3.5} /></span>
            Tracked! Saved to your Applied column
          </div>
        </div>
      </div>
    </div>
  );
}
