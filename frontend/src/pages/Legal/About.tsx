/** Public About page — the story behind HireTrail, the builder, and the no-paywall promise. */
import { Link } from "react-router-dom";
import { ArrowRight, Mail } from "lucide-react";
import LegalLayout from "./LegalLayout.tsx";

const CONTACT_EMAIL = "manavkaneria@gmail.com";
const GITHUB_URL = "https://github.com/gititmanav/Hire-Trail";
const LINKEDIN_URL = "https://www.linkedin.com/in/manavkaneria";

const PRINCIPLES: { title: string; body: React.ReactNode }[] = [
  {
    title: "Free core. Forever.",
    body: "Every feature you’d need to run a real job search is free. If we ever offer paid tiers, they’ll be for things that cost us money to run on your behalf — never the tracking itself.",
  },
  {
    title: "Your data, your control.",
    body: "Read-only Gmail scope. Encrypted tokens. Self-serve account deletion from Settings. No selling, no sharing, no ad networks.",
  },
  {
    title: "Open source. Receipts public.",
    body: (
      <>
        Every line of the backend, frontend, and extension is on{" "}
        <a href={GITHUB_URL} target="_blank" rel="noreferrer noopener">GitHub</a>. If the promises on this page don&apos;t match the source, the source wins.
      </>
    ),
  },
  {
    title: "Built by someone who uses it.",
    body: "I run my own job search on HireTrail. The friction you feel, I feel an hour later. Bugs get reported by me before they get reported by you.",
  },
];

function Pill({ href, children, external }: { href: string; children: React.ReactNode; external?: boolean }) {
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noreferrer noopener" } : {})}
      className="lp-pill inline-flex items-center gap-2 h-9 px-3.5 rounded-full border border-white/15 bg-white/[0.04] hover:bg-white/[0.09] text-[13.5px] font-medium text-white transition-colors"
    >
      {children}
    </a>
  );
}

export default function About() {
  return (
    <LegalLayout
      eyebrow="Our story"
      title={<>Built because nobody should have to pay to look for a job.</>}
      lede="HireTrail is a free, open-source job-application tracker — made by a grad student who was tired of either drowning in spreadsheets or hitting a paywall every time he tried a better tool."
    >
      <section>
        <h2>The 38th application</h2>
        <p>
          I&rsquo;m a grad student. Somewhere around the thirty-eighth application of my season, my tracking spreadsheet hit a wall. Columns I&rsquo;d added in week one didn&rsquo;t make sense by week four. Stages I&rsquo;d typed by hand were out of date the moment a recruiter replied. I&rsquo;d open the file, lose ten minutes finding the row I wanted, forget which version of the resume I&rsquo;d sent — and then close the tab and apply to the next one anyway, because the search doesn&rsquo;t wait for you to be organized.
        </p>
        <p>By the fortieth, I knew the spreadsheet was the problem. So I went looking for something better.</p>
      </section>

      <section>
        <h2>Trying the alternatives</h2>
        <p>
          JobRight. Simplify. A handful of newer ones. They&rsquo;re actually good products — clean interfaces, real ideas, the kind of things you wish your spreadsheet could do. But every meaningful feature lived behind a paywall. Apply-form autofill: Pro. JD matching against your resume: Pro. More than ten saved applications: Pro. <em>Searching</em> your own tracker, in one of them: Pro.
        </p>
        <p>And that&rsquo;s when the absurdity landed:</p>
        <blockquote className="lp-pullquote">&ldquo;How does a jobless student pay to find a job?&rdquo;</blockquote>
        <p>
          It&rsquo;s the wrong way around. The people who need a tracker the most — students, new grads, anyone between roles — are the people who can least afford a $12/month subscription stacked on top of rent, tuition, and the occasional dignity-preserving coffee. Career services hand out PDFs about resume formatting. Nobody hands out the software to track where you sent those resumes.
        </p>
      </section>

      <section>
        <h2>The vision</h2>
        <p>
          I built HireTrail because I wanted exactly one thing: a tracker that does the boring parts for you — pipeline, deadlines, resume tailoring, inbox sync — without ever asking for a credit card to do the core job it was built for.
        </p>
        <p>
          Tracking is free. Tailoring is free. The Gmail integration that catches recruiter replies and moves your pipeline is free. The Chrome extension that captures postings in one click is free. The board, the calendar, the analytics, the export — free. Today, tomorrow, the whole season you&rsquo;re searching through. That&rsquo;s not a launch promo; it&rsquo;s the point of the product.
        </p>
      </section>

      <section>
        <h2>What that means in practice</h2>
        <div className="mt-2 grid sm:grid-cols-2 gap-x-10 gap-y-8">
          {PRINCIPLES.map((p) => (
            <div key={p.title} className="border-t border-white/10 pt-5">
              <p className="text-[16px] font-semibold text-white tracking-[-0.01em]">{p.title}</p>
              <p className="mt-2 text-[15px] leading-relaxed">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="flex flex-col sm:flex-row items-start gap-6">
          <span className="w-16 h-16 rounded-2xl bg-white text-black text-xl font-bold flex items-center justify-center shrink-0">MK</span>
          <div className="min-w-0">
            <p className="text-[12px] font-medium text-white/40">About the builder</p>
            <p className="mt-1 text-[20px] font-semibold text-white tracking-[-0.015em]">Manav Kaneria</p>
            <p className="mt-2">
              Grad student at Northeastern University. Backend by trade, full-stack by necessity. Built HireTrail over the same months I was applying to jobs — which is a strange thing to admit on an &ldquo;about&rdquo; page, but it&rsquo;s the honest reason this tool exists.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Pill href={GITHUB_URL} external>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.8 10.9.6.1.8-.2.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.6-.3-5.3-1.3-5.3-5.8 0-1.3.5-2.3 1.2-3.2-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2 1-.3 2-.4 3-.4s2 .1 3 .4c2.3-1.5 3.3-1.2 3.3-1.2.6 1.6.2 2.8.1 3.1.8.8 1.2 1.9 1.2 3.2 0 4.5-2.7 5.5-5.3 5.8.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6 4.5-1.5 7.8-5.8 7.8-10.9C23.5 5.7 18.3.5 12 .5z" /></svg>
                GitHub
              </Pill>
              <Pill href={LINKEDIN_URL} external>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13ZM7.12 20.45H3.56V9h3.56v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0Z" /></svg>
                LinkedIn
              </Pill>
              <Pill href={`mailto:${CONTACT_EMAIL}`}>
                <Mail size={14} strokeWidth={2} aria-hidden="true" />
                Email
              </Pill>
            </div>
          </div>
        </div>
      </section>

      <section className="text-center sm:text-left">
        <p className="text-[clamp(1.5rem,1rem+1.6vw,2.25rem)] leading-tight font-semibold text-white tracking-[-0.03em]">Start tracking — no card, no trial timer.</p>
        <p className="mt-3">Free forever for the core flow. Open source. Deletable in one click.</p>
        <div className="mt-7 flex flex-wrap items-center justify-center sm:justify-start gap-3">
          <Link to="/?auth=register" className="lp-btn lp-btn--solid-dark">
            Create a free account <ArrowRight size={15} strokeWidth={2.2} aria-hidden="true" />
          </Link>
          <Link to="/" className="lp-btn lp-btn--glass-dark">See how it works</Link>
        </div>
      </section>
    </LegalLayout>
  );
}
