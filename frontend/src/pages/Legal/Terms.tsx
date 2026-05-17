/** Public terms of service. Linked from auth pages + sidebar footer; required for Google OAuth verification. */
import { Link } from "react-router-dom";

const LAST_UPDATED = "May 16, 2026";
const CONTACT_EMAIL = "kaneria.ma@northeastern.edu";

export default function Terms() {
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
            <Link to="/login" className="text-muted-foreground hover:text-foreground">Sign in</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-extrabold tracking-tight mb-2">Terms of Service</h1>
        <p className="text-sm text-muted-foreground mb-8">Last updated: {LAST_UPDATED}</p>

        <div className="space-y-7 text-[15px] leading-relaxed text-foreground/90">
          <section>
            <p>
              These Terms govern your use of HireTrail (&ldquo;the Service&rdquo;) at hiretrail.vercel.app, the HireTrail browser
              extension, and any associated backend APIs operated by Manav Kaneria (&ldquo;we&rdquo;, &ldquo;us&rdquo;). By
              creating an account or using the Service you agree to these Terms. If you don&apos;t agree, please don&apos;t use
              the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">1. The Service</h2>
            <p>
              HireTrail helps you organize a job search: track applications, manage deadlines, store a structured resume profile,
              tailor a resume to a job description with AI, and (optionally) sync stage changes from a connected Gmail or Outlook
              inbox. Features evolve over time and may be added, changed, or removed.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">2. Your account</h2>
            <ul className="list-disc pl-6 space-y-1.5">
              <li>You must be at least 13 years old to use HireTrail.</li>
              <li>You are responsible for keeping your password and any connected provider tokens secure.</li>
              <li>You are responsible for the activity that happens under your account.</li>
              <li>One person per account. You may not share login credentials.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">3. Acceptable use</h2>
            <p className="mb-2">You agree not to:</p>
            <ul className="list-disc pl-6 space-y-1.5">
              <li>Use the Service to violate any law or third-party right.</li>
              <li>Upload content that is unlawful, infringing, malicious, or that you don&apos;t have the right to upload.</li>
              <li>Reverse-engineer, scrape, or overload the Service in a way that disrupts other users.</li>
              <li>Use HireTrail to send unsolicited communications or to circumvent any third-party platform&apos;s terms (e.g., automated form-filling on job-board ATS pages).</li>
              <li>Attempt to access another user&apos;s account or data.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">4. Your content</h2>
            <p>
              You retain ownership of the resumes, application records, notes, and other content you upload or create
              (&ldquo;Your Content&rdquo;). You grant us a limited license to store, process, and display Your Content solely so we
              can provide the Service to you (for example, rendering your resume, classifying a connected-mailbox message, or
              running the AI Tailor). We do not use Your Content to train AI models.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">5. AI features</h2>
            <p>
              AI-generated suggestions (resume rewrites, fit scores, email classifications) are produced by third-party language
              models and may be incorrect, incomplete, or biased. You are responsible for reviewing AI output before relying on
              it or sending it to anyone. We make no representation that AI-generated content is accurate or suitable for any
              particular job application.
            </p>
            <p className="mt-2">
              When you bring your own API key, requests run on your provider account and incur charges according to that
              provider&apos;s pricing; we are not responsible for those charges.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">6. Connected accounts</h2>
            <p>
              If you connect Google or Microsoft sign-in or a Gmail / Outlook mailbox, you authorize HireTrail to access the data
              described in our <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link> and only for the
              purposes described there. You can disconnect at any time from the Settings page or by revoking access in your
              Google / Microsoft account dashboard. Your use of Google data is also subject to the Google API Services User Data
              Policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">7. Service availability</h2>
            <p>
              HireTrail is provided on a best-effort basis. We may take it down for maintenance, updates, or for any reason
              without prior notice. We may also impose rate limits or quotas to keep the Service stable.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">8. Termination</h2>
            <p>
              You can stop using HireTrail and delete your data at any time. We may suspend or terminate accounts that violate
              these Terms or that abuse the Service. On termination, the rights granted to you in these Terms end and we will
              delete your account data within 30 days, except for what we are required to retain by law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">9. Disclaimers</h2>
            <p>
              THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo; WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR
              IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT
              WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR THAT AI OUTPUT WILL BE ACCURATE.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">10. Limitation of liability</h2>
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, HIRETRAIL AND ITS OPERATORS WILL NOT BE LIABLE FOR ANY INDIRECT,
              INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR FOR LOST PROFITS, REVENUES, DATA, OR OPPORTUNITIES,
              ARISING OUT OF YOUR USE OF THE SERVICE. OUR TOTAL LIABILITY FOR ANY CLAIM RELATED TO THE SERVICE WILL NOT EXCEED
              ONE HUNDRED U.S. DOLLARS (USD 100) OR THE AMOUNT YOU PAID US IN THE TWELVE MONTHS PRECEDING THE CLAIM, WHICHEVER
              IS GREATER.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">11. Changes</h2>
            <p>
              We may update these Terms from time to time. Material changes will be announced in-app. Your continued use of the
              Service after a change becomes effective constitutes acceptance of the updated Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">12. Governing law</h2>
            <p>
              These Terms are governed by the laws of the Commonwealth of Massachusetts, USA, without regard to its conflict-of-laws
              provisions. Disputes will be resolved in the state or federal courts located in Massachusetts, and you consent to
              their jurisdiction.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">13. Contact</h2>
            <p>
              Questions about these Terms? Email{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline">{CONTACT_EMAIL}</a>.
            </p>
          </section>
        </div>

        <footer className="mt-16 pt-6 border-t border-border text-sm text-muted-foreground flex items-center justify-between">
          <Link to="/" className="hover:text-foreground">&larr; Back to HireTrail</Link>
          <Link to="/privacy" className="hover:text-foreground">Privacy Policy</Link>
        </footer>
      </main>
    </div>
  );
}
