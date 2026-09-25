/** "Yours. Always." — the four promises, each linked to where you can check it. */
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { GITHUB_URL } from "../parts.tsx";
import Reveal from "../engine/Reveal.tsx";

const PROMISES: { title: string; body: string; href: string; external?: boolean; cta: string }[] = [
  {
    title: "Read-only inbox.",
    body: "HireTrail can read your job emails — never send, edit or delete them. Disconnect whenever you like.",
    href: "/privacy",
    cta: "How we use it",
  },
  {
    title: "Never sold.",
    body: "Your data isn’t sold or shared. The few services HireTrail runs on are named in the privacy policy.",
    href: "/privacy#subprocessors",
    cta: "See the list",
  },
  {
    title: "Gone when you say.",
    body: "Delete your account from Settings and everything goes with it, immediately.",
    href: "/privacy",
    cta: "Read the policy",
  },
  {
    title: "Open source.",
    body: "Every line of HireTrail is public on GitHub. Read it, run it, improve it.",
    href: GITHUB_URL,
    external: true,
    cta: "Read the code",
  },
];

export default function Promises() {
  return (
    <section className="relative bg-white lp-on-light" data-lp-tone="light" aria-labelledby="lp-promises-title">
      <div className="max-w-[1180px] mx-auto px-6 pt-[14vh] pb-[12vh]">
        <Reveal>
          <p className="lp-eyebrow text-[hsl(var(--lp-fog-light))]">Privacy</p>
          <h2 id="lp-promises-title" className="lp-h2 mt-2 text-[hsl(var(--lp-ink))]">Yours. Always.</h2>
          <p className="lp-lede mt-5 max-w-[560px] text-[hsl(var(--lp-fog-light))]">Four promises — and where to check each one.</p>
        </Reveal>
        <div className="mt-14 grid sm:grid-cols-2 gap-x-12 gap-y-12">
          {PROMISES.map((p, i) => {
            const link = (
              <span className="lp-link mt-5 text-[15px] text-[hsl(var(--lp-ink))]">
                {p.cta} <ArrowRight size={15} strokeWidth={2.2} />
              </span>
            );
            return (
              <Reveal key={p.title} delay={i * 70} className="border-t border-black/[0.09] pt-7">
                <h3 className="lp-h3 text-[hsl(var(--lp-ink))]">{p.title}</h3>
                <p className="mt-3 text-[17px] leading-relaxed text-[hsl(var(--lp-fog-light))] max-w-[440px]">{p.body}</p>
                {p.external ? (
                  <a href={p.href} target="_blank" rel="noreferrer noopener">{link}</a>
                ) : (
                  <Link to={p.href}>{link}</Link>
                )}
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
