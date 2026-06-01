import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Play } from "lucide-react";
import { useOpenAuth, useDemoLogin } from "./context";
import { BrandLogo, PrimaryCTA } from "./brand";

/* ─────────────────────────── nav ─────────────────────────── */

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const openAuth = useOpenAuth();
  const { loginDemo, demoLoading } = useDemoLogin();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollTo = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (!el) return;
    const headerOffset = 96;
    const top = el.getBoundingClientRect().top + window.scrollY - headerOffset;
    window.scrollTo({ top, behavior: "smooth" });
  };

  return (
    /* Two-state nav. At page top: full-width transparent strip. After 30px
     *  scroll: centered white pill with shadow.
     *
     *  Perf: max-width is the ONLY layout-triggering property that animates.
     *  Height, padding, logo size, and CTA shape are all locked across both
     *  states so the only per-frame layout cost is width recalculation. All
     *  other transitions (bg, border, shadow, border-radius) are paint-only
     *  and composite-friendly. `will-change` promotes the container so the
     *  browser can prepare for the animation. */
    <header className="sticky top-0 z-50 pt-3 pb-1">
      <div
        // will-change only helps for compositable properties; max-width is a
        // layout property and ignores the hint. Listing it here actually wastes
        // GPU memory. Only the paint/composite-friendly props are hinted.
        style={{ willChange: scrolled ? "box-shadow, background-color, backdrop-filter" : "auto" }}
        className={`mx-auto transition-[max-width,background-color,border-color,box-shadow,border-radius,backdrop-filter] duration-300 ease-out rounded-full ${
          scrolled
            ? "max-w-5xl bg-white/95 backdrop-blur shadow-[0_12px_36px_-12px_rgba(15,23,42,0.18)] border border-gray-200/70"
            : "max-w-7xl bg-transparent border border-transparent"
        }`}
      >
        <div className="flex items-center justify-between h-12 px-5 sm:px-6">
          <Link to="/" className="flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6] focus-visible:ring-offset-2 rounded">
            <BrandLogo size={28} />
            <span className="font-semibold tracking-tight text-base text-gray-900">HireTrail</span>
          </Link>
          <nav className="flex items-center gap-1 sm:gap-1.5 md:gap-3">
            <a href="#features" onClick={scrollTo("features")} className="hidden md:inline-flex text-sm font-medium text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md transition-colors">Features</a>
            <a href="#compare" onClick={scrollTo("compare")} className="hidden md:inline-flex text-sm font-medium text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md transition-colors">Compare</a>
            <a href="#faq" onClick={scrollTo("faq")} className="hidden md:inline-flex text-sm font-medium text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md transition-colors">FAQ</a>
            <button
              type="button"
              onClick={loginDemo}
              disabled={demoLoading}
              className="hidden sm:inline-flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:text-gray-900 px-3 py-1.5 rounded-full bg-white/70 hover:bg-white border border-gray-200 hover:border-gray-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6] focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-wait"
              title="Skip signup and explore with the demo account"
            >
              <Play size={13} strokeWidth={2.2} aria-hidden="true" />
              {demoLoading ? "Signing in…" : "Try demo"}
            </button>
            <button type="button" onClick={() => openAuth("login")} className="hidden sm:inline-flex text-sm font-medium text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6] focus-visible:ring-offset-2">Log in</button>
            <PrimaryCTA onClick={() => openAuth("register")} size="md" shape="pill" className="whitespace-nowrap">Sign up free</PrimaryCTA>
          </nav>
        </div>
      </div>
    </header>
  );
}
