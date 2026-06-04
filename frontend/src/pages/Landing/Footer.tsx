import { Link } from "react-router-dom";
import { BrandLogo } from "./brand";
import { useOpenAuth } from "./context";

/* ─────────────────────────── Dark footer ─────────────────────────── */

export default function Footer() {
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
            <li><a href="https://chromewebstore.google.com/detail/cgibkejpkbfhkcdjlnkgebdnacpfonhl" target="_blank" rel="noopener noreferrer" className="text-slate-300 hover:text-white">Extension</a></li>
          </ul>
        </div>
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">Resources</div>
          <ul className="space-y-2 text-[13px]">
            <li><a href="#features" className="text-slate-300 hover:text-white">Features</a></li>
            <li><a href="#compare" className="text-slate-300 hover:text-white">Compare</a></li>
            <li><a href="#faq" className="text-slate-300 hover:text-white">FAQ</a></li>
            <li><Link to="/about" className="text-slate-300 hover:text-white">About</Link></li>
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
