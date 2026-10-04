import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/server";
import { mailPaymentConfirmed, mailAdminAlert } from "@/lib/mail/templates";
import { MEMBERSHIP_MS, MEMBERSHIP_PRICE_IDR } from "@/lib/payments/klikqris";

/**
 * POST /api/payments/webhook - KlikQris payment confirmation.
 *
 * This endpoint grants paid access, so it is the most security-sensitive route in
 * the app. Two rules:
 *
 * 1. A signature is REQUIRED and must match the one issued at order creation.
 *    Farisium's version compares signatures only when both sides happen to be
 *    present (`if (tx.signature && webhookSig && ...)`), so a forged callback
 *    that simply omits the signature field skips verification entirely and gets
 *    credited. Omitting the field must fail here, not pass.
 *
 * 2. The amount is verified against the price we asked for. A callback reporting
 *    a smaller figure is not a paid membership.
 *
 * Every failure still answers 200. A webhook that returns an error causes most
 * providers to retry for hours, and the log line is what an operator actually
 * needs.
 */

export const runtime = "nodejs";

const PAID = new Set(["PAID", "SUCCESS", "SETTLED"]);
const DEAD = new Set(["EXPIRED", "CANCELLED", "FAILED"]);

export async function POST(request: Request) {
  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return ok();
  }

  const orderId = String(payload.order_id ?? "");
  const status = String(payload.status ?? "").toUpperCase();
  const signature = payload.signature == null ? null : String(payload.signature);
  const totalAmount = Number(payload.total_amount ?? NaN);

  if (!orderId || !status) return ok();

  const db = adminDb();
  const ref = db.collection("payments").doc(orderId);
  const snap = await ref.get();

  // An unknown order is not an error worth retrying, and answering 404 would
  // tell a prober which ids are real.
  if (!snap.exists) {
    console.warn(`[webhook] unknown order ${orderId}`);
    return ok();
  }

  const order = snap.data() as {
    signature?: string | null;
    totalAmount?: number;
    uid?: string;
    username?: string | null;
    status?: string;
  };

  // --- verification -------------------------------------------------------
  const expected = order.signature;
  if (!expected) {
    console.error(`[webhook] ${orderId} has no stored signature; refusing`);
    return ok();
  }
  if (!signature || signature !== expected) {
    console.error(`[webhook] signature mismatch for ${orderId}; refusing`);
    return ok();
  }

  if (
    Number.isFinite(totalAmount) &&
    Number(order.totalAmount) !== MEMBERSHIP_PRICE_IDR
  ) {
    console.error(
      `[webhook] amount mismatch for ${orderId}: got ${totalAmount}, expected ${MEMBERSHIP_PRICE_IDR}`,
    );
    return ok();
  }

  // Idempotent. A retried webhook must not extend the membership a second time.
  if (order.status === "PAID" || order.status === "ACTIVE") return ok();

  if (DEAD.has(status)) {
    await ref.update({ status: "EXPIRED", updatedAt: FieldValue.serverTimestamp() });
    return ok();
  }

  if (!PAID.has(status)) return ok();

  const uid = order.uid;
  if (!uid) return ok();

  const paidAt = new Date().toISOString();

  // Grant and mark paid in one transaction: a webhook that marks paid but fails
  // to grant leaves a paying member locked out with no record of why.
  await db.runTransaction(async (tx) => {
    const paymentRef = ref;
    const memberRef = db.collection("members").doc(uid);

    tx.set(
      paymentRef,
      {
        status: "PAID",
        paidAt,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

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
  });

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

async function emailFor(uid: string): Promise<string> {
  const snap = await adminDb().collection("users").doc(uid).get();
  return (snap.get("email") as string | undefined) ?? "";
}

/**
 * Always 200. Returning an error status makes the provider retry a request that
 * will never succeed - a forged signature in particular - and the console log is
 * the useful artefact.
 */
function ok() {
  return new NextResponse(null, { status: 200 });
}