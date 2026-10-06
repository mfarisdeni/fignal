import { NextResponse } from "next/server";
import { z } from "zod";
import { adminAuth, adminDb } from "@/lib/firebase/server";
import { normalizeUsername } from "@/lib/auth/username";
import {
  checkRateLimit,
  clientIp,
  normalizeHandle,
  rateLimited,
  serviceUnavailable,
} from "@/lib/auth/rate-limit";

/**
 * POST /api/auth/login - sign in with username + password.
 *
 * Members know their handle, not necessarily the email they typed, so login is
 * by username. The email is resolved here, server side, and never returned - if
 * the client needed it, "recover my account by email" would become a way to
 * enumerate which addresses have accounts.
 *
 * The flow:
 *   1. handle -> uid (from /usernames) -> email (from /users)
 *   2. verify the password against Firebase Auth's REST endpoint, because the
 *      Admin SDK can mint tokens but cannot check passwords
 *   3. mint a custom token for that uid, which the client exchanges with
 *      signInWithCustomToken() for a normal session
 *
 * Step 3 is what keeps the result an ordinary Firebase session: the member ends
 * up with a real refresh token, and the ID token carries the admin custom claim
 * for the desk account without anything extra being sent to the browser.
 */

const body = z.object({
  username: z.string().min(1).max(40),
  password: z.string().min(1).max(200),
});

export async function POST(request: Request) {
  const ipResult = await checkRateLimit(request, {
    name: "login-ip",
    identifier: clientIp(request),
    identifierClass: "ip",
    limit: 20,
    window: "15 m",
    failClosed: true,
  });
  if (!ipResult.ok) {
    return ipResult.unavailable ? serviceUnavailable() : rateLimited(ipResult.retryAfter);
  }

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return reject();

  const handle = normalizeUsername(parsed.data.username);

  // Peek without consuming: the account bucket counts failures only, so a peek
  // here gates the attempt and `fail` below records it.
  const accountPeek = await checkRateLimit(request, {
    name: "login-account",
    identifier: normalizeHandle(handle),
    identifierClass: "account",
    limit: 10,
    window: "15 m",
    mode: "fixed",
    failClosed: true,
    consume: false,
  });
  if (!accountPeek.ok) {
    return accountPeek.unavailable ? serviceUnavailable() : rateLimited(accountPeek.retryAfter);
  }

  // Every failure below consumes one account token. The outcome is ignored:
  // the caller is already being rejected, and a store outage must not change a
  // wrong-password answer into anything else.
  const fail = async () => {
    await checkRateLimit(request, {
      name: "login-account",
      identifier: normalizeHandle(handle),
      identifierClass: "account",
      limit: 10,
      window: "15 m",
      mode: "fixed",
      failClosed: true,
    });
    return reject();
  };

  const db = adminDb();

  const reserved = await db.collection("usernames").doc(handle).get();
  if (!reserved.exists) return fail();

  const uid = reserved.get("uid") as string | null;
  if (!uid) return fail();

  const profile = await db.collection("users").doc(uid).get();
  const email = profile.get("email") as string | null;
  if (!email) return fail();

  const verified = await verifyPassword(email, parsed.data.password);
  if (!verified) return fail();

  const customToken = await adminAuth().createCustomToken(uid, {
    // Surfaced in the ID token for display; the `admin` claim is what authorises.
    username: profile.get("username") ?? handle,
  });

  return NextResponse.json(
    { ok: true, customToken },
    { headers: { "cache-control": "no-store" } },
  );
}

/**
 * Ask Firebase Auth to check the password.
 *
 * Uses the web API key, which is public and identifies the project only - it
 * grants nothing on its own. Returns whether the credential is valid, never the
 * resulting tokens.
 */
async function verifyPassword(email: string, password: string): Promise<boolean> {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) {
    console.error("[auth] NEXT_PUBLIC_FIREBASE_API_KEY is missing");
    return false;
  }

  try {
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password, returnSecureToken: true }),
        signal: AbortSignal.timeout(15_000),
      },
    );
    return response.ok;
  } catch (error) {
    console.error("[auth] password check failed", error);
    return false;
  }
}

/**
 * One response for "no such handle", "wrong password" and "server problem".
 * Distinguishing them tells an attacker which usernames are real.
 */
function reject() {
  return NextResponse.json(
    { error: "Wrong username or password." },
    { status: 401, headers: { "cache-control": "no-store" } },
  );
}