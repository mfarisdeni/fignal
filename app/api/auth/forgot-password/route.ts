import { NextResponse } from "next/server";
import { z } from "zod";
import { adminAuth } from "@/lib/firebase/server";
import { mailPasswordReset } from "@/lib/mail/templates";
import {
  checkRateLimit,
  clientIp,
  normalizeEmail,
  rateLimited,
  serviceUnavailable,
} from "@/lib/auth/rate-limit";

/**
 * POST /api/auth/forgot-password - email a reset link.
 *
 * The link comes from the Admin SDK rather than Firebase's client
 * sendPasswordResetEmail, because the client path forces the message through
 * Firebase's own SMTP relay. Generating it here means mail goes out from
 * mail.farisium.com with our template and our branding.
 *
 * The response is identical whether or not the address exists. Distinguishing
 * them would turn this endpoint into an account-enumeration oracle.
 */

const body = z.object({ email: z.string().email().max(254) });

export async function POST(request: Request) {
  const ipResult = await checkRateLimit(request, {
    name: "forgot-ip",
    identifier: clientIp(request),
    identifierClass: "ip",
    limit: 10,
    window: "1 h",
    failClosed: false,
  });
  if (!ipResult.ok) {
    return ipResult.unavailable ? serviceUnavailable() : rateLimited(ipResult.retryAfter);
  }

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const { email } = parsed.data;

  // Per-address bucket so one inbox cannot be mail-bombed. It consumes on every
  // attempt: success and failure are deliberately indistinguishable here.
  const emailResult = await checkRateLimit(request, {
    name: "forgot-email",
    identifier: normalizeEmail(email),
    identifierClass: "email",
    limit: 3,
    window: "1 h",
    mode: "fixed",
    failClosed: false,
  });
  if (!emailResult.ok) {
    return emailResult.unavailable ? serviceUnavailable() : rateLimited(emailResult.retryAfter);
  }

  await deliverReset(email);

  // Always 200, always the same shape.
  return NextResponse.json({
    ok: true,
    message: "If that address has a Fignal account, a reset link is on its way.",
  });
}

async function deliverReset(email: string): Promise<boolean> {
  try {
    const user = await adminAuth().getUserByEmail(email);
    const mailbox = user.email;
    if (!mailbox) return false;

    const link = await adminAuth().generatePasswordResetLink(email, {
      url: `${siteUrl()}/reset-password`,
    });

    const username = await readUsername(user.uid);
    return mailPasswordReset(username ?? mailbox, mailbox, link);
  } catch {
    // No such user, or the mail transport is down. Either way the caller must
    // not learn which - the response is fixed above.
    return false;
  }
}

async function readUsername(uid: string): Promise<string | null> {
  const { adminDb } = await import("@/lib/firebase/server");
  const snap = await adminDb().collection("users").doc(uid).get();
  return snap.get("username") ?? null;
}

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}