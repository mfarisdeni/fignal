import { NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/server";
import { sessionFacts } from "@/lib/auth/session";
import { checkRateLimit, rateLimited, serviceUnavailable } from "@/lib/auth/rate-limit";
import { SIGNALS_COLLECTION } from "@/lib/signals/schema";

/**
 * POST /api/signals - the admin desk publishes a signal.
 *
 * This is the write half of the fix for members seeing an empty dashboard on
 * their phone. A published record used to live in the admin's localStorage, so
 * any other device had nothing to read.
 *
 * Publishing goes through the server rather than straight from the browser so
 * that the admin claim is verified before the write.
 *
 * Translation is deliberately NOT automatic here: the desk translates by hand
 * from the admin card (POST /api/signals/[id]/translate), so every publish
 * lands with reasonId null and translationPending true until then.
 */

const body = z.object({
  pair: z.string().min(1).max(16),
  direction: z.enum(["BUY", "SELL", "NO_TRADE"]),
  confidence: z.enum(["A+", "A", "B+", "B"]).optional(),
  entryMin: z.number().optional(),
  entryMax: z.number().optional(),
  sl: z.number().optional(),
  tp1: z.number().optional(),
  tp2: z.number().optional(),
  status: z.string().min(1).max(24),
  reason: z.string().min(1).max(4000),
  note: z.string().max(1000).optional(),
  call: z.string().max(24).optional(),
  sessionLabel: z.string().max(32).optional(),
});

export async function POST(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : undefined;

  const facts = await sessionFacts(token);
  if (!facts.isAdmin) {
    return NextResponse.json(
      { error: "Only the admin desk can publish signals." },
      { status: 403, headers: { "cache-control": "no-store" } },
    );
  }

  // Shared with PATCH: one desk bucket for all signal writes, guarding the
  // Groq translation spend and runaway clients rather than attackers.
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

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "That signal payload is not valid." },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }

  const input = parsed.data;

  const doc = await adminDb().collection(SIGNALS_COLLECTION).add({
    pair: input.pair,
    direction: input.direction,
    confidence: input.confidence ?? null,
    entryMin: input.entryMin ?? null,
    entryMax: input.entryMax ?? null,
    sl: input.sl ?? null,
    tp1: input.tp1 ?? null,
    tp2: input.tp2 ?? null,
    status: input.status,
    call: input.call ?? null,
    sessionLabel: input.sessionLabel ?? null,
    reason: input.reason,
    reasonId: null,
    translationPending: true,
    note: input.note ?? null,
    generatedAt: new Date().toISOString(),
    publishedAt: FieldValue.serverTimestamp(),
    publishedBy: facts.uid,
  });

  return NextResponse.json(
    { ok: true, id: doc.id, translated: false },
    { headers: { "cache-control": "no-store" } },
  );
}

/**
 * GET /api/signals - the desk's own view of what members can see.
 *
 * The admin page works from localStorage records, so a document deleted
 * locally (or published from another browser) is invisible there while
 * staying live for members. This listing lets /admin surface those orphans
 * with a working delete button. Admin-only, newest first.
 */
export async function GET(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : undefined;

  const facts = await sessionFacts(token);
  if (!facts.isAdmin) {
    return NextResponse.json(
      { error: "Only the admin desk can list signals." },
      { status: 403, headers: { "cache-control": "no-store" } },
    );
  }

  const readResult = await checkRateLimit(request, {
    name: "signals-read",
    identifier: facts.uid,
    identifierClass: "uid",
    limit: 600,
    window: "1 h",
    failClosed: false,
  });
  if (!readResult.ok) {
    return readResult.unavailable ? serviceUnavailable() : rateLimited(readResult.retryAfter);
  }

  const snapshot = await adminDb()
    .collection(SIGNALS_COLLECTION)
    .orderBy("generatedAt", "desc")
    .limit(200)
    .get();

  return NextResponse.json(
    {
      signals: snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
    },
    { headers: { "cache-control": "no-store" } },
  );
}