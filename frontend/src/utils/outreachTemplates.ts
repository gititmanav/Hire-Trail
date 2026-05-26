/**
 * Outreach email templates — pre-built copy personalised with contact data.
 * Phase-4 feature. Designed to be one-click "Copy email" friendly so the user
 * can drop into Gmail/Outlook without leaving HireTrail.
 *
 * Each template takes a Contact + optional options and returns { subject, body }.
 * The "first name" parser is intentionally naive (split on whitespace, take
 * first token). It works for the common case ("Sarah Chen" → "Sarah") and
 * gracefully degrades for single-name contacts ("Cher" → "Cher").
 */
import type { Contact } from "../types";

export type OutreachTemplateKey =
  | "cold_intro"
  | "warm_followup"
  | "interview_thanks"
  | "coffee_chat"
  | "post_rejection";

export interface OutreachTemplateMeta {
  key: OutreachTemplateKey;
  label: string;
  /** Short hint shown next to the label in the picker. */
  hint: string;
}

export const OUTREACH_TEMPLATES: OutreachTemplateMeta[] = [
  { key: "cold_intro",        label: "Cold intro",            hint: "First-touch ask for a chat" },
  { key: "warm_followup",     label: "Follow-up bump",        hint: "When you've gone N days without a reply" },
  { key: "interview_thanks",  label: "Interview thank-you",   hint: "Send within 24h of an interview" },
  { key: "coffee_chat",       label: "Coffee chat ask",       hint: "Ask for 15–20 mins to learn about their work" },
  { key: "post_rejection",    label: "Post-rejection thanks", hint: "Keep the door open" },
];

export interface RenderedTemplate {
  subject: string;
  body: string;
}

function firstName(name: string): string {
  return (name || "").trim().split(/\s+/)[0] || "there";
}

/** Render a template with personalised fields filled in. */
export function renderOutreachTemplate(key: OutreachTemplateKey, contact: Contact): RenderedTemplate {
  const fn = firstName(contact.name);
  const company = contact.company || "your team";
  const role = contact.role ? `${contact.role}` : "your role";

  switch (key) {
    case "cold_intro":
      return {
        subject: `Quick intro — interested in ${company}`,
        body:
`Hi ${fn},

I came across your work as ${role} at ${company} and wanted to introduce myself. I'm exploring opportunities and would love to learn more about how your team operates.

Would you be open to a 15-minute chat over the next couple of weeks? Happy to work around your schedule.

Thanks for considering,
[your name]`,
      };

    case "warm_followup":
      return {
        subject: `Following up — ${company}`,
        body:
`Hi ${fn},

Wanted to circle back on my note from earlier. Totally understand things get busy — no pressure, but I'm still very interested in connecting and learning about ${company}.

If now isn't the right time, I'd love to stay in touch.

Thanks,
[your name]`,
      };

    case "interview_thanks":
      return {
        subject: `Thanks for the conversation`,
        body:
`Hi ${fn},

Thanks again for taking the time to talk today. I really enjoyed hearing about ${company} and the work your team is doing — the part about [specific thing they mentioned] especially stood out.

Happy to share anything else that would help. Looking forward to next steps.

Best,
[your name]`,
      };

    case "coffee_chat":
      return {
        subject: `Coffee chat? — ${company}`,
        body:
`Hi ${fn},

I'm trying to learn more about ${role} work at companies like ${company} as I think about my own path. Would you be open to a quick 15-20 minute coffee (in person or virtual) sometime in the next few weeks?

No agenda beyond hearing your story and getting your perspective.

Thanks,
[your name]`,
      };

    case "post_rejection":
      return {
        subject: `Thanks anyway — and staying in touch`,
        body:
`Hi ${fn},

Thanks again for considering me and for the time your team invested in the process. Even though it didn't work out this round, I appreciated the conversations and learned a lot.

If anything opens up that you think could be a fit down the road, I'd love to stay on your radar.

All the best,
[your name]`,
      };
  }
}

/** Convenience: render to a single string suitable for clipboard paste.
 *  Subject is prepended as a "Subject:" line so the user can paste into a
 *  plain editor and still see what to put in the email header. */
export function templateToClipboard(rendered: RenderedTemplate): string {
  return `Subject: ${rendered.subject}\n\n${rendered.body}`;
}
