/** Public privacy policy. Linked from the landing, the sign-in sheet and Settings; required for Google OAuth verification. */
import LegalLayout from "./LegalLayout.tsx";

const LAST_UPDATED = "May 27, 2026";
const CONTACT_EMAIL = "manavkaneria@gmail.com";

export default function Privacy() {
  return (
    <LegalLayout
      eyebrow="Legal"
      title="Privacy Policy"
      lede="What HireTrail collects, why it collects it, and the choices you have."
      meta={<>Last updated {LAST_UPDATED}</>}
      contents
    >
      <section>
        <p>
          HireTrail (&ldquo;we&rdquo;, &ldquo;us&rdquo;) is a personal job-application tracker that helps you manage applications,
          tailor resumes, and keep your tracker in sync with your inbox. This policy explains what we collect, why we
          collect it, and the choices you have. It applies to HireTrail at <span className="font-medium">hiretrail.vercel.app</span>,
          the HireTrail browser extension, and any backend services that power them.
        </p>
      </section>

      <section id="information-we-collect">
        <h2>1. Information we collect</h2>
        <ul>
          <li><span className="font-medium">Account information</span> &mdash; name, email address, and a password hash (we never store passwords in plain text). If you sign in with Google, we receive your name, email, and Google account ID.</li>
          <li><span className="font-medium">Job-search data you create</span> &mdash; applications, companies, contacts, deadlines, notes, resume files, and the structured master profile you build.</li>
          <li><span className="font-medium">AI provider keys</span> &mdash; if you bring your own Anthropic, OpenAI, Google, or OpenRouter API key, we store it encrypted at rest and only use it to make requests on your behalf.</li>
          <li><span className="font-medium">Gmail / Outlook connection</span> &mdash; if you connect a mailbox, we store an encrypted refresh token. We request the minimum scope (read-only) and use it only to detect interview / rejection / offer signals and propose stage updates to your tracker. We never read mail outside of this scope, send mail on your behalf, or store full message bodies; only the message ID, signal, and a short summary are retained.</li>
          <li><span className="font-medium">Operational data</span> &mdash; session cookies, audit logs of administrative actions, and basic error logs needed to keep the service running.</li>
        </ul>
      </section>

      <section id="google-user-data">
        <h2>2. How we use Google user data</h2>
        <p>
          HireTrail&apos;s use of information received from Google APIs adheres to the
          {" "}<a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer">Google API Services User Data Policy</a>,
          including the Limited Use requirements.
        </p>
        <ul>
          <li>We request the <code>gmail.readonly</code> scope only to scan recent messages for job-application signals you can confirm or revert in-app.</li>
          <li>We do not use Gmail data to serve ads, for resale, or for any purpose other than the user-facing features you enable.</li>
          <li>We do not transfer Gmail data to third parties except as needed to provide or improve user-facing features, comply with applicable law, or as part of a merger / acquisition with notice to you.</li>
          <li>We do not allow humans to read your Gmail data except (a) with your explicit consent, (b) for security investigations, (c) to comply with applicable law, or (d) where the data is aggregated and used for internal operations in accordance with the Limited Use policy.</li>
        </ul>
      </section>

      <section id="how-your-data-is-used">
        <h2>3. How your data is used</h2>
        <ul>
          <li>To operate the application tracker, calendar, and analytics features in your account.</li>
          <li>To tailor your resume to a job description when you trigger the AI Tailor feature.</li>
          <li>To classify connected-mailbox messages and suggest stage updates, which you can confirm or revert.</li>
          <li>To send transactional email (account verification, password reset, security alerts).</li>
          <li>To debug, secure, and improve the service.</li>
        </ul>
        <p>
          We do not sell your personal data. We do not use your application data, resumes, or mailbox content to train AI models.
        </p>
      </section>

      <section id="third-party-services">
        <h2>4. Third-party services</h2>
        <p>HireTrail relies on a small set of vendors:</p>
        <ul>
          <li><span className="font-medium">MongoDB Atlas</span> &mdash; primary database for your account data.</li>
          <li><span className="font-medium">Cloudinary</span> &mdash; storage for uploaded resume files.</li>
          <li><span className="font-medium">Google &amp; Microsoft</span> &mdash; OAuth sign-in and (optional) mailbox connection.</li>
          <li><span className="font-medium">AI providers (Anthropic, OpenAI, Google, OpenRouter)</span> &mdash; only when you invoke an AI feature. Content sent is limited to the job description, the relevant parts of your resume profile, and the email being classified. Each vendor&apos;s own retention policy applies once the request leaves us. If you bring your own API key, requests are billed to and governed by your provider account.</li>
        </ul>
      </section>

      <section id="subprocessors">
        <h2>5. Subprocessors</h2>
        <p>
          The complete list of subprocessors that may process your personal data on our behalf. We update this list before adding a new subprocessor.
        </p>
        <div className="mt-6 overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th scope="col">Subprocessor</th>
                <th scope="col">Purpose</th>
                <th scope="col">Data location</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>MongoDB Atlas</td>
                <td>Primary database (account, applications, resumes metadata, encrypted tokens).</td>
                <td>United States</td>
              </tr>
              <tr>
                <td>Cloudinary</td>
                <td>Storage and delivery of uploaded resume files and company logos.</td>
                <td>United States</td>
              </tr>
              <tr>
                <td>Vercel</td>
                <td>Web application hosting and TLS termination.</td>
                <td>United States (global edge)</td>
              </tr>
              <tr>
                <td>Google LLC</td>
                <td>Google OAuth sign-in and Gmail read-only API for inbox scanning.</td>
                <td>United States</td>
              </tr>
              <tr>
                <td>Microsoft Corporation</td>
                <td>Outlook OAuth and Microsoft Graph mail API (when you connect Outlook).</td>
                <td>United States</td>
              </tr>
              <tr>
                <td>Anthropic, PBC</td>
                <td>Claude models for resume parsing, JD matching, and email classification (when invoked).</td>
                <td>United States</td>
              </tr>
              <tr>
                <td>OpenAI, OpCo, LLC</td>
                <td>GPT models for resume parsing, JD matching, and email classification (when invoked).</td>
                <td>United States</td>
              </tr>
              <tr>
                <td>Google AI (Gemini)</td>
                <td>Gemini models for resume parsing, JD matching, and email classification (when invoked).</td>
                <td>United States</td>
              </tr>
              <tr>
                <td>OpenRouter</td>
                <td>Model gateway for additional AI providers (only when explicitly selected).</td>
                <td>United States</td>
              </tr>
              <tr>
                <td>Resend</td>
                <td>Transactional email delivery (account verification, security alerts, broadcasts).</td>
                <td>United States</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="lp-note mt-6">
          AI subprocessors are only invoked when you trigger an AI feature (Tailor, resume parse, email scan). If you provide your own API key for a provider, requests for that feature are sent under your own account with that vendor and billed to you.
        </p>
      </section>

      <section id="storage-and-security">
        <h2>6. Storage and security</h2>
        <ul>
          <li>Passwords are hashed with bcrypt; we never store or transmit plain-text passwords.</li>
          <li>OAuth refresh tokens and BYOK API keys are encrypted at rest with AES-256-GCM before being written to the database.</li>
          <li>All traffic between your browser, the extension, and our servers is encrypted in transit (HTTPS).</li>
          <li>Access to production data is limited to the developer maintaining the service.</li>
        </ul>
      </section>

      <section id="data-retention">
        <h2>7. Data retention</h2>
        <p>
          We retain your data for as long as your account is active. You can delete individual records (applications, resumes,
          contacts, etc.) at any time from inside the app. You can disconnect Gmail / Outlook from the Settings page, which
          revokes our access at the provider and deletes the stored refresh token. To delete your entire account and all
          associated data, use the &ldquo;Delete account&rdquo; button under Settings &rarr; Account; this is immediate and
          irreversible, revokes any connected mailbox tokens, and removes your data from our database.
        </p>
      </section>

      <section id="your-rights">
        <h2>8. Your rights</h2>
        <p>
          Depending on where you live, you may have rights to access, correct, export, or delete the data we hold about you,
          and to object to or restrict certain processing. To exercise any of these rights, contact us at the email below.
        </p>
      </section>

      <section id="children">
        <h2>9. Children</h2>
        <p>HireTrail is not directed to children under 13, and we do not knowingly collect personal information from them.</p>
      </section>

      <section id="changes">
        <h2>10. Changes to this policy</h2>
        <p>
          We will update the &ldquo;Last updated&rdquo; date above whenever this policy changes. Material changes will also be
          announced in-app the next time you sign in.
        </p>
      </section>

      <section id="contact">
        <h2>11. Contact</h2>
        <p>
          Questions or requests about this policy? Email{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </section>
    </LegalLayout>
  );
}
