import { NextResponse } from "next/server";
import {
  PIN_COOKIE,
  PIN_COOKIE_MAX_AGE,
  createPinToken,
  pinMatches,
  verifyPinToken,
} from "@/lib/auth/pin-session";

/**
 * POST /api/admin/pin - exchange the desk PIN for a signed session cookie.
 * GET  /api/admin/pin - is the PIN session still valid?
 * DELETE /api/admin/pin - drop it.
 *
 * Rate limited per instance in memory. Not a substitute for a real rate limiter,
 * but it turns a four-digit space that would otherwise be enumerable at network
 * speed into something that needs sustained effort.
 */

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;

const attempts = new Map<string, { count: number; firstAt: number }>();

function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return (forwarded?.split(",")[0] ?? "local").trim();
}

function lockedOut(key: string): boolean {
  const record = attempts.get(key);
  if (!record) return false;

  if (Date.now() - record.firstAt > WINDOW_MS) {
    attempts.delete(key);
    return false;
  }
  return record.count >= MAX_ATTEMPTS;
}

function noteFailure(key: string): void {
  const record = attempts.get(key);
  if (!record || Date.now() - record.firstAt > WINDOW_MS) {
    attempts.set(key, { count: 1, firstAt: Date.now() });
    return;
  }
  record.count += 1;
}

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
  const key = clientKey(request);

  if (lockedOut(key)) {
    return NextResponse.json(
      { error: "Too many attempts. Wait a few minutes and try again." },
      { status: 429, headers: { "cache-control": "no-store" } },
    );
  }

  const body = (await request.json().catch(() => null)) as { pin?: string } | null;
  if (!body?.pin || !pinMatches(body.pin)) {
    noteFailure(key);
    return NextResponse.json(
      { error: "Wrong PIN." },
      { status: 401, headers: { "cache-control": "no-store" } },
    );
  }

  attempts.delete(key);

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