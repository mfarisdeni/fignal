import { NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/server";
import { sessionFacts } from "@/lib/auth/session";
import { checkRateLimit, rateLimited, serviceUnavailable } from "@/lib/auth/rate-limit";
import { translateToIndonesian } from "@/lib/translate/groq";
import { SIGNALS_COLLECTION } from "@/lib/signals/schema";

/**
 * POST /api/signals - the admin desk publishes a signal.
 *
 * This is the write half of the fix for members seeing an empty dashboard on
 * their phone. A published record used to live in the admin's localStorage, so
 * any other device had nothing to read.
 *
 * Publishing goes through the server rather than straight from the browser so
 * that the admin claim is verified before the write, translation happens where
 * the Groq key cannot leak, and the analyst's original English is stored beside
 * the Indonesian rather than replaced by it.
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

  // Translation failure must not block the publish. The signal the desk just
  // wrote is real and members are waiting on it; falling back to the English
  // reason until the next publish is correct, failing closed is not.
  const translated = await translateToIndonesian(input.reason);

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
    reasonId: translated.ok ? translated.text : null,
    translationPending: !translated.ok,
    note: input.note ?? null,
    generatedAt: new Date().toISOString(),
    publishedAt: FieldValue.serverTimestamp(),
    publishedBy: facts.uid,
  });

  return NextResponse.json(
    { ok: true, id: doc.id, translated: translated.ok },
    { headers: { "cache-control": "no-store" } },
  );
}