import { NextResponse } from "next/server";
import { sessionFacts } from "@/lib/auth/session";

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

  return NextResponse.json(facts, {
    headers: { "cache-control": "no-store" },
  });
}