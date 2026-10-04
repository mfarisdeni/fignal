import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/server";
import { sessionFacts } from "@/lib/auth/session";
import { MEMBERSHIP_PRICE_IDR } from "@/lib/payments/klikqris";

/**
 * GET /api/payments/status?orderId=... - poll a payment.
 *
 * The webhook is the authority on whether money arrived; this endpoint only
 * reports what Firestore already holds, so polling can never be the thing that
 * grants access. It exists so the member's screen updates within a second or two
 * of the webhook landing.
 */

export async function GET(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : undefined;

  const facts = await sessionFacts(token);
  if (!facts.uid) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const orderId = new URL(request.url).searchParams.get("orderId");
  if (!orderId) {
    return NextResponse.json({ error: "orderId is required." }, { status: 400 });
  }

  const snap = await adminDb().collection("payments").doc(orderId).get();
  if (!snap.exists) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  const order = snap.data() as { uid?: string };
  // A member may only read their own order. Answering 404 rather than 403 for
  // someone else's keeps order ids unconfirmable.
  if (order.uid !== facts.uid) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  // Once the webhook has granted access, the session facts are the answer the
  // client actually needs.
  if (order.uid === facts.uid && (snap.get("status") === "PAID" || facts.isMember)) {
    return NextResponse.json(
      { status: "PAID", paid: true, amount: MEMBERSHIP_PRICE_IDR, access: true },
      { headers: { "cache-control": "no-store" } },
    );
  }

  return NextResponse.json(
    {
      status: snap.get("status") ?? "PENDING",
      paid: false,
      amount: snap.get("totalAmount") ?? MEMBERSHIP_PRICE_IDR,
      access: facts.isMember,
      qrisUrl: snap.get("qrisUrl") ?? null,
      qrisImage: snap.get("qrisImage") ?? null,
      expiredAt: snap.get("expiredAt") ?? null,
    },
    { headers: { "cache-control": "no-store" } },
  );
}