import { NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/server";
import { sessionFacts } from "@/lib/auth/session";
import { checkRateLimit, rateLimited, serviceUnavailable } from "@/lib/auth/rate-limit";
import { SIGNALS_COLLECTION } from "@/lib/signals/schema";
import { isDeletableStatus } from "@/lib/signals";
import { SIGNAL_STATUSES } from "@/types/signal";

/**
 * PATCH /api/signals/[id] - move a published signal along its lifecycle.
 *
 * Status is what the member dashboard counts TP-hit and SL-hit from, and it is
 * what feeds the win-rate summary, so it has to live where members can read it
 * - not in the admin's localStorage, where a status change would stop at the
 * publishing browser.
 *
 * DELETE is guarded, not absent: anything not yet resolved (duplicates,
 * phantoms, pending setups) may go, but TP/SL results stand as published -
 * the member's win rate references these documents, and a desk that can
 * delete a resolved signal can quietly erase a losing one.
 */

const body = z.object({
  status: z.enum(SIGNAL_STATUSES as [string, ...string[]]),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : undefined;

  const facts = await sessionFacts(token);
  if (!facts.isAdmin) {
    return NextResponse.json(
      { error: "Only the admin desk can change a signal." },
      { status: 403, headers: { "cache-control": "no-store" } },
    );
  }

  // Same "signals-write" bucket as POST: publishes and status moves share one
  // desk allowance.
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
    return NextResponse.json({ error: "Unknown status." }, { status: 400 });
  }

  const ref = adminDb().collection(SIGNALS_COLLECTION).doc(id);

  if (!(await ref.get()).exists) {
    return NextResponse.json({ error: "That signal no longer exists." }, { status: 404 });
  }

  await ref.update({
    status: parsed.data.status,
    statusChangedAt: new Date().toISOString(),
    statusChangedBy: facts.uid,
  });

  return NextResponse.json(
    { ok: true, id, status: parsed.data.status },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : undefined;

  const facts = await sessionFacts(token);
  if (!facts.isAdmin) {
    return NextResponse.json(
      { error: "Only the admin desk can delete a signal." },
      { status: 403, headers: { "cache-control": "no-store" } },
    );
  }

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

  const status = snap.get("status") as string | null;
  if (status && !isDeletableStatus(status)) {
    return NextResponse.json(
      { error: "Signals with a TP or SL result cannot be deleted." },
      { status: 409, headers: { "cache-control": "no-store" } },
    );
  }

  await ref.delete();
  return NextResponse.json(
    { ok: true, id },
    { headers: { "cache-control": "no-store" } },
  );
}