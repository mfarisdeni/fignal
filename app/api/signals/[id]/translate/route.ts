import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/server";
import { sessionFacts } from "@/lib/auth/session";
import { checkRateLimit, rateLimited, serviceUnavailable } from "@/lib/auth/rate-limit";
import { translateToIndonesian } from "@/lib/translate/groq";
import { SIGNALS_COLLECTION } from "@/lib/signals/schema";

/**
 * POST /api/signals/[id]/translate - (re)translate a signal's reason.
 *
 * Publish-time translation can miss (no Groq key at the time, gateway hiccup),
 * leaving reasonId null and Indonesian members reading English. The desk
 * retries from the admin card; a failed retry never blanks an existing
 * translation, it just reports failure and keeps the old text.
 */

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : undefined;

  const facts = await sessionFacts(token);
  if (!facts.isAdmin) {
    return NextResponse.json(
      { error: "Only the admin desk can translate a signal." },
      { status: 403, headers: { "cache-control": "no-store" } },
    );
  }

  // Same "signals-write" desk bucket as publish: this spends Groq like a
  // publish does, so it shares the allowance.
  const writeResult = await checkRateLimit(request, {
    name: "signals-write",
    identifier: facts.uid,
    identifierClass: "uid",
    limit: 60,
    window: "1 h",
    failClosed: false,
  });
  if (!writeResult.ok) {
    return writeResult.unavailable ? serviceUnavailable() : rateLimited(writeResult.retryAfter);
  }

  const ref = adminDb().collection(SIGNALS_COLLECTION).doc(id);
  const snap = await ref.get();
  if (!snap.exists) {
    return NextResponse.json({ error: "That signal no longer exists." }, { status: 404 });
  }

  const reason = snap.get("reason") as string | null;
  if (!reason) {
    return NextResponse.json({ error: "Nothing to translate." }, { status: 400 });
  }

  const translated = await translateToIndonesian(reason);
  if (!translated.ok) {
    // Surfaced, not swallowed: this endpoint is admin-only, the caller owns
    // the Groq key, and "try again" explains nothing. The reason never carries
    // the key - only a status and the provider's own message, truncated.
    console.error(`[signals] translate ${id} failed: ${translated.reason}`);
    return NextResponse.json(
      { error: translated.reason },
      { status: 502, headers: { "cache-control": "no-store" } },
    );
  }

  await ref.update({ reasonId: translated.text, translationPending: false });
  return NextResponse.json(
    { ok: true, id },
    { headers: { "cache-control": "no-store" } },
  );
}
