import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Admin PIN session.
 *
 * The PIN is 0000 and is not a secret in any meaningful sense - it is a
 * convenience for the owner on a phone. What matters is that it is not the only
 * thing protecting /admin.
 *
 * The original implementation compared the typed value against ADMIN_PASSCODE, a
 * constant compiled into the JavaScript bundle, so anyone could read it with
 * devtools. Here the PIN lives only in an environment variable, is compared on
 * the server, and a successful match mints a signed, httpOnly cookie. Reading the
 * PIN is no longer possible from the browser, and a guess cannot be brute-forced
 * from it either because the check happens server-side with a constant-time
 * comparison.
 *
 * This is deliberately weaker than the Firebase admin claim, which is the real
 * control. The PIN is a second door, not the wall - treat a PIN login as "the
 * owner let someone in on purpose".
 */

const COOKIE = "fignal-admin-pin";
const MAX_AGE_SECONDS = 12 * 60 * 60;

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value) {
    throw new Error("Missing SESSION_SECRET.");
  }
  return value;
}

/** Constant-time compare, so a wrong PIN cannot be discovered by timing. */
export function pinMatches(candidate: string): boolean {
  const expected = process.env.ADMIN_PIN;
  if (!expected) return false;

  const a = Buffer.from(trim(candidate));
  const b = Buffer.from(trim(expected));
  // timingSafeEqual throws on a length mismatch, so equalise first.
  if (a.length !== b.length) {
    timingSafeEqual(b, b);
    return false;
  }
  return timingSafeEqual(a, b);
}

function trim(value: string): string {
  return value.trim();
}

/** value = "<expiresAtMs>.<hmac>" */
export function createPinToken(now = Date.now()): string {
  const expiresAt = now + MAX_AGE_SECONDS * 1000;
  return `${expiresAt}.${sign(String(expiresAt))}`;
}

export function verifyPinToken(
  token: string | undefined,
  now = Date.now(),
): boolean {
  if (!token) return false;

  const separator = token.lastIndexOf(".");
  if (separator < 1) return false;

  const expiresAt = Number(token.slice(0, separator));
  if (!Number.isFinite(expiresAt) || expiresAt < now) return false;

  const provided = Buffer.from(token.slice(separator + 1));
  const expected = Buffer.from(sign(token.slice(0, separator)));
  if (provided.length !== expected.length) return false;

  return timingSafeEqual(provided, expected);
}

export const PIN_COOKIE = COOKIE;
export const PIN_COOKIE_MAX_AGE = MAX_AGE_SECONDS;

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}