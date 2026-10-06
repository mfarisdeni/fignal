import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/server";
import { mailPaymentConfirmed, mailAdminAlert } from "@/lib/mail/templates";
import { MEMBERSHIP_MS, MEMBERSHIP_PRICE_IDR, klikQris } from "@/lib/payments/klikqris";

/**
 * POST /api/payments/webhook - KlikQris payment confirmation.
 *
 * This endpoint grants paid access, so it is the most security-sensitive route in
 * the app. Membership is granted only when KlikQRIS itself confirms the payment
 * over an authenticated server-to-server status call. The checks, in order:
 *
 * 1. The callback amount (`total_amount`) must be present, numeric, finite, and
 *    exactly equal to the total stored for this order. A missing or mismatched
 *    amount fails closed - validation is never skipped.
 *
 * 2. The callback signature is an additional layer, never the authority. A
 *    signature that contradicts the stored one rejects the callback, but a
 *    missing signature does not refuse it: reconciliation falls through to the
 *    provider status check, so there is no unrecoverable dead end.
 *
 * 3. The provider status endpoint (`GET /qris/status/{order_id}`, authenticated
 *    with the merchant credentials that never leave the server) must report this
 *    order paid for the stored total. Nothing the browser ever saw can satisfy
 *    this check, so a forged callback cannot grant membership.
 *
 * Definitive rejections answer 200 so the provider does not retry a callback that
 * will never succeed. The one exception is an inconclusive provider check (the
 * status query itself failed): that answers 502 so the provider retries, because
 * a 200 there would silently drop a payment the member actually made.
 */

export const runtime = "nodejs";

const PAID = new Set(["PAID", "SUCCESS", "SETTLED"]);
const DEAD = new Set(["EXPIRED", "CANCELLED", "FAILED"]);

type StoredOrder = {
  signature?: string | null;
  totalAmount?: number;
  amount?: number;
  uid?: string;
  username?: string | null;
  status?: string;
};

type ProviderVerdict =
  | { ok: true; paid: boolean; dead: boolean; amount: number | null; orderEcho: string | null }
  | { ok: false; reason: string };

export async function POST(request: Request) {
  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    console.warn("[webhook] rejected: body is not JSON");
    return ok();
  }

  const orderId = String(payload.order_id ?? "");
  const status = String(payload.status ?? "").toUpperCase();
  const signature = payload.signature == null ? null : String(payload.signature);

  if (!orderId || !status) {
    console.warn("[webhook] rejected: missing order_id or status");
    return ok();
  }

  const db = adminDb();
  const ref = db.collection("payments").doc(orderId);
  const snap = await ref.get();

  // An unknown order is not an error worth retrying, and answering 404 would
  // tell a prober which ids are real.
  if (!snap.exists) {
    console.warn(`[webhook] ${orderId} rejected: unknown order`);
    return ok();
  }

  const order = snap.data() as StoredOrder;

  // Idempotent. A retried webhook must not extend the membership a second time.
  // Checked before the provider round-trip so retries stay cheap; re-checked
  // inside the grant transaction so two racing callbacks stay safe too.
  if (order.status === "PAID" || order.status === "ACTIVE") {
    console.warn(`[webhook] ${orderId} ignored: duplicate callback for a paid order`);
    return ok();
  }

  // --- amount verification (fail closed) ------------------------------------
  // The stored total is the figure this order was created for, as echoed by the
  // provider - a string like "10016.00" in the documented shapes, hence parsed
  // numerically rather than read as a number. KlikQRIS adds a unique code on top
  // of the requested amount, so the stored total legitimately exceeds the price;
  // it must never be below it, and anything non-numeric fails closed.
  const storedTotal = Number(order.totalAmount ?? order.amount);
  if (!Number.isFinite(storedTotal)) {
    console.error(`[webhook] ${orderId} rejected: stored total is not numeric`);
    return ok();
  }
  if (storedTotal < MEMBERSHIP_PRICE_IDR) {
    console.error(
      `[webhook] ${orderId} rejected: stored total ${storedTotal} is below the membership price`,
    );
    return ok();
  }
  if (storedTotal !== MEMBERSHIP_PRICE_IDR) {
    console.warn(
      `[webhook] ${orderId}: stored total ${storedTotal} exceeds the price (provider unique code)`,
    );
  }

  const rawAmount = payload.total_amount;
  const callbackAmount =
    typeof rawAmount === "number" || typeof rawAmount === "string" ? Number(rawAmount) : NaN;
  if (rawAmount == null || rawAmount === "" || !Number.isFinite(callbackAmount)) {
    console.error(`[webhook] ${orderId} rejected: callback total_amount missing or not numeric`);
    return ok();
  }
  if (callbackAmount !== storedTotal) {
    console.error(
      `[webhook] ${orderId} rejected: callback amount ${callbackAmount} does not match stored total ${storedTotal}`,
    );
    return ok();
  }

  // --- signature: an additional layer, never the authority -------------------
  // The create endpoint no longer returns the stored signature, so a matching
  // signature is genuine evidence the callback came through the provider flow.
  // A mismatch rejects; a missing signature only means reconciliation rests
  // entirely on the provider status check below.
  const expected = order.signature ?? null;
  if (signature && expected && signature !== expected) {
    console.error(`[webhook] ${orderId} rejected: signature mismatch`);
    return ok();
  }
  if (!signature) {
    console.warn(`[webhook] ${orderId}: callback has no signature; reconciling via provider status`);
  } else if (!expected) {
    console.warn(`[webhook] ${orderId}: order has no stored signature; reconciling via provider status`);
  }

  if (DEAD.has(status)) {
    // A death claim never grants on its own. If the provider contradicts it and
    // reports payment, fall through to the grant path; otherwise expire or drop.
    const dead = await resolveDeadClaim(orderId, status, signature, expected, storedTotal);
    if (dead !== "paid") {
      if (dead === "expired") {
        await ref.update({ status: "EXPIRED", updatedAt: FieldValue.serverTimestamp() });
      }
      return ok();
    }
  } else if (!PAID.has(status)) {
    console.warn(`[webhook] ${orderId} ignored: non-terminal status ${status}`);
    return ok();
  }

  // --- server-to-server verification (the authority) -------------------------
  // Membership is granted only when KlikQRIS confirms, over an authenticated
  // call made with the merchant credentials, that this order is paid for the
  // stored total.
  const verdict = await providerStatus(orderId);
  if (!verdict.ok) {
    // Inconclusive, not invalid: answer 502 so the provider retries. A 200 here
    // would silently drop a payment the member actually made.
    console.error(
      `[webhook] ${orderId} unverified: provider status check failed (${verdict.reason}); asking for retry`,
    );
    return NextResponse.json(null, { status: 502 });
  }
  if (!verdict.paid) {
    console.error(`[webhook] ${orderId} rejected: provider reports the order is not paid`);
    return ok();
  }
  if (verdict.amount !== storedTotal) {
    console.error(
      `[webhook] ${orderId} rejected: provider amount ${String(verdict.amount)} does not match stored total ${storedTotal}`,
    );
    return ok();
  }
  if (verdict.orderEcho && verdict.orderEcho !== orderId) {
    console.error(`[webhook] ${orderId} rejected: provider order echo mismatch`);
    return ok();
  }

  const uid = order.uid;
  if (!uid) {
    console.error(`[webhook] ${orderId} rejected: order has no uid`);
    return ok();
  }

  const paidAt = new Date().toISOString();

  // Grant and mark paid in one transaction: a webhook that marks paid but fails
  // to grant leaves a paying member locked out with no record of why. The order
  // status is re-checked inside the transaction so two callbacks racing each
  // other cannot both extend the membership.
  const granted = await db.runTransaction(async (tx) => {
    const fresh = await tx.get(ref);
    if (fresh.get("status") === "PAID" || fresh.get("status") === "ACTIVE") {
      return false;
    }

    tx.set(
      ref,
      {
        status: "PAID",
        paidAt,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    const memberRef = db.collection("members").doc(uid);
    const memberSnap = await tx.get(memberRef);
    const existing = memberSnap.data() as { expiresAt?: number | null } | undefined;
    // Extend from the later of now and the current expiry, so renewing early
    // never discards time the member already paid for.
    const base =
      existing?.expiresAt && existing.expiresAt > Date.now() ? existing.expiresAt : Date.now();

    tx.set(
      memberRef,
      {
        uid,
        active: true,
        // Seven days from now, or from the current expiry when a member renews
        // early - so paying again never discards days they already bought.
        expiresAt: base + MEMBERSHIP_MS,
        plan: "platinum",
        planDays: MEMBERSHIP_MS / (24 * 60 * 60 * 1000),
        grantedBy: "klikqris-webhook",
        lastOrderId: orderId,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    return true;
  });

  if (!granted) {
    console.warn(`[webhook] ${orderId} ignored: duplicate callback lost the grant race`);
    return ok();
  }

  console.warn(`[webhook] ${orderId} granted: membership extended`);

  // Confirmations are a courtesy, not the source of truth - membership is
  // already committed, so a mail failure must not fail the request.
  void mailPaymentConfirmed(
    order.username ?? "member",
    await emailFor(uid),
    MEMBERSHIP_PRICE_IDR,
    orderId,
  );
  void mailAdminAlert("Payment received", [
    `Order: <code>${orderId}</code>`,
    `Username: <strong>${order.username ?? "unknown"}</strong>`,
    "Amount: Rp10.000 - Platinum access granted.",
  ]);

  return ok();
}

/**
 * A death claim (EXPIRED/CANCELLED/FAILED) never grants on its own. Returns
 * "paid" when the provider contradicts the claim and reports payment (the caller
 * falls through to the grant path), "expired" when the order should be marked
 * dead, and "ignore" otherwise. The caller performs the EXPIRED write.
 */
async function resolveDeadClaim(
  orderId: string,
  claimed: string,
  signature: string | null,
  expected: string | null,
  storedTotal: number,
): Promise<"paid" | "expired" | "ignore"> {
  const matches = !!signature && !!expected && signature === expected;
  const verdict = await providerStatus(orderId);

  if (!verdict.ok) {
    // Provider unreachable: only a matching signature justifies touching state.
    if (matches) {
      console.warn(
        `[webhook] ${orderId} marked EXPIRED on signature match (provider unreachable: ${verdict.reason})`,
      );
      return "expired";
    }
    console.error(`[webhook] ${orderId} ignored: dead-claim ${claimed} unverifiable (${verdict.reason})`);
    return "ignore";
  }

  if (
    verdict.paid &&
    verdict.amount === storedTotal &&
    (!verdict.orderEcho || verdict.orderEcho === orderId)
  ) {
    console.warn(`[webhook] ${orderId}: callback claims ${claimed} but provider reports paid; granting`);
    return "paid";
  }
  if (verdict.dead || matches) {
    console.warn(
      `[webhook] ${orderId} marked EXPIRED (provider dead=${verdict.dead}, signature match=${matches})`,
    );
    return "expired";
  }
  console.error(`[webhook] ${orderId} ignored: dead-claim ${claimed} contradicted by provider`);
  return "ignore";
}

/**
 * Server-to-server truth: ask KlikQRIS what it thinks of this order.
 *
 * Authenticated with the merchant credentials, which never leave the server, so
 * a caller who only knows browser-visible values cannot influence the answer.
 * Returns ok:false when the check itself could not be completed (network error,
 * non-2xx, unparseable body, missing credentials) - inconclusive, not negative.
 */
async function providerStatus(orderId: string): Promise<ProviderVerdict> {
  let cfg: ReturnType<typeof klikQris>;
  try {
    cfg = klikQris();
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : "missing KlikQRIS credentials" };
  }

  let response: Response;
  try {
    response = await fetch(`${cfg.base}/qris/status/${encodeURIComponent(orderId)}`, {
      method: "GET",
      headers: {
        "x-api-key": cfg.apiKey,
        id_merchant: cfg.merchantId,
      },
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : "status request failed" };
  }

  if (!response.ok) {
    return { ok: false, reason: `status endpoint answered ${response.status}` };
  }

  const body = (await response.json().catch(() => null)) as {
    status?: unknown;
    order_id?: unknown;
    total_amount?: unknown;
    data?: {
      status?: unknown;
      order_id?: unknown;
      total_amount?: unknown;
    } | null;
  } | null;

  if (!body || typeof body !== "object") {
    return { ok: false, reason: "status endpoint returned no JSON" };
  }

  const data = body.data && typeof body.data === "object" ? body.data : null;
  const rawStatus = data?.status ?? body.status;
  const providerState = typeof rawStatus === "string" ? rawStatus.toUpperCase() : "";
  const rawAmount = data?.total_amount ?? body.total_amount;
  const amount =
    typeof rawAmount === "number" || typeof rawAmount === "string" ? Number(rawAmount) : NaN;
  const echo = data?.order_id ?? body.order_id;

  return {
    ok: true,
    paid: PAID.has(providerState),
    dead: DEAD.has(providerState),
    amount: Number.isFinite(amount) ? amount : null,
    orderEcho: typeof echo === "string" ? echo : null,
  };
}

async function emailFor(uid: string): Promise<string> {
  const snap = await adminDb().collection("users").doc(uid).get();
  return (snap.get("email") as string | undefined) ?? "";
}

/**
 * The default answer: 200. Returning an error status for a definitively bad
 * callback makes the provider retry a request that will never succeed - a
 * forged signature in particular - and the console log is the useful artefact.
 * Only an inconclusive provider check answers 502, to ask for a retry.
 */
function ok() {
  return new NextResponse(null, { status: 200 });
}
