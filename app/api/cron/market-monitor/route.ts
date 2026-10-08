import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/server";
import { runMarketMonitor } from "@/lib/market/monitor";

/**
 * GET /api/cron/market-monitor - our GitHub Actions workflow
 * (.github/workflows/market-monitor.yml) ticks this: every 15 minutes in the
 * quiet window (09:00-14:00 WIB = 02:00-07:00 UTC), every 9 minutes otherwise.
 * Each tick prices the live signals' symbols once via Twelve Data and moves
 * UPCOMING -> ACTIVE -> TP/SL deterministically. ~153 ticks x 4 symbols =
 * ~612 Twelve Data credits/day, ~77% of the 800/day free plan, with margin
 * for retries. GitHub - not Vercel Cron - is the scheduler because Hobby cron
 * is daily-only and sub-daily vercel.json entries fail the deploy.
 *
 * No rate limiter on purpose, same reasoning as the payment webhook: the
 * caller is our own GitHub Actions workflow, not a user, and a false-positive
 * 429 would silently skip ticks of monitoring. Abuse protection is the shared
 * CRON_SECRET the workflow sends as `Authorization: Bearer ...` - compared in
 * constant time, failed closed when missing on either side.
 *
 * 1-minute sampling is near-real-time, not tick-perfect: a spike that touches
 * TP and falls back inside one minute is invisible, and when a sample touches
 * both stop and target the engine assumes the worst fill (SL). Documented in
 * the status engine, repeated here because it is the honest headline.
 */

function secretsEqual(provided: string, expected: string): boolean {
  if (!provided || provided.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  const secret = process.env["CRON_SECRET"] ?? "";
  if (!secret) {
    console.error("[market-monitor] CRON_SECRET is not configured");
    return NextResponse.json(
      { error: "Service temporarily unavailable." },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }

  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!secretsEqual(token, secret)) {
    return NextResponse.json(
      { error: "Unauthorized." },
      { status: 401, headers: { "cache-control": "no-store" } },
    );
  }

  try {
    const result = await runMarketMonitor(adminDb());
    if (!result.ran) {
      console.log(`[market-monitor] skipped: ${result.reason}`);
      return NextResponse.json(result, { headers: { "cache-control": "no-store" } });
    }
    console.log(
      `[market-monitor] ok checked=${result.checked} updated=${result.updated.length} ` +
        `symbols=${result.symbols.join(",")} ms=${result.ms}`,
    );
    for (const update of result.updated) {
      console.log(
        `[market-monitor] ${update.id} ${update.pair} ${update.from}->${update.to} @ ${update.price}`,
      );
    }
    if (Object.keys(result.priceErrors).length > 0) {
      console.error("[market-monitor] price errors", result.priceErrors);
    }
    return NextResponse.json(result, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    // Failures here (no Twelve Data key, Firestore down, provider outage)
    // must be LOUD: a 503 marks the cron red in Vercel instead of silently
    // reporting a healthy-looking empty run.
    console.error("[market-monitor] run failed", error);
    return NextResponse.json(
      { error: "Service temporarily unavailable." },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
