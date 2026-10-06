import { NextResponse } from "next/server";
import { sessionFacts } from "@/lib/auth/session";
import { checkRateLimit, clientIp, rateLimited, serviceUnavailable } from "@/lib/auth/rate-limit";

/**
 * GET /api/session - what the signed-in user actually is.
 *
 * The client never infers entitlement from localStorage; it asks here and gets
 * an answer derived from a verified ID token plus a server-owned membership
 * record.
 */
export async function GET(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : undefined;

  const facts = await sessionFacts(token);

  // Generous: the client asks on navigation and refresh. Anonymous callers have
  // no UID, so they share a per-IP bucket instead of one global anonymous pool.
  const sessionResult = await checkRateLimit(request, {
    name: "session",
    identifier: facts.uid ? facts.uid : `anon:${clientIp(request)}`,
    identifierClass: facts.uid ? "uid" : "ip",
    limit: 600,
    window: "1 h",
    failClosed: false,
  });
  if (!sessionResult.ok) {
    return sessionResult.unavailable ? serviceUnavailable() : rateLimited(sessionResult.retryAfter);
  }

  return NextResponse.json(facts, {
    headers: { "cache-control": "no-store" },
  });
}