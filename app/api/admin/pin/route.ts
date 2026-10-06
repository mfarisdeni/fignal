import { NextResponse } from "next/server";
import {
  PIN_COOKIE,
  PIN_COOKIE_MAX_AGE,
  createPinToken,
  pinMatches,
  verifyPinToken,
} from "@/lib/auth/pin-session";
import { checkRateLimit, clientIp, rateLimited, serviceUnavailable } from "@/lib/auth/rate-limit";

/**
 * POST /api/admin/pin - exchange the desk PIN for a signed session cookie.
 * GET  /api/admin/pin - is the PIN session still valid?
 * DELETE /api/admin/pin - drop it.
 *
 * POST is rate limited per IP in Redis, shared across serverless instances -
 * an in-memory map would give every instance its own budget. The limit fails
 * closed: if the store is unreachable, guesses are refused rather than let
 * through. GET and DELETE are not limited; checking or clearing a cookie
 * provides no brute-force oracle.
 */

export async function GET(request: Request) {
  const cookie = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim().split("="))
    .find(([name]) => name === PIN_COOKIE);

  const valid = verifyPinToken(cookie?.[1] ? decodeURIComponent(cookie[1]) : undefined);
  return NextResponse.json({ unlocked: valid }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  const ipResult = await checkRateLimit(request, {
    name: "pin-ip",
    identifier: clientIp(request),
    identifierClass: "ip",
    limit: 8,
    window: "15 m",
    failClosed: true,
  });
  if (!ipResult.ok) {
    return ipResult.unavailable ? serviceUnavailable() : rateLimited(ipResult.retryAfter);
  }

  const body = (await request.json().catch(() => null)) as { pin?: string } | null;
  if (!body?.pin || !pinMatches(body.pin)) {
    return NextResponse.json(
      { error: "Wrong PIN." },
      { status: 401, headers: { "cache-control": "no-store" } },
    );
  }

  const response = NextResponse.json(
    { ok: true },
    { headers: { "cache-control": "no-store" } },
  );
  response.cookies.set(PIN_COOKIE, createPinToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: PIN_COOKIE_MAX_AGE,
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json(
    { ok: true },
    { headers: { "cache-control": "no-store" } },
  );
  response.cookies.set(PIN_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}