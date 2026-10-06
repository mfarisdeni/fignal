import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase/server";
import { sessionFacts } from "@/lib/auth/session";
import { handleCandidate } from "@/lib/auth/username";
import { mailAccountActive, mailAdminAlert } from "@/lib/mail/templates";
import { checkRateLimit, rateLimited, serviceUnavailable } from "@/lib/auth/rate-limit";

/**
 * POST /api/auth/provision - ensure the server-owned profile for a signed-in user.
 *
 * Sign-in itself is native Firebase (Google or email/password, done in the
 * browser), so this endpoint never sees a password. What it does is the part
 * the client must not decide for itself: create the users/{uid} profile and
 * atomically reserve a unique handle in usernames/{handle}.
 *
 * Idempotent: safe to call on every sign-in. An established profile returns
 * unchanged, and a retried reservation either wins the same handle or a free
 * alternative - never a duplicate, never a burn.
 *
 * No membership is created here. The member record is written exclusively by
 * the payment webhook, so signing in and paying stay two separate facts.
 */

export async function POST(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : undefined;

  const facts = await sessionFacts(token);
  if (!facts.uid) {
    return NextResponse.json(
      { error: "Sign in first." },
      { status: 401, headers: { "cache-control": "no-store" } },
    );
  }

  // Called once per sign-in plus the occasional retry. Generous, and fail-open:
  // a Redis outage must not lock members out, and the writes below are atomic
  // or merged, so a retried call cannot corrupt anything.
  const provisionResult = await checkRateLimit(request, {
    name: "provision",
    identifier: facts.uid,
    identifierClass: "uid",
    limit: 30,
    window: "1 h",
    failClosed: false,
  });
  if (!provisionResult.ok) {
    return provisionResult.unavailable
      ? serviceUnavailable()
      : rateLimited(provisionResult.retryAfter);
  }

  const db = adminDb();
  const profileRef = db.collection("users").doc(facts.uid);
  const profile = await profileRef.get();
  const existing = (profile.get("username") as string | null) ?? null;
  if (profile.exists && existing) {
    return NextResponse.json(
      { ok: true, username: existing, created: false },
      { headers: { "cache-control": "no-store" } },
    );
  }

  // The handle is derived, never asked for: sign-in must land on payment, not
  // on a second form. Display name first ("M Farisdeni" -> mfarisdeni), then the
  // email local part, then a generic fallback.
  const account = await adminAuth().getUser(facts.uid);
  const sources = [
    account.displayName ?? "",
    (account.email ?? "").split("@")[0] ?? "",
    "member",
  ];
  const username = await reserveHandle(db, facts.uid, sources);
  if (!username) {
    console.error(`[provision] ${facts.uid}: no free handle after bounded tries`);
    return NextResponse.json(
      { error: "Could not reserve a username. Try again." },
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }

  const email = account.email ?? facts.email;
  if (!profile.exists) {
    await profileRef.set({
      username,
      usernameLower: username,
      email,
      displayName: account.displayName ?? username,
      locale: "en",
      createdAt: FieldValue.serverTimestamp(),
    });

    // Off the response path: a slow SMTP handshake must not make sign-in look
    // broken when the profile is already real.
    void mailAccountActive(username, email ?? "");
    void mailAdminAlert("New account registered", [
      `Username: <strong>${escapeHtml(username)}</strong>`,
      `Email: ${escapeHtml(email ?? "")}`,
      "Payment not yet made - awaiting QRIS.",
    ]);

    return NextResponse.json(
      { ok: true, username, created: true },
      { headers: { "cache-control": "no-store" } },
    );
  }

  await profileRef.set({ username, usernameLower: username }, { merge: true });
  return NextResponse.json(
    { ok: true, username, created: false },
    { headers: { "cache-control": "no-store" } },
  );
}

/**
 * Reserve the first free handle from the candidate sources. Numeric suffixes
 * disambiguate ("farisium", "farisium2", ...), then one random fallback. Every
 * attempt is an atomic create(), so two sign-ins racing for the same name
 * cannot both win it - the loser moves to the next candidate.
 */
async function reserveHandle(
  db: ReturnType<typeof adminDb>,
  uid: string,
  sources: string[],
): Promise<string | null> {
  const claim = async (candidate: string): Promise<boolean> => {
    try {
      await db
        .collection("usernames")
        .doc(candidate)
        .create({ uid, createdAt: FieldValue.serverTimestamp() });
      return true;
    } catch (error) {
      if (isAlreadyExists(error)) return false;
      throw error;
    }
  };

  for (const source of sources) {
    const base = handleCandidate(source);
    if (!base) continue;
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const candidate =
        attempt === 0 ? base : handleCandidate(`${base}${attempt + 1}`);
      if (!candidate) continue;
      if (await claim(candidate)) return candidate;
    }
  }

  const random = handleCandidate(
    `member-${Math.random().toString(36).slice(2, 8)}`,
  );
  if (random && (await claim(random))) return random;
  return null;
}

function isAlreadyExists(error: unknown): boolean {
  const code = (error as { code?: number })?.code;
  return code === 6 || code === 409;
}

/** Desk-owner alerts render raw HTML; never trust caller-supplied text blindly. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
