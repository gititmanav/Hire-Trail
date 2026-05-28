/** Public About page — the story behind HireTrail, the builder, and the no-paywall promise. */
import { Link } from "react-router-dom";

const CONTACT_EMAIL = "kaneria.ma@northeastern.edu";
const GITHUB_URL = "https://github.com/gititmanav/Hire-Trail";
const LINKEDIN_URL = "https://www.linkedin.com/in/manavkaneria";

export default function About() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-extrabold tracking-tight">
            <img src="/logo.svg" alt="" className="w-7 h-7" />
            <span>
              <span className="text-foreground">Hire</span>
              <span className="text-primary">Trail</span>
            </span>
          </Link>
          <nav className="text-sm flex items-center gap-4">
            <Link to="/privacy" className="text-muted-foreground hover:text-foreground">Privacy</Link>
            <Link to="/terms" className="text-muted-foreground hover:text-foreground">Terms</Link>
            <Link to="/login" className="text-muted-foreground hover:text-foreground">Sign in</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-14">
        {/* Hero */}
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-bold uppercase tracking-wider mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            Our story
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-[1.1] mb-4">
            Built because nobody should have to pay to <span className="text-primary">look for a job.</span>
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
            HireTrail is a free, open-source job-application tracker — made by a grad student who was tired of either drowning in spreadsheets or hitting a paywall every time he tried a better tool.
          </p>
        </div>

        {/* Story */}
        <div className="space-y-7 text-[15.5px] leading-relaxed text-foreground/90">
          <section>
            <h2 className="text-xl font-bold mb-2">The 38th application</h2>
            <p>
              I&rsquo;m a grad student. Somewhere around the thirty-eighth application of my season, my tracking spreadsheet hit a wall. Columns I&rsquo;d added in week one didn&rsquo;t make sense by week four. Stages I&rsquo;d typed by hand were out of date the moment a recruiter replied. I&rsquo;d open the file, lose ten minutes finding the row I wanted, forget which version of the resume I&rsquo;d sent — and then close the tab and apply to the next one anyway, because the search doesn&rsquo;t wait for you to be organized.
            </p>
            <p className="mt-3">
              By the fortieth, I knew the spreadsheet was the problem. So I went looking for something better.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-2">Trying the alternatives</h2>
            <p>
              JobRight. Simplify. A handful of newer ones. They&rsquo;re actually good products — clean interfaces, real ideas, the kind of things you wish your spreadsheet could do. But every meaningful feature lived behind a paywall. Apply-form autofill: Pro. JD matching against your resume: Pro. More than ten saved applications: Pro. <em>Searching</em> your own tracker, in one of them: Pro.
            </p>
            <p className="mt-3">
              And that&rsquo;s when the absurdity landed:
            </p>
            <blockquote className="mt-4 border-l-4 border-primary pl-5 italic text-foreground/95 text-[17px] leading-snug">
              How does a jobless student pay to find a job?
            </blockquote>
            <p className="mt-4">
              It&rsquo;s the wrong way around. The people who need a tracker the most — students, new grads, anyone between roles — are the people who can least afford a $12/month subscription stacked on top of rent, tuition, and the occasional dignity-preserving coffee. Career services hand out PDFs about resume formatting. Nobody hands out the software to track where you sent those resumes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-2">The vision</h2>
            <p>
              I built HireTrail because I wanted exactly one thing: a tracker that does the boring parts for you — pipeline, deadlines, resume tailoring, inbox sync — without ever asking for a credit card to do the core job it was built for.
            </p>
            <p className="mt-3">
              Tracking is free. Tailoring is free. The Gmail integration that auto-updates your pipeline when a recruiter replies is free. The Chrome extension that captures postings in one click is free. The Kanban board, the calendar, the analytics, the export — free. Today, tomorrow, the whole season you&rsquo;re searching through. That&rsquo;s not a launch promo; it&rsquo;s the point of the product.
            </p>
          </section>
        </div>

        {/* Principles */}
        <section className="mt-12">
          <h2 className="text-xl font-bold mb-5">What that means in practice</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Principle
              title="Free core. Forever."
              body="Every feature you&apos;d need to run a real job search is free. If we ever offer paid tiers, they&apos;ll be for things that cost us money to run on your behalf — never the tracking itself."
            />
            <Principle
              title="Your data, your control."
              body="Read-only Gmail scope. Encrypted tokens. Self-serve account deletion from Settings. No selling, no sharing, no ad networks."
            />
            <Principle
              title="Open source. Receipts public."
              body={
                <>
                  Every line of the backend, frontend, and extension is on{" "}
                  <a href={GITHUB_URL} target="_blank" rel="noreferrer noopener" className="text-primary hover:underline">GitHub</a>. If the promises on this page don&apos;t match the source, the source wins.
                </>
              }
            />
            <Principle
              title="Built by someone who uses it."
              body="I run my own job search on HireTrail. The friction you feel, I feel an hour later. Bugs get reported by me before they get reported by you."
            />
          </div>
        </section>

        {/* Builder */}
        <section className="mt-12 rounded-2xl border border-border bg-card/50 p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row items-start gap-5">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-700 flex items-center justify-center text-white font-extrabold text-xl shadow-lg shadow-blue-500/25 shrink-0">
              MK
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-bold uppercase tracking-wider text-primary/80 mb-1">About the builder</div>
              <h3 className="text-lg font-bold text-foreground">Manav Kaneria</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Grad student at Northeastern University. Backend by trade, full-stack by necessity. Built HireTrail over the same months I was applying to jobs — which is a strange thing to admit on an &ldquo;about&rdquo; page, but it&rsquo;s the honest reason this tool exists.
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-4">
                <a
                  href={GITHUB_URL}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-[12.5px] font-medium"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.8 10.9.6.1.8-.2.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.6-.3-5.3-1.3-5.3-5.8 0-1.3.5-2.3 1.2-3.2-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2 1-.3 2-.4 3-.4s2 .1 3 .4c2.3-1.5 3.3-1.2 3.3-1.2.6 1.6.2 2.8.1 3.1.8.8 1.2 1.9 1.2 3.2 0 4.5-2.7 5.5-5.3 5.8.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6 4.5-1.5 7.8-5.8 7.8-10.9C23.5 5.7 18.3.5 12 .5z"/></svg>
                  GitHub
                </a>
                <a
                  href={LINKEDIN_URL}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-[12.5px] font-medium"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.5 2h-17A1.5 1.5 0 002 3.5v17A1.5 1.5 0 003.5 22h17a1.5 1.5 0 001.5-1.5v-17A1.5 1.5 0 0020.5 2zM8 19H5V8h3v11zM6.5 6.7a1.7 1.7 0 110-3.5 1.7 1.7 0 010 3.5zM19 19h-3v-5.5c0-1.5-.5-2.5-1.8-2.5-1 0-1.6.7-1.9 1.4-.1.2-.1.6-.1 1V19h-3V8h3v1.3c.5-.8 1.4-1.6 3-1.6 2.2 0 3.8 1.4 3.8 4.5V19z"/></svg>
                  LinkedIn
                </a>
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-[12.5px] font-medium"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                  Email
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="mt-12 text-center">
          <h3 className="text-2xl font-extrabold tracking-tight mb-2">Start tracking — no card, no trial timer.</h3>
          <p className="text-muted-foreground mb-5">Free forever for the core flow. Open source. Deletable in one click.</p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Link
              to="/register"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-semibold shadow-sm"
            >
              Create a free account
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </Link>
            <Link
              to="/"
              className="inline-flex items-center px-5 py-2.5 rounded-lg border border-border bg-background hover:bg-muted text-sm font-semibold"
            >
              See the features
            </Link>
          </div>
        </section>

        <footer className="mt-16 pt-6 border-t border-border text-sm text-muted-foreground flex items-center justify-between">
          <Link to="/" className="hover:text-foreground">&larr; Back to HireTrail</Link>
          <div className="flex items-center gap-4">
            <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link to="/terms" className="hover:text-foreground">Terms</Link>
          </div>
        </footer>
      </main>
    </div>
  );
}

function Principle({ title, body }: { title: string; body: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card/50 p-4">
      <div className="text-[14px] font-bold text-foreground mb-1">{title}</div>
      <p className="text-[13.5px] text-muted-foreground leading-relaxed">{body}</p>
    </div>
  );
}
