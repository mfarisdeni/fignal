import { NextResponse } from "next/server";
import type { Firestore } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/server";
import { sessionFacts } from "@/lib/auth/session";
import { MEMBERSHIP_PRICE_IDR, klikQris } from "@/lib/payments/klikqris";
import { newOrderId } from "@/lib/payments/order-id";

/**
 * POST /api/payments/create - start a QRIS payment.
 *
 * Deliberately takes no amount parameter. There is one product at Rp10.000 and
 * the price is a server constant, so a caller cannot ask for a cheaper order by
 * editing the request body.
 *
 * Requires a signed-in member. An admin does not need to pay, and letting them
 * would create a membership record for the desk account that outlives the desk.
 *
 * The browser receives a public order DTO only - QR display fields and nothing
 * that authenticates anything. The KlikQRIS transaction signature is stored
 * server-side with the order and is never returned, on either the create or the
 * reuse path, because anything the browser can read cannot serve as webhook
 * authentication.
 */

export async function POST(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : undefined;

  const facts = await sessionFacts(token);
  if (!facts.uid) {
    return NextResponse.json(
      { error: "Sign in before paying." },
      { status: 401, headers: { "cache-control": "no-store" } },
    );
  }

  // Already a member: nothing to buy.
  if (facts.isMember || facts.isAdmin) {
    return NextResponse.json(
      { error: "Your account already has access." },
      { status: 409, headers: { "cache-control": "no-store" } },
    );
  }

  const db = adminDb();

  // Reuse a live pending order instead of stacking QRIS codes on a member who
  // simply reopened the page. Clicks are cheap; merchant QRIS quotas are not.
  const openOrder = await findReusableOrder(db, facts.uid);
  if (openOrder) {
    return NextResponse.json(openOrder, { headers: { "cache-control": "no-store" } });
  }

  const cfg = klikQris();
  const orderId = newOrderId();
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(
    /\/+$/,
    "",
  );

  try {
    const response = await fetch(`${cfg.base}/qris/create`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": cfg.apiKey,
        id_merchant: cfg.merchantId,
      },
      body: JSON.stringify({
        order_id: orderId,
        amount: MEMBERSHIP_PRICE_IDR,
        id_merchant: cfg.merchantId,
        keterangan: "Fignal Platinum membership",
        callback_url: `${siteUrl}/api/payments/webhook`,
      }),
      signal: AbortSignal.timeout(20_000),
    });

    const payload = (await response.json().catch(() => null)) as
      | {
          status?: string;
          message?: string;
          data?: {
            signature?: string;
            total_amount?: number;
            qris_url?: string;
            qris_image?: string;
            expired_at?: string;
            expired_menit?: number;
          };
        }
      | null;

    if (!response.ok || !payload?.status || !payload.data) {
      console.error("[payments] klikqris create rejected", response.status, payload);
      return NextResponse.json(
        { error: payload?.message ?? "Payment could not be started. Try again." },
        { status: 502, headers: { "cache-control": "no-store" } },
      );
    }

    const data = payload.data;
    const order = {
      orderId,
      signature: data.signature ?? null,
      totalAmount: data.total_amount ?? MEMBERSHIP_PRICE_IDR,
      qrisUrl: data.qris_url ?? null,
      qrisImage: data.qris_image ?? null,
      expiredAt: data.expired_at ?? null,
      expiredMinutes: data.expired_menit ?? null,
    };

    await db.collection("payments").doc(orderId).set({
      uid: facts.uid,
      username: facts.username,
      amount: MEMBERSHIP_PRICE_IDR,
      provider: "klikqris",
      mode: cfg.mode,
      ...order,
      status: "PENDING",
      createdAt: new Date().toISOString(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json(toPublicOrder(order), {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    console.error("[payments] create failed", error);
    return NextResponse.json(
      { error: "Payment service unavailable." },
      { status: 502, headers: { "cache-control": "no-store" } },
    );
  }
}

/**
 * The public order shape: exactly what PaymentPanel renders. Constructed by
 * picking fields, never by spreading the stored document minus one key - a
 * denylist spread re-leaks the moment a new sensitive field is stored.
 */
type PublicOrder = {
  orderId: string;
  qrisUrl: string | null;
  qrisImage: string | null;
  expiredAt: string | null;
  expiredMinutes: number | null;
};

function toPublicOrder(source: {
  orderId?: unknown;
  qrisUrl?: unknown;
  qrisImage?: unknown;
  expiredAt?: unknown;
  expiredMinutes?: unknown;
}): PublicOrder {
  return {
    orderId: typeof source.orderId === "string" ? source.orderId : "",
    qrisUrl: typeof source.qrisUrl === "string" ? source.qrisUrl : null,
    qrisImage: typeof source.qrisImage === "string" ? source.qrisImage : null,
    expiredAt: typeof source.expiredAt === "string" ? source.expiredAt : null,
    expiredMinutes:
      typeof source.expiredMinutes === "number" && Number.isFinite(source.expiredMinutes)
        ? source.expiredMinutes
        : null,
  };
}

/** An unexpired PENDING order for this member, as a public DTO, if one exists. */
async function findReusableOrder(db: Firestore, uid: string): Promise<PublicOrder | null> {
  const snapshot = await db
    .collection("payments")
    .where("uid", "==", uid)
    .where("status", "==", "PENDING")
    .orderBy("createdAt", "desc")
    .limit(1)
    .get();

  const doc = snapshot.docs[0];
  if (!doc) return null;

  const data = doc.data() as { expiredAt?: string | null };
  if (data.expiredAt && new Date(data.expiredAt).getTime() < Date.now()) {
    return null;
  }

  return toPublicOrder({ ...doc.data(), orderId: doc.id });
}