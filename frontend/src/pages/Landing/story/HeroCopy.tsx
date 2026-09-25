/** The hero's words and buttons — shared by the desktop story and the phone
 *  story. Sits on the beams, scrolls away as the product arrives. */
import type { RefObject } from "react";
import { ArrowRight } from "lucide-react";
import { useDemoLogin, useOpenAuth } from "../context.ts";
import { GITHUB_URL, GithubMark } from "../parts.tsx";

export default function HeroCopy({ copyRef }: { copyRef: RefObject<HTMLDivElement> }) {
  const openAuth = useOpenAuth();
  const { loginDemo, demoLoading } = useDemoLogin();
  return (
    <div className="relative flex flex-col items-center justify-start lg:justify-center text-center px-6 pt-[88px] lg:pt-0 lg:pb-[18svh]" style={{ minHeight: "var(--lp-hero)" }}>
      <div ref={copyRef} className="flex flex-col items-center">
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noreferrer noopener"
          className="lp-rise group inline-flex items-center gap-2 h-9 pl-3 pr-3.5 rounded-full lp-panel-dark text-[13px] font-medium text-white/85 hover:text-white"
          style={{ ["--lp-delay" as string]: "0ms" }}
        >
          <GithubMark size={15} />
          Free and open source
          <ArrowRight size={13} strokeWidth={2.2} className="transition-transform group-hover:translate-x-0.5" />
        </a>
        <h1 className="lp-display lp-rise mt-5 lg:mt-7 text-white" style={{ ["--lp-delay" as string]: "70ms" }}>
          <span className="block">Tailor. Apply. Track.</span>
          <span className="block lp-sheen-text pb-[0.08em]">Without the spreadsheet.</span>
        </h1>
        <p className="lp-lede lp-rise mt-4 lg:mt-6 max-w-[640px] text-[hsl(var(--lp-fog-dark))] text-pretty" style={{ ["--lp-delay" as string]: "140ms" }}>
          HireTrail tailors your resume to every posting, saves jobs from six boards in one click, and catches recruiter replies in your inbox.
        </p>
        <div className="lp-rise mt-7 lg:mt-9 flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto max-w-[340px] sm:max-w-none" style={{ ["--lp-delay" as string]: "210ms" }}>
          <button type="button" onClick={() => openAuth("register")} className="lp-btn lp-btn--lg lp-btn--solid-dark w-full sm:w-auto">
            Get started — free <ArrowRight size={17} strokeWidth={2.2} />
          </button>
          <button type="button" onClick={loginDemo} disabled={demoLoading} className="lp-btn lp-btn--lg lp-btn--glass-dark w-full sm:w-auto">
            {demoLoading ? "Opening the demo…" : "Try the live demo"}
          </button>
        </div>
        <p className="lp-rise mt-6 lg:mt-8 flex flex-wrap justify-center gap-x-2 sm:gap-x-3 gap-y-1 text-[12px] sm:text-[13px] text-white/45" style={{ ["--lp-delay" as string]: "280ms" }}>
          <span>6 job boards</span><span aria-hidden>·</span><span>40+ AI providers</span><span aria-hidden>·</span><span>100% open source</span>
        </p>
      </div>
    </div>
  );
}
