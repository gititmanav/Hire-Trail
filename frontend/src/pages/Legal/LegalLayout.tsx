/** The dark shell for the public pages (About, Privacy, Terms) — the
 *  landing's palette and type, minus its motion. A slim header, a title
 *  block, and for long documents a contents rail built from the page's own
 *  sections (`section[id] > h2`) that follows your place as you read. */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import BrandMark from "../../components/BrandMark/BrandMark.tsx";
import { usePageEntryScroll } from "../../hooks/usePageEntryScroll.ts";
import "../Landing/Landing.css";
import "./Legal.css";

const PAGES = [
  { to: "/about", label: "About" },
  { to: "/privacy", label: "Privacy" },
  { to: "/terms", label: "Terms" },
];

interface Entry { id: string; label: string }

function useContents(root: React.RefObject<HTMLElement>, enabled: boolean) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    const el = root.current;
    if (!enabled || !el) return;
    const sections = Array.from(el.querySelectorAll<HTMLElement>("section[id]")).filter((s) => s.querySelector(":scope > h2"));
    setEntries(sections.map((s) => ({
      id: s.id,
      // "4. Third-party services" → "Third-party services"
      label: (s.querySelector(":scope > h2")?.textContent ?? s.id).replace(/^\d+\.\s*/, ""),
    })));
    const io = new IntersectionObserver(
      (items) => {
        const visible = items.filter((i) => i.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-96px 0px -60% 0px" },
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [root, enabled]);
  return { entries, active };
}

export default function LegalLayout({ eyebrow, title, meta, lede, contents = false, children }: {
  eyebrow: string;
  title: ReactNode;
  meta?: ReactNode;
  lede?: ReactNode;
  /** Show the contents rail (long documents). */
  contents?: boolean;
  children: ReactNode;
}) {
  const { pathname } = useLocation();
  const body = useRef<HTMLDivElement>(null);
  usePageEntryScroll();
  const { entries, active } = useContents(body, contents);

  // Dark all the way to the edges while these pages are up (overscroll, browser tint).
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("lp-root");
    root.classList.remove("lp-boot");
    const meta = document.querySelector('meta[name="theme-color"]');
    const previous = meta?.getAttribute("content") ?? null;
    meta?.setAttribute("content", "#0a0a0a");
    return () => {
      root.classList.remove("lp-root");
      if (meta && previous !== null) meta.setAttribute("content", previous);
    };
  }, []);

  return (
    <div className="lp lp-legal min-h-screen">
      <header className="sticky top-0 z-40 bg-[hsl(var(--lp-night)/0.78)] backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-[1120px] mx-auto h-16 px-6 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2.5 rounded-lg" aria-label="HireTrail home">
            <BrandMark size={26} tone="dark" />
            <span className="font-semibold tracking-[-0.02em] text-[15px]">HireTrail</span>
          </Link>
          <nav className="flex items-center gap-1" aria-label="Pages">
            {PAGES.map((p) => (
              <Link
                key={p.to}
                to={p.to}
                aria-current={pathname === p.to ? "page" : undefined}
                className={`hidden sm:inline-flex px-3 py-2 rounded-full text-[14px] font-medium transition-colors ${pathname === p.to ? "text-white" : "text-white/55 hover:text-white"}`}
              >
                {p.label}
              </Link>
            ))}
            <Link to="/" className="lp-btn lp-btn--sm lp-btn--solid-dark ml-2">
              Open HireTrail <ArrowRight size={14} strokeWidth={2.4} aria-hidden />
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-[1120px] mx-auto px-6 pt-20 sm:pt-28 pb-24">
        <div className="max-w-[760px]">
          <p className="lp-eyebrow text-[hsl(var(--lp-fog-dark))]">{eyebrow}</p>
          <h1 className="lp-h2 mt-3 text-balance">{title}</h1>
          {lede && <p className="lp-lede mt-6 text-[hsl(var(--lp-fog-dark))] text-pretty">{lede}</p>}
          {meta && <p className="mt-6 text-[13px] text-white/40">{meta}</p>}
        </div>

        <div className={`mt-16 sm:mt-20 ${contents ? "lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-16" : ""}`}>
          {contents && (
            <aside className="hidden lg:block">
              <nav className="sticky top-28" aria-label="On this page">
                <p className="text-[12px] font-medium text-white/40 mb-4">On this page</p>
                <ul className="space-y-2.5">
                  {entries.map((e) => (
                    <li key={e.id}>
                      <a
                        href={`#${e.id}`}
                        className={`block text-[13.5px] leading-snug transition-colors ${active === e.id ? "text-white" : "text-white/45 hover:text-white/80"}`}
                      >
                        {e.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            </aside>
          )}
          <div ref={body} className="theme-dark dark lp-prose max-w-[720px]">{children}</div>
        </div>
      </main>

      <footer className="border-t border-white/[0.06]">
        <div className="max-w-[1120px] mx-auto px-6 py-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-[13px] text-white/45">
          <span>© {new Date().getFullYear()} HireTrail. Built by Manav Kaneria.</span>
          <nav className="flex items-center gap-5" aria-label="Footer">
            {PAGES.map((p) => (
              <Link key={p.to} to={p.to} className="hover:text-white transition-colors">{p.label}</Link>
            ))}
            <a href="https://github.com/gititmanav/Hire-Trail" target="_blank" rel="noreferrer noopener" className="hover:text-white transition-colors">GitHub</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
