/** The close: the page goes back to black (pinned, so the whole screen
 *  fades — never a hard edge — starting while the FAQ's last lines are
 *  still leaving: a hand-off, Landing.css), one last ask under a spotlight,
 *  then the footer, whose content settles into place as the page reaches
 *  its end. */
import { useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Mail } from "lucide-react";
import { useReducedMotion, useScene } from "../engine/hooks.ts";
import { easeInOut, easeOut, range, scrollToElement } from "../engine/scroll.ts";
import { useDemoLogin, useOpenAuth } from "../context.ts";
import { BrandMark, CHROME_STORE_URL, CONTACT_EMAIL, GITHUB_URL, GithubMark, LINKEDIN_URL, LinkedinMark } from "../parts.tsx";

function CallToAction() {
  const openAuth = useOpenAuth();
  const { loginDemo, demoLoading } = useDemoLogin();
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const darkRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const spotRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;

  useScene(sectionRef, "pin", (p) => {
    const dark = easeInOut(range(p, 0, 0.34));
    if (darkRef.current) darkRef.current.style.opacity = dark.toFixed(3);
    const copy = easeOut(range(p, 0.24, 0.74));
    if (copyRef.current) {
      copyRef.current.style.opacity = copy.toFixed(3);
      copyRef.current.style.transform = reducedRef.current ? "none" : `translate3d(0, ${Math.round((1 - copy) * 24)}px, 0)`;
      // Not clickable until it's there.
      copyRef.current.style.pointerEvents = copy > 0.5 ? "auto" : "none";
    }
    if (spotRef.current) spotRef.current.style.opacity = easeOut(range(p, 0.34, 0.92)).toFixed(3);
  }, stageRef);

  return (
    <section ref={sectionRef} className="lp-closing lp-handoff lp-handoff-pass relative" aria-labelledby="lp-closing-title">
      {/* Light until the fade is halfway: 17% into the 45svh pin (see .lp-closing). */}
      <div data-lp-tone="light" className="lp-band lp-band-before" />
      <div data-lp-tone="dark" className="lp-band lp-band-over" />
      <div data-lp-tone="dark" className="lp-band lp-band-after" />
      {/* See-through, over the FAQ's last lines and then the section's own
          white; 100lvh so it still fills the screen once a phone's toolbars
          tuck away. */}
      <div ref={stageRef} className="sticky top-0 h-screen h-lvh overflow-hidden">
        <div ref={darkRef} className="absolute inset-0 bg-[hsl(var(--lp-night))]" style={{ opacity: 0 }}>
          <div className="lp-grid opacity-70" />
          <div ref={spotRef} className="absolute inset-0" style={{ opacity: 0 }}>
            <div className="lp-spotlight" style={{ opacity: 1, ["--lp-spot-x" as string]: "-4%", ["--lp-spot-y" as string]: "-8%", ["--lp-spot-angle" as string]: "36deg", ["--lp-spot-strength" as string]: "1" }} />
          </div>
        </div>
        <div ref={copyRef} className="relative h-full flex flex-col items-center justify-center text-center px-6 text-white" style={{ opacity: 0 }}>
          <h2 id="lp-closing-title" className="lp-display max-w-[900px]">Ready when you are.</h2>
          <p className="lp-lede mt-6 max-w-[560px] text-[hsl(var(--lp-fog-dark))]">Free and open source. Set up in a minute — your next application can be the first one HireTrail tracks.</p>
          <div className="mt-10 flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto max-w-[340px] sm:max-w-none">
            <button type="button" onClick={() => openAuth("register")} className="lp-btn lp-btn--lg lp-btn--solid-dark w-full sm:w-auto">
              Create your account <ArrowRight size={17} strokeWidth={2.2} />
            </button>
            <button type="button" onClick={loginDemo} disabled={demoLoading} className="lp-btn lp-btn--lg lp-btn--glass-dark w-full sm:w-auto">
              {demoLoading ? "Opening the demo…" : "Try the live demo"}
            </button>
          </div>
          {/* The extension installs on a computer — not offered on phones and tablets. */}
          <div className="hidden lg:block mt-8">
            <a href={CHROME_STORE_URL} target="_blank" rel="noopener noreferrer" className="lp-link text-[15px] text-white/75 hover:text-white">
              Add to Chrome <ArrowRight size={15} strokeWidth={2.2} />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function FooterLink({ children, href, to, onClick, external }: { children: React.ReactNode; href?: string; to?: string; onClick?: () => void; external?: boolean }) {
  const cls = "inline-flex items-center gap-2.5 text-[15px] text-white/55 hover:text-white transition-colors rounded";
  if (to) return <Link to={to} className={cls}>{children}</Link>;
  if (onClick) return <button type="button" onClick={onClick} className={cls}>{children}</button>;
  return <a href={href} className={cls} {...(external ? { target: "_blank", rel: "noreferrer noopener" } : {})}>{children}</a>;
}

function Footer() {
  const { loginDemo } = useDemoLogin();
  const footerRef = useRef<HTMLElement>(null);
  const parts = useRef<(HTMLElement | null)[]>([]);
  const reduced = useReducedMotion();
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;

  // Settles as the page reaches its end: 0 when the footer's top enters, 1 at the very bottom.
  useScene(footerRef, "view", (_p, px) => {
    const h = footerRef.current?.offsetHeight || 1;
    const q = Math.min(1, px / h);
    parts.current.forEach((el, i) => {
      if (!el) return;
      const t = easeOut(range(q, 0.25 + i * 0.07, 0.75 + i * 0.07));
      el.style.opacity = t.toFixed(3);
      el.style.transform = reducedRef.current ? "none" : `translate3d(0, ${Math.round((1 - t) * 18)}px, 0)`;
    });
  });

  const jump = (id: string) => () => {
    const el = document.getElementById(id);
    if (el) scrollToElement(el, id === "features" ? 0 : 72);
  };
  const col = (i: number) => (el: HTMLElement | null) => { parts.current[i] = el; };

  return (
    <footer ref={footerRef} className="relative bg-[hsl(var(--lp-night))] text-white pt-24 px-3 sm:px-4" data-lp-tone="dark">
      <div className="lp-footer-panel max-w-[1400px] mx-auto px-8 sm:px-12 pt-16 pb-12">
        <div ref={col(0)} className="relative">
          <BrandMark size={44} tone="dark" />
          <p className="mt-4 text-[15px] text-white/55">© {new Date().getFullYear()} HireTrail. Built by Manav Kaneria.</p>
        </div>
        <div className="relative mt-16 grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-12">
          <nav ref={col(1)} aria-label="Product">
            <p className="text-[15px] font-medium text-white">Product</p>
            <ul className="mt-5 space-y-4">
              <li><FooterLink onClick={jump("features")}>Features</FooterLink></li>
              <li><FooterLink onClick={jump("compare")}>Compare</FooterLink></li>
              <li><FooterLink href={CHROME_STORE_URL} external>Chrome extension</FooterLink></li>
              <li><FooterLink onClick={loginDemo}>Live demo</FooterLink></li>
            </ul>
          </nav>
          <nav ref={col(2)} aria-label="Company">
            <p className="text-[15px] font-medium text-white">Company</p>
            <ul className="mt-5 space-y-4">
              <li><FooterLink to="/about">About</FooterLink></li>
              <li><FooterLink to="/privacy">Privacy Policy</FooterLink></li>
              <li><FooterLink to="/terms">Terms of Service</FooterLink></li>
            </ul>
          </nav>
          <nav ref={col(3)} aria-label="Resources">
            <p className="text-[15px] font-medium text-white">Resources</p>
            <ul className="mt-5 space-y-4">
              <li><FooterLink onClick={jump("faq")}>FAQs</FooterLink></li>
              <li><FooterLink href={GITHUB_URL} external>Source code</FooterLink></li>
              <li><FooterLink href={`${GITHUB_URL}/issues`} external>Report an issue</FooterLink></li>
              <li><FooterLink href={`${GITHUB_URL}/blob/main/CONTRIBUTING.md`} external>Contribute</FooterLink></li>
            </ul>
          </nav>
          <nav ref={col(4)} aria-label="Social links">
            <p className="text-[15px] font-medium text-white">Social Links</p>
            <ul className="mt-5 space-y-4">
              <li><FooterLink href={GITHUB_URL} external><GithubMark size={17} /> GitHub</FooterLink></li>
              <li><FooterLink href={LINKEDIN_URL} external><LinkedinMark size={16} /> LinkedIn</FooterLink></li>
              <li><FooterLink href={`mailto:${CONTACT_EMAIL}`}><Mail size={17} strokeWidth={1.8} /> Email</FooterLink></li>
            </ul>
          </nav>
        </div>
      </div>
    </footer>
  );
}

export default function Closing() {
  return (
    <>
      <CallToAction />
      <Footer />
    </>
  );
}
