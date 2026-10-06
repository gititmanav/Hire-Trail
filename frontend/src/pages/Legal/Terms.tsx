/** Public terms of service. Linked from the landing, the sign-in sheet and Settings; required for Google OAuth verification. */
import { Link } from "react-router-dom";
import LegalLayout from "./LegalLayout.tsx";

const LAST_UPDATED = "October 5, 2026";
const CONTACT_EMAIL = "manavkaneria@gmail.com";

export default function Terms() {
  return (
    <LegalLayout
      eyebrow="Legal"
      title="Terms of Service"
      lede="The agreement between you and HireTrail when you use the app and the extension."
      meta={<>Last updated {LAST_UPDATED}</>}
      contents
    >
      <section>
        <p>
          These Terms govern your use of HireTrail (&ldquo;the Service&rdquo;) at hiretrail.vercel.app, the HireTrail browser
          extension, and any associated backend APIs operated by Manav Kaneria (&ldquo;we&rdquo;, &ldquo;us&rdquo;). By
          creating an account or using the Service you agree to these Terms. If you don&apos;t agree, please don&apos;t use
          the Service.
        </p>
      </section>

      <section id="the-service">
        <h2>1. The Service</h2>
        <p>
          HireTrail helps you organize a job search: track applications, manage deadlines, store a structured resume profile,
          tailor a resume to a job description with AI, find application emails in a connected Gmail inbox for you to review,
          and use HireTrail from your own AI assistant. Features evolve over time and may be added, changed, or removed.
        </p>
      </section>

      <section id="your-account">
        <h2>2. Your account</h2>
        <ul>
          <li>You must be at least 13 years old to use HireTrail.</li>
          <li>You are responsible for keeping your password and any connected provider tokens secure.</li>
          <li>You are responsible for the activity that happens under your account.</li>
          <li>One person per account. You may not share login credentials.</li>
        </ul>
      </section>

      <section id="acceptable-use">
        <h2>3. Acceptable use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>Use the Service to violate any law or third-party right.</li>
          <li>Upload content that is unlawful, infringing, malicious, or that you don&apos;t have the right to upload.</li>
          <li>Reverse-engineer, scrape, or overload the Service in a way that disrupts other users.</li>
          <li>Use HireTrail to send unsolicited communications or to circumvent any third-party platform&apos;s terms (e.g., automated form-filling on job-board ATS pages).</li>
          <li>Attempt to access another user&apos;s account or data.</li>
        </ul>
      </section>

      <section id="your-content">
        <h2>4. Your content</h2>
        <p>
          You retain ownership of the resumes, application records, notes, and other content you upload or create
          (&ldquo;Your Content&rdquo;). You grant us a limited license to store, process, and display Your Content solely so we
          can provide the Service to you (for example, rendering your resume, sorting a connected inbox&apos;s application
          emails, or proposing resume rewrites). We do not use Your Content to train AI models.
        </p>
      </section>

      <section id="ai-features">
        <h2>5. AI features</h2>
        <p>
          AI output (posting reads, fit checks, proposed resume rewrites, inbox sorting) comes from third-party language
          models and may be incorrect, incomplete, or biased. Resume rewrites are proposals: nothing changes until you accept
          one, and you are responsible for reviewing what you accept before relying on it or sending it to anyone. We make no
          representation that AI-generated content is accurate or suitable for any particular job application.
        </p>
        <p>
          HireTrail&apos;s included AI is free within a monthly allowance and may be limited, changed, or paused. When you use
          your own API key, requests run on your provider account and incur charges at that provider&apos;s prices; we are not
          responsible for those charges. When a feature runs in your own AI assistant, it runs under your agreement with that
          assistant&apos;s provider.
        </p>
      </section>

      <section id="connected-accounts">
        <h2>6. Connected accounts</h2>
        <p>
          If you sign in with Google, connect Gmail, or connect an AI assistant, you authorize HireTrail to access the data
          described in our <Link to="/privacy">Privacy Policy</Link> and only for the purposes described there. You can
          disconnect Gmail in Settings &rarr; Connectors (or revoke access in your Google account), and remove an assistant
          connection in Settings &rarr; AI, at any time. HireTrail&apos;s use of Google data follows the Google API Services
          User Data Policy, including its Limited Use requirements.
        </p>
      </section>

      <section id="service-availability">
        <h2>7. Service availability</h2>
        <p>
          HireTrail is provided on a best-effort basis. We may take it down for maintenance, updates, or for any reason
          without prior notice. We may also impose rate limits or quotas to keep the Service stable.
        </p>
      </section>

      <section id="termination">
        <h2>8. Termination</h2>
        <p>
          You can stop using HireTrail at any time. Deleting your account from Settings &rarr; Profile schedules it for
          deletion 14 days later; signing in before then keeps it, and after that everything in it is erased. We may suspend
          or terminate accounts that violate these Terms or that abuse the Service; on termination, the rights granted to you
          in these Terms end and we delete your account data within 30 days, except for what we are required to retain by law.
        </p>
      </section>

      <section id="disclaimers">
        <h2>9. Disclaimers</h2>
        <p>
          THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo; WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR
          IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT
          WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR THAT AI OUTPUT WILL BE ACCURATE.
        </p>
      </section>

      <section id="limitation-of-liability">
        <h2>10. Limitation of liability</h2>
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, HIRETRAIL AND ITS OPERATORS WILL NOT BE LIABLE FOR ANY INDIRECT,
          INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR FOR LOST PROFITS, REVENUES, DATA, OR OPPORTUNITIES,
          ARISING OUT OF YOUR USE OF THE SERVICE. OUR TOTAL LIABILITY FOR ANY CLAIM RELATED TO THE SERVICE WILL NOT EXCEED
          ONE HUNDRED U.S. DOLLARS (USD 100) OR THE AMOUNT YOU PAID US IN THE TWELVE MONTHS PRECEDING THE CLAIM, WHICHEVER
          IS GREATER.
        </p>
      </section>

      <section id="changes">
        <h2>11. Changes</h2>
        <p>
          We may update these Terms from time to time. Material changes will be announced in-app. Your continued use of the
          Service after a change becomes effective constitutes acceptance of the updated Terms.
        </p>
      </section>

      <section id="governing-law">
        <h2>12. Governing law</h2>
        <p>
          These Terms are governed by the laws of the Commonwealth of Massachusetts, USA, without regard to its conflict-of-laws
          provisions. Disputes will be resolved in the state or federal courts located in Massachusetts, and you consent to
          their jurisdiction.
        </p>
      </section>

      <section id="contact">
        <h2>13. Contact</h2>
        <p>
          Questions about these Terms? Email{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </section>
    </LegalLayout>
  );
}
