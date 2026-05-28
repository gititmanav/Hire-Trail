/**
 * "Privacy at a glance" trust panel — the four claims this persona checks
 * before connecting Gmail. Audit P0 #4 / Trust Signals #2.
 *
 * Each claim links to the surface that backs it up (Settings, the privacy
 * policy section, the GitHub repo), so a sceptical reader can verify in one
 * click. The card sits between the hero band and the feature showcase, on
 * the white section background, so it reads as a sober contract rather than
 * a marketing line.
 */
import { Link } from "react-router-dom";
import { Reveal } from "./motion";

const ITEMS: { title: string; body: string; href: string; external?: boolean; icon: JSX.Element }[] = [
  {
    title: "Read-only Gmail. Never sends mail.",
    body: "We request the gmail.readonly scope and use it only to detect interview, offer, and rejection signals you can revert in one click.",
    href: "/privacy#subprocessors",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2z" />
        <polyline points="22,6 12,13 2,6" />
      </svg>
    ),
  },
  {
    title: "We never share or sell your data.",
    body: "Subprocessors are listed in the privacy policy — database, hosting, and the AI provider you choose. Nothing else.",
    href: "/privacy#subprocessors",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" />
        <path d="M7 11V7a5 5 0 0110 0v4" />
      </svg>
    ),
  },
  {
    title: "Delete your account anytime.",
    body: "Self-serve, immediate, irreversible. Tokens are revoked at Google / Microsoft and every owned record is removed from our database.",
    href: "/settings",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
        <path d="M10 11v6" />
        <path d="M14 11v6" />
      </svg>
    ),
  },
  {
    title: "Open source — read the code.",
    body: "Every line of the backend, frontend, and extension is on GitHub. If the privacy claims here don't match the source, the source wins.",
    href: "https://github.com/gititmanav/Hire-Trail",
    external: true,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.8 10.9.6.1.8-.2.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.6-.3-5.3-1.3-5.3-5.8 0-1.3.5-2.3 1.2-3.2-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2 1-.3 2-.4 3-.4s2 .1 3 .4c2.3-1.5 3.3-1.2 3.3-1.2.6 1.6.2 2.8.1 3.1.8.8 1.2 1.9 1.2 3.2 0 4.5-2.7 5.5-5.3 5.8.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6 4.5-1.5 7.8-5.8 7.8-10.9C23.5 5.7 18.3.5 12 .5z" />
      </svg>
    ),
  },
];

export default function TrustPanel() {
  return (
    <section className="relative bg-white py-14 sm:py-20" aria-labelledby="trust-panel-heading">
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        <Reveal>
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold uppercase tracking-wider mb-3">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 12l2 2 4-4" />
                <circle cx="12" cy="12" r="10" />
              </svg>
              Privacy at a glance
            </div>
            <h2 id="trust-panel-heading" className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900">
              Four things we promise. All four are verifiable.
            </h2>
            <p className="mt-3 text-[15px] text-gray-600 max-w-2xl mx-auto">
              Most trackers want every scope they can get. This one doesn't. Click any claim to read the source — privacy policy, your settings, or the public repo.
            </p>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
          {ITEMS.map((item, i) => {
            const inner = (
              <>
                <div className="w-9 h-9 rounded-lg bg-blue-50 text-[#1E3A8A] flex items-center justify-center mb-3 group-hover:bg-blue-100 transition-colors shrink-0">
                  {item.icon}
                </div>
                <div className="text-[14px] font-bold text-gray-900 mb-1.5 leading-snug">{item.title}</div>
                {/* flex-1 so cards with shorter body still push the Verify chip to the bottom — keeps all four cards visually equal. */}
                <p className="text-[13px] text-gray-600 leading-relaxed flex-1">{item.body}</p>
                <div className="mt-3 text-[11px] font-semibold text-[#1E3A8A] uppercase tracking-wider inline-flex items-center gap-1 group-hover:gap-1.5 transition-all">
                  Verify
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </div>
              </>
            );
            const cls =
              "group h-full flex flex-col rounded-xl border border-gray-200 bg-white p-5 hover:border-blue-300 hover:shadow-[0_8px_30px_-12px_rgba(30,58,138,0.18)] transition-all";
            return (
              <Reveal key={i} delay={i * 60} className="h-full">
                {item.external ? (
                  <a href={item.href} target="_blank" rel="noreferrer noopener" className={cls}>
                    {inner}
                  </a>
                ) : (
                  <Link to={item.href} className={cls}>
                    {inner}
                  </Link>
                )}
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
