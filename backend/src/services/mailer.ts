import nodemailer, { Transporter } from "nodemailer";

let cachedTransporter: Transporter | null = null;

function getConfig() {
  const sender = process.env.EMAIL_SENDER || "";
  const password = process.env.EMAIL_APP_PASSWORD || "";
  const host = process.env.EMAIL_SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.EMAIL_SMTP_PORT || 465);
  const senderName = process.env.EMAIL_SENDER_NAME || "HireTrail";
  return { sender, password, host, port, senderName };
}

export function isMailerConfigured(): boolean {
  const { sender, password } = getConfig();
  return Boolean(sender && password);
}

export function getMailerStatus() {
  const { sender, host, port, senderName } = getConfig();
  return {
    configured: isMailerConfigured(),
    sender,
    senderName,
    host,
    port,
  };
}

function getTransporter(): Transporter {
  if (cachedTransporter) return cachedTransporter;
  const { sender, password, host, port } = getConfig();
  if (!sender) throw new Error("EMAIL_SENDER is not set");
  if (!password) throw new Error("EMAIL_APP_PASSWORD is not set");
  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user: sender, pass: password },
  });
  return cachedTransporter;
}

export async function verifyMailer(): Promise<void> {
  await getTransporter().verify();
}

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

export async function sendEmail(input: SendEmailInput): Promise<{ messageId: string }> {
  const { sender, senderName } = getConfig();
  if (!sender) throw new Error("EMAIL_SENDER is not set");
  const transporter = getTransporter();
  const info = await transporter.sendMail({
    from: `"${senderName}" <${sender}>`,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
    replyTo: input.replyTo,
  });
  return { messageId: info.messageId };
}

/**
 * Strip HTML tags for the text fallback. Keeps the email accessible to
 * plain-text clients without pulling in a heavyweight dependency.
 */
export function htmlToText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
