import { NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase/server";
import { mailAccountActive, mailAdminAlert } from "@/lib/mail/templates";
import { normalizeUsername, validatePassword, validateUsername } from "@/lib/auth/username";
import { checkRateLimit, clientIp, rateLimited, serviceUnavailable } from "@/lib/auth/rate-limit";

/**
 * POST /api/auth/register - create the Firebase account.
 *
 * Done server side rather than with the client SDK for three reasons: the
 * handle has to be reserved atomically, the profile document has to exist
 * before anyone can query it, and the activation email should only go out once
 * the write is real.
 *
 * No membership is created here. The member record is written exclusively by
 * the payment webhook, so registering and paying stay two separate facts - which
 * is also why Firestore rules mark /members unwritable from any client.
 */

const body = z.object({
  username: z.string().min(1).max(40),
  email: z.string().email().max(254),
  password: z.string().min(8).max(200),
});

export async function POST(request: Request) {
  const ipResult = await checkRateLimit(request, {
    name: "register-ip",
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
    return fail("Check the form and try again.", 400);
  }

  const username = parsed.data.username.trim();
  const email = parsed.data.email.trim().toLowerCase();

  const problem =
    validateUsername(username) ?? validatePassword(parsed.data.password);
  if (problem) return fail(problem, 400);

  const db = adminDb();
  const handle = normalizeUsername(username);
  const handleRef = db.collection("usernames").doc(handle);

  // Reserve the handle first. create() fails if the document already exists,
  // which is what makes the check-then-write safe against two simultaneous
  // signups for the same name - a plain get() then set() would not be.
  try {
    await handleRef.create({ uid: null, createdAt: FieldValue.serverTimestamp() });
  } catch (error) {
    if (isAlreadyExists(error)) {
      return fail("That username is taken.", 409);
    }
    throw error;
  }

  // From here on any failure must undo the reservation, or the handle is burned
  // by an account that does not exist.
  try {
    const user = await adminAuth().createUser({
      email,
      password: parsed.data.password,
      displayName: username,
      emailVerified: false,
    });

    await Promise.all([
      handleRef.set({ uid: user.uid, createdAt: FieldValue.serverTimestamp() }, { merge: true }),
      db.collection("users").doc(user.uid).set({
        username,
        usernameLower: handle,
        email,
        displayName: username,
        locale: "en",
        createdAt: FieldValue.serverTimestamp(),
      }),
    ]);

    // Not awaited into the response path: a slow SMTP handshake should not make
    // registration look broken when the account is already created.
    void mailAccountActive(username, email);
    void mailAdminAlert("New account registered", [
      `Username: <strong>${escapeHtml(username)}</strong>`,
      `Email: ${escapeHtml(email)}`,
      "Payment not yet made - awaiting QRIS.",
    ]);

    return NextResponse.json({ ok: true, uid: user.uid }, { status: 201 });
  } catch (error) {
    await handleRef.delete().catch(() => {});
    if (isEmailInUse(error)) {
      return fail("That email address is already registered.", 409);
    }
    throw error;
  }
}

function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

function isAlreadyExists(error: unknown): boolean {
  const code = (error as { code?: number })?.code;
  return code === 6 || code === 409;
}

function isEmailInUse(error: unknown): boolean {
  const code = (error as { code?: string })?.code;
  return code === "auth/email-already-exists";
}

/** Desk-owner alerts render raw HTML; never trust caller-supplied text blindly. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}