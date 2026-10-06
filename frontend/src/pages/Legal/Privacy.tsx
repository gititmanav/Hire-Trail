/** Public privacy policy. Linked from the landing, the sign-in sheet and Settings; required for Google OAuth verification. */
import LegalLayout from "./LegalLayout.tsx";

const LAST_UPDATED = "October 5, 2026";
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
          collect it, and the choices you have. It applies to HireTrail at <span className="font-medium">hiretrail.manavkaneria.me</span>,
          the HireTrail browser extension, and any backend services that power them.
        </p>
      </section>

      <section id="information-we-collect">
        <h2>1. Information we collect</h2>
        <ul>
          <li><span className="font-medium">Account information</span> &mdash; name, email address, and a password hash (we never store passwords in plain text). If you sign in with Google, we receive your name, email, and Google account ID.</li>
          <li><span className="font-medium">Job-search data you create</span> &mdash; applications, companies, contacts, deadlines, notes, resume files, and the structured master profile you build.</li>
          <li><span className="font-medium">AI keys and settings</span> &mdash; if you add your own API key (Google, Anthropic, OpenAI, xAI, DeepSeek, Mistral, Groq or OpenRouter), we store it encrypted at rest, show only its nickname and last four characters, and use it only for the AI features you put on it. We also keep where each AI feature runs for you, and a usage record of each AI call (which feature, which provider and model, tokens and estimated cost &mdash; not the content).</li>
          <li><span className="font-medium">Assistant connections</span> &mdash; if you connect an AI assistant such as Claude Code (MCP), we store a hash of its access token (never the token itself) and when it was last used.</li>
          <li><span className="font-medium">Gmail connection</span> &mdash; if you connect Gmail, we store an encrypted refresh token for the read-only scope. A scan reads only messages that look like job applications and puts what it finds in a review queue; nothing changes in your tracker until you import it. For each item in the queue we keep the sender, subject, a short snippet (up to 280 characters) and the detected company, role and stage. We never send mail, change your inbox, or keep full message bodies.</li>
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
          <li>We request the <code>gmail.readonly</code> scope only to scan recent messages you choose (a window you pick, or &ldquo;Scan now&rdquo;) for job applications, which you review before anything is added.</li>
          <li>To work out which job a thread is about, a short slice of each matching thread is sent to the AI provider that runs inbox sorting for you (HireTrail&apos;s included AI, or your own key if you chose that). It is never sent to a key marked free-tier, and never to an AI assistant.</li>
          <li>We do not use Gmail data to serve ads, for resale, or for any purpose other than the user-facing features you enable.</li>
          <li>We do not transfer Gmail data to third parties except as needed to provide or improve user-facing features, comply with applicable law, or as part of a merger / acquisition with notice to you.</li>
          <li>We do not allow humans to read your Gmail data except (a) with your explicit consent, (b) for security investigations, (c) to comply with applicable law, or (d) where the data is aggregated and used for internal operations in accordance with the Limited Use policy.</li>
        </ul>
      </section>

      <section id="how-your-data-is-used">
        <h2>3. How your data is used</h2>
        <ul>
          <li>To operate the application tracker, calendar, and analytics features in your account.</li>
          <li>To run the AI features you use &mdash; reading a job posting, checking your fit, importing a resume, proposing resume rewrites you accept or reject, and sorting inbox email &mdash; wherever you set each one to run.</li>
          <li>To find application emails in a connected Gmail inbox and put them in a review queue for you.</li>
          <li>To send transactional email (account verification, password reset, security alerts).</li>
          <li>To debug, secure, and improve the service.</li>
        </ul>
        <p>
          We do not sell your personal data. We do not use your application data, resumes, or mailbox content to train AI models. HireTrail&apos;s included AI uses providers&apos; paid APIs, which don&apos;t train on what they receive; on your own key, your provider&apos;s terms apply.
        </p>
      </section>

      <section id="third-party-services">
        <h2>4. Third-party services</h2>
        <p>HireTrail relies on a small set of vendors:</p>
        <ul>
          <li><span className="font-medium">MongoDB Atlas</span> &mdash; primary database for your account data.</li>
          <li><span className="font-medium">Cloudinary</span> &mdash; storage for uploaded resume files.</li>
          <li><span className="font-medium">Google</span> &mdash; OAuth sign-in and (optional) Gmail connection.</li>
          <li><span className="font-medium">AI providers</span> &mdash; only when an AI feature runs. Content sent is limited to what that feature needs: the job posting, the relevant parts of your profile or resume, or the slice of email being sorted. HireTrail&apos;s included AI runs on providers we choose (Settings &rarr; AI shows which); your own key sends requests under your account with that provider, billed to you and governed by its terms.</li>
          <li><span className="font-medium">Your AI assistant</span> &mdash; if you connect one (MCP), it can read the HireTrail data you ask it about and make the changes you ask for. What it receives is then governed by your agreement with that assistant&apos;s provider.</li>
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
                <td>Google AI (Gemini)</td>
                <td>AI features run on Gemini models (when HireTrail&apos;s included AI uses it, or your own key is a Google key).</td>
                <td>United States</td>
              </tr>
              <tr>
                <td>Anthropic, PBC</td>
                <td>AI features run on Claude models (included AI, or your own key).</td>
                <td>United States</td>
              </tr>
              <tr>
                <td>OpenAI, OpCo, LLC</td>
                <td>AI features run on GPT models (included AI, or your own key).</td>
                <td>United States</td>
              </tr>
              <tr>
                <td>xAI Corp.</td>
                <td>AI features run on Grok models (included AI, or your own key).</td>
                <td>United States</td>
              </tr>
              <tr>
                <td>Mistral AI</td>
                <td>AI features run on Mistral models (included AI, or your own key).</td>
                <td>European Union</td>
              </tr>
              <tr>
                <td>Groq, Inc.</td>
                <td>AI features run on open models hosted by Groq (included AI, or your own key).</td>
                <td>United States</td>
              </tr>
              <tr>
                <td>DeepSeek</td>
                <td>AI features run on DeepSeek models &mdash; only if you add your own DeepSeek key.</td>
                <td>China</td>
              </tr>
              <tr>
                <td>OpenRouter</td>
                <td>Routes AI requests to the model you choose (included AI, or your own key).</td>
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
          An AI provider receives your data only when an AI feature runs on it &mdash; you can see, and change, where each feature runs in Settings &rarr; AI. On your own key, requests are sent under your account with that provider and billed to you.
        </p>
      </section>

      <section id="storage-and-security">
        <h2>6. Storage and security</h2>
        <ul>
          <li>Passwords are hashed with bcrypt; we never store or transmit plain-text passwords.</li>
          <li>OAuth refresh tokens and your AI keys are encrypted at rest with AES-256-GCM before being written to the database. Assistant access tokens are stored only as a one-way hash.</li>
          <li>All traffic between your browser, the extension, and our servers is encrypted in transit (HTTPS).</li>
          <li>Access to production data is limited to the developer maintaining the service.</li>
        </ul>
      </section>

      <section id="data-retention">
        <h2>7. Data retention</h2>
        <p>
          We retain your data for as long as your account is active. You can delete individual records (applications, resumes,
          contacts, etc.) at any time from inside the app. You can disconnect Gmail in Settings &rarr; Connectors, which
          revokes our access at Google and deletes the stored refresh token; review-queue items from a scan are kept until you
          finish or dismiss that review. AI answers about public job postings may be cached for up to 30 days so the same
          posting isn&apos;t read twice; answers about your resume or email are never cached.
        </p>
        <p>
          To delete your entire account, use &ldquo;Delete account&rdquo; in Settings &rarr; Profile. Your account is scheduled
          for deletion 14 days later and you&apos;re signed out everywhere; signing in before then keeps it. On that day,
          everything in it is erased &mdash; applications, resumes and their files, your profile, contacts, deadlines,
          notifications, AI keys, settings and usage records, assistant connections, and inbox scans &mdash; and Google&apos;s
          access to your Gmail is revoked.
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
