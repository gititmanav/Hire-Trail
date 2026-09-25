/** The landing header. Same layout and motion as before — a full-width strip
 *  at the top that tucks into a centred pill once the page scrolls — but its
 *  colours follow the chapter underneath it (white on the dark chapters,
 *  ink on the light ones), so it never disappears into the page. */
import { Link } from "react-router-dom";
import { ArrowRight, Play } from "lucide-react";
import { useDemoLogin, useOpenAuth } from "./context";
import { useScrolled, useTone } from "./engine/hooks.ts";
import { scrollToElement } from "./engine/scroll.ts";
import { BrandMark } from "./parts.tsx";

const LINKS = [
  { id: "features", label: "Features" },
  { id: "compare", label: "Compare" },
  { id: "faq", label: "FAQ" },
];

export default function Nav() {
  const openAuth = useOpenAuth();
  const { loginDemo, demoLoading } = useDemoLogin();
  const scrolled = useScrolled();
  const tone = useTone();
  const dark = tone === "dark";

  const jump = (id: string) => (e: React.MouseEvent) => {
    const el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    scrollToElement(el, id === "features" ? 0 : 72);
    history.replaceState(null, "", `#${id}`);
  };

  const quiet = dark ? "text-white/65 hover:text-white" : "text-black/55 hover:text-black";
  const shell = scrolled
    ? dark
      ? "max-w-5xl bg-black/55 border-white/10 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.65)] backdrop-blur-xl"
      : "max-w-5xl bg-white/80 border-black/[0.06] shadow-[0_12px_36px_-12px_rgba(15,23,42,0.18)] backdrop-blur-xl"
    : "max-w-7xl bg-transparent border-transparent";

  return (
    <header className="fixed top-0 inset-x-0 z-50 pt-3 pb-1 px-3 pointer-events-none">
      <div className={`lp-nav-shell pointer-events-auto mx-auto rounded-full border ${shell}`}>
        <div className="flex items-center justify-between h-12 pl-4 pr-2 sm:pl-5 sm:pr-2.5">
          <Link to="/" className={`flex items-center gap-2 rounded-lg ${dark ? "text-white" : "text-[hsl(var(--lp-ink))]"}`} aria-label="HireTrail home">
            <BrandMark size={26} tone={dark ? "dark" : "light"} />
            <span className="hidden min-[360px]:inline font-semibold tracking-[-0.02em] text-[15px]">HireTrail</span>
          </Link>
          <nav className="flex items-center gap-1 sm:gap-1.5" aria-label="Main">
            {LINKS.map((l) => (
              <a key={l.id} href={`#${l.id}`} onClick={jump(l.id)} className={`hidden md:inline-flex text-[14px] font-medium px-3 py-2 rounded-full transition-colors ${quiet}`}>
                {l.label}
              </a>
            ))}
            <button
              type="button"
              onClick={loginDemo}
              disabled={demoLoading}
              title="Skip sign-up and explore with the demo account"
              className={`hidden sm:inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-[14px] font-medium border transition-colors disabled:opacity-60 disabled:cursor-wait ${
                dark
                  ? "text-white/85 border-white/15 bg-white/[0.06] hover:bg-white/[0.12] hover:text-white"
                  : "text-black/75 border-black/10 bg-white/70 hover:bg-white hover:text-black"
              }`}
            >
              <Play size={12} strokeWidth={2.4} aria-hidden="true" />
              {demoLoading ? "Signing in…" : "Try demo"}
            </button>
            <button type="button" onClick={() => openAuth("login")} className={`inline-flex text-[14px] font-medium px-2.5 sm:px-3 py-2 rounded-full transition-colors ${quiet}`}>
              Log in
            </button>
            <button type="button" onClick={() => openAuth("register")} className={`lp-btn lp-btn--sm ${dark ? "lp-btn--solid-dark" : "lp-btn--solid-light"}`}>
              Sign up free <ArrowRight size={14} strokeWidth={2.4} aria-hidden="true" />
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
}
