import "server-only";

import { randomBytes, randomUUID } from "node:crypto";

/**
 * Payment order identifiers.
 *
 * randomUUID rather than the `FRSC-${amount}-${Date.now()}-${random6}` shape used
 * by Farisium. That format leaks the amount and the creation time and narrows the
 * random part to six base-36 characters, which makes order ids guessable - and a
 * guessable order id is exactly what an attacker needs to forge a paid webhook.
 * The webhook now requires a valid signature, so this is defence in depth rather
 * than the only barrier, but an id that is trivially enumerable should not be
 * relied upon at all.
 */
export function newOrderId(): string {
  return `FGPL-${randomUUID().replace(/-/g, "").slice(0, 20).toUpperCase()}`;
}

/**
 * Idempotency key sent to KlikQris so a double-clicked button cannot create two
 * orders for one payment.
 */
export function idempotencyKey(): string {
  return randomBytes(16).toString("hex");
}