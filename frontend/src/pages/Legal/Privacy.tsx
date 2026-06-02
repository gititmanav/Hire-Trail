/** Public privacy policy. Linked from auth pages + sidebar footer; required for Google OAuth verification. */
import { Link } from "react-router-dom";
import { BrandLogo } from "../Landing/brand";

const LAST_UPDATED = "May 27, 2026";
const CONTACT_EMAIL = "manavkaneria@gmail.com";

export default function Privacy() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <BrandLogo size={28} />
            <span className="font-semibold tracking-tight text-base text-foreground">HireTrail</span>
          </Link>
          <nav className="text-sm flex items-center gap-4">
            <Link to="/terms" className="text-muted-foreground hover:text-foreground">Terms</Link>
            <Link to="/login" className="text-muted-foreground hover:text-foreground">Sign in</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-extrabold tracking-tight mb-2">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-8">Last updated: {LAST_UPDATED}</p>

        <div className="space-y-7 text-[15px] leading-relaxed text-foreground/90">
          <section>
            <p>
              HireTrail (&ldquo;we&rdquo;, &ldquo;us&rdquo;) is a personal job-application tracker that helps you manage applications,
              tailor resumes, and keep your tracker in sync with your inbox. This policy explains what we collect, why we
              collect it, and the choices you have. It applies to HireTrail at <span className="font-medium">hiretrail.vercel.app</span>,
              the HireTrail browser extension, and any backend services that power them.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">1. Information we collect</h2>
            <ul className="list-disc pl-6 space-y-1.5">
              <li><span className="font-medium">Account information</span> &mdash; name, email address, and a password hash (we never store passwords in plain text). If you sign in with Google, we receive your name, email, and Google account ID.</li>
              <li><span className="font-medium">Job-search data you create</span> &mdash; applications, companies, contacts, deadlines, notes, resume files, and the structured master profile you build.</li>
              <li><span className="font-medium">AI provider keys</span> &mdash; if you bring your own Anthropic, OpenAI, Google, or OpenRouter API key, we store it encrypted at rest and only use it to make requests on your behalf.</li>
              <li><span className="font-medium">Gmail / Outlook connection</span> &mdash; if you connect a mailbox, we store an encrypted refresh token. We request the minimum scope (read-only) and use it only to detect interview / rejection / offer signals and propose stage updates to your tracker. We never read mail outside of this scope, send mail on your behalf, or store full message bodies; only the message ID, signal, and a short summary are retained.</li>
              <li><span className="font-medium">Operational data</span> &mdash; session cookies, audit logs of administrative actions, and basic error logs needed to keep the service running.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">2. How we use Google user data</h2>
            <p className="mb-2">
              HireTrail&apos;s use of information received from Google APIs adheres to the
              {" "}<a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Google API Services User Data Policy</a>,
              including the Limited Use requirements.
            </p>
            <ul className="list-disc pl-6 space-y-1.5">
              <li>We request the <code className="text-xs bg-muted px-1.5 py-0.5 rounded">gmail.readonly</code> scope only to scan recent messages for job-application signals you can confirm or revert in-app.</li>
              <li>We do not use Gmail data to serve ads, for resale, or for any purpose other than the user-facing features you enable.</li>
              <li>We do not transfer Gmail data to third parties except as needed to provide or improve user-facing features, comply with applicable law, or as part of a merger / acquisition with notice to you.</li>
              <li>We do not allow humans to read your Gmail data except (a) with your explicit consent, (b) for security investigations, (c) to comply with applicable law, or (d) where the data is aggregated and used for internal operations in accordance with the Limited Use policy.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">3. How your data is used</h2>
            <ul className="list-disc pl-6 space-y-1.5">
              <li>To operate the application tracker, calendar, and analytics features in your account.</li>
              <li>To tailor your resume to a job description when you trigger the AI Tailor feature.</li>
              <li>To classify connected-mailbox messages and suggest stage updates, which you can confirm or revert.</li>
              <li>To send transactional email (account verification, password reset, security alerts).</li>
              <li>To debug, secure, and improve the service.</li>
            </ul>
            <p className="mt-3">
              We do not sell your personal data. We do not use your application data, resumes, or mailbox content to train AI models.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">4. Third-party services</h2>
            <p className="mb-2">HireTrail relies on a small set of vendors:</p>
            <ul className="list-disc pl-6 space-y-1.5">
              <li><span className="font-medium">MongoDB Atlas</span> &mdash; primary database for your account data.</li>
              <li><span className="font-medium">Cloudinary</span> &mdash; storage for uploaded resume files.</li>
              <li><span className="font-medium">Google &amp; Microsoft</span> &mdash; OAuth sign-in and (optional) mailbox connection.</li>
              <li><span className="font-medium">AI providers (Anthropic, OpenAI, Google, OpenRouter)</span> &mdash; only when you invoke an AI feature. Content sent is limited to the job description, the relevant parts of your resume profile, and the email being classified. Each vendor&apos;s own retention policy applies once the request leaves us. If you bring your own API key, requests are billed to and governed by your provider account.</li>
            </ul>
          </section>

          <section id="subprocessors">
            <h2 className="text-xl font-semibold mb-2">5. Subprocessors</h2>
            <p className="mb-3">
              The complete list of subprocessors that may process your personal data on our behalf. We update this list before adding a new subprocessor.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-border rounded-lg">
                <thead className="bg-muted/50">
                  <tr className="text-left">
                    <th className="px-3 py-2 font-semibold">Subprocessor</th>
                    <th className="px-3 py-2 font-semibold">Purpose</th>
                    <th className="px-3 py-2 font-semibold">Data location</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <tr>
                    <td className="px-3 py-2 font-medium">MongoDB Atlas</td>
                    <td className="px-3 py-2">Primary database (account, applications, resumes metadata, encrypted tokens).</td>
                    <td className="px-3 py-2">United States</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-medium">Cloudinary</td>
                    <td className="px-3 py-2">Storage and delivery of uploaded resume files and company logos.</td>
                    <td className="px-3 py-2">United States</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-medium">Vercel</td>
                    <td className="px-3 py-2">Web application hosting and TLS termination.</td>
                    <td className="px-3 py-2">United States (global edge)</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-medium">Google LLC</td>
                    <td className="px-3 py-2">Google OAuth sign-in and Gmail read-only API for inbox scanning.</td>
                    <td className="px-3 py-2">United States</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-medium">Microsoft Corporation</td>
                    <td className="px-3 py-2">Outlook OAuth and Microsoft Graph mail API (when you connect Outlook).</td>
                    <td className="px-3 py-2">United States</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-medium">Anthropic, PBC</td>
                    <td className="px-3 py-2">Claude models for resume parsing, JD matching, and email classification (when invoked).</td>
                    <td className="px-3 py-2">United States</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-medium">OpenAI, OpCo, LLC</td>
                    <td className="px-3 py-2">GPT models for resume parsing, JD matching, and email classification (when invoked).</td>
                    <td className="px-3 py-2">United States</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-medium">Google AI (Gemini)</td>
                    <td className="px-3 py-2">Gemini models for resume parsing, JD matching, and email classification (when invoked).</td>
                    <td className="px-3 py-2">United States</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-medium">OpenRouter</td>
                    <td className="px-3 py-2">Model gateway for additional AI providers (only when explicitly selected).</td>
                    <td className="px-3 py-2">United States</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-medium">Resend</td>
                    <td className="px-3 py-2">Transactional email delivery (account verification, security alerts, broadcasts).</td>
                    <td className="px-3 py-2">United States</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              AI subprocessors are only invoked when you trigger an AI feature (Tailor, resume parse, email scan). If you provide your own API key for a provider, requests for that feature are sent under your own account with that vendor and billed to you.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">6. Storage and security</h2>
            <ul className="list-disc pl-6 space-y-1.5">
              <li>Passwords are hashed with bcrypt; we never store or transmit plain-text passwords.</li>
              <li>OAuth refresh tokens and BYOK API keys are encrypted at rest with AES-256-GCM before being written to the database.</li>
              <li>All traffic between your browser, the extension, and our servers is encrypted in transit (HTTPS).</li>
              <li>Access to production data is limited to the developer maintaining the service.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">7. Data retention</h2>
            <p>
              We retain your data for as long as your account is active. You can delete individual records (applications, resumes,
              contacts, etc.) at any time from inside the app. You can disconnect Gmail / Outlook from the Settings page, which
              revokes our access at the provider and deletes the stored refresh token. To delete your entire account and all
              associated data, use the &ldquo;Delete account&rdquo; button under Settings &rarr; Account; this is immediate and
              irreversible, revokes any connected mailbox tokens, and removes your data from our database.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">8. Your rights</h2>
            <p>
              Depending on where you live, you may have rights to access, correct, export, or delete the data we hold about you,
              and to object to or restrict certain processing. To exercise any of these rights, contact us at the email below.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">9. Children</h2>
            <p>HireTrail is not directed to children under 13, and we do not knowingly collect personal information from them.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">10. Changes to this policy</h2>
            <p>
              We will update the &ldquo;Last updated&rdquo; date above whenever this policy changes. Material changes will also be
              announced in-app the next time you sign in.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">11. Contact</h2>
            <p>
              Questions or requests about this policy? Email{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline">{CONTACT_EMAIL}</a>.
            </p>
          </section>
        </div>

        <footer className="mt-16 pt-6 border-t border-border text-sm text-muted-foreground flex items-center justify-between">
          <Link to="/" className="hover:text-foreground">&larr; Back to HireTrail</Link>
          <Link to="/terms" className="hover:text-foreground">Terms of Service</Link>
        </footer>
      </main>
    </div>
  );
}
