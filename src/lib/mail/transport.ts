import "server-only";

import nodemailer, { type Transporter } from "nodemailer";

/**
 * Outbound mail.
 *
 * SMTP 465 only. IMAP (993) and POP3 (995) are inbound protocols - this app
 * never reads mail, so configuring them would be dead config.
 *
 * Every message is sent through here rather than being composed at the call
 * site, so the sender identity and the failure handling live in one place: a
 * mail outage must never roll back a payment or a signup, because the payment
 * is already recorded in Firestore and the member can always re-request a
 * receipt.
 */

let cached: Transporter | null = null;

function transporter(): Transporter {
  if (cached) return cached;

  const port = Number(process.env.MAIL_PORT ?? 465);
  cached = nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port,
    // 465 is implicit TLS; 587 is STARTTLS and must not set this.
    secure: port === 465,
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASSWORD,
    },
  });
  return cached;
}

export type MailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

/**
 * Send mail, swallowing failures.
 *
 * Callers treat email as a courtesy, not a transaction: the account exists, or
 * the payment is paid, regardless of whether this returns. A bounce is logged
 * and reported through the return value so the caller can queue a retry, but it
 * never throws into the request that triggered it.
 */
export async function sendMail(message: MailMessage): Promise<boolean> {
  try {
    await transporter().sendMail({
      from: process.env.MAIL_FROM ?? "Fignal Platinum <no-reply@farisium.com>",
      ...message,
    });
    return true;
  } catch (error) {
    console.error("[mail] failed to send", message.subject, error);
    return false;
  }
}

/** Inbox for desk-owner notifications (new signup, failed payment, abuse). */
export const adminInbox = (): string =>
  process.env.MAIL_ADMIN_INBOX ?? process.env.MAIL_USER ?? "";