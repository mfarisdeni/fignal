/**
 * Twelve Data /price client for the 1-minute market monitor.
 *
 * One credit per symbol per call: `GET /price?symbol=XAU/USD&apikey=...`
 * answers `{ "price": "2650.12" }` and nothing else, which is exactly what the
 * monitor needs - no ticks stored, no history fetched.
 *
 * The key stays server-only (TWELVE_DATA_API_KEY, never NEXT_PUBLIC_). This
 * module has no imports at all, so it cannot drag the key - or anything else -
 * into a client bundle, and so mock-price tests can stub `fetch` directly.
 */

export const TWELVE_DATA_BASE = "https://api.twelvedata.com";
export const TWELVE_DATA_TIMEOUT_MS = 8_000;

/**
 * Fignal market -> Twelve Data symbol.
 *
 * XAU/USD and EUR/USD are Twelve Data's documented metal/FX forms. NDX is
 * Nasdaq's own Nasdaq-100 ticker and Twelve Data's documented index symbol
 * for it - but the live symbol-search check is still owed, so if NDX ever
 * answers "symbol not found", this map is the one line to change.
 *
 * Budget: ~153 ticks/day x 4 symbols = ~612 credits/day, ~77% of the free
 * plan's 800/day, with margin left for retries and error responses (which the
 * provider still bills). Each tick fires its symbols in parallel - a burst of
 * 4, inside the 8/minute cap. The daily budget is the binding constraint, not
 * the minutely one: 6-7 calls a minute around the clock would need 8000+
 * credits a day. See the schedule in .github/workflows/market-monitor.yml.
 */
export const TWELVE_SYMBOLS: Record<string, string> = {
  XAUUSD: "XAU/USD",
  EURUSD: "EUR/USD",
  NAS100: "NDX",
  BTCUSD: "BTC/USD",
};

/** The provider symbol for a Fignal pair, or null when unsupported. */
export function twelveSymbol(pair: string): string | null {
  return TWELVE_SYMBOLS[pair] ?? null;
}

export type PriceResult = {
  /** Latest price per Fignal pair - only symbols that answered cleanly. */
  prices: Map<string, number>;
  /** Per-pair failure reason for everything else. Safe to log: no key. */
  errors: Record<string, string>;
};

/** Strict parse of a /price payload. Anything unexpected is a miss, not a 0. */
export function parsePricePayload(payload: unknown): number | null {
  if (typeof payload !== "object" || payload === null) return null;
  const raw = (payload as { price?: unknown }).price;
  const price = typeof raw === "string" ? Number(raw) : raw;
  return typeof price === "number" && Number.isFinite(price) && price > 0
    ? price
    : null;
}

/** Twelve Data error shape: { status: "error", message: "..." }. */
export function providerErrorMessage(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const record = payload as Record<string, unknown>;
  return record["status"] === "error" && typeof record["message"] === "string" && record["message"]
    ? record["message"]
    : null;
}

/**
 * Latest price for each pair, fetched in parallel. One symbol's failure -
 * timeout, HTTP error, unparseable body - is recorded in `errors` and never
 * fails the others; the monitor leaves that pair's signals untouched.
 *
 * Never logs the request URL: it carries the API key as a query param.
 */
export async function fetchLatestPrices(
  pairs: string[],
  fetcher: typeof fetch = fetch,
): Promise<PriceResult> {
  const prices = new Map<string, number>();
  const errors: Record<string, string> = {};
  const unique = [...new Set(pairs)].filter((pair) => twelveSymbol(pair) !== null);
  if (unique.length === 0) return { prices, errors };

  const apiKey = process.env["TWELVE_DATA_API_KEY"] ?? "";
  if (!apiKey) {
    throw new Error("Missing TWELVE_DATA_API_KEY. Set it on the host.");
  }

  await Promise.all(
    unique.map(async (pair) => {
      const symbol = twelveSymbol(pair);
      if (!symbol) return;
      try {
        const response = await fetcher(
          `${TWELVE_DATA_BASE}/price?symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(apiKey)}`,
          { signal: AbortSignal.timeout(TWELVE_DATA_TIMEOUT_MS) },
        );
        const payload: unknown = await response.json().catch(() => null);
        if (!response.ok) {
          errors[pair] = providerErrorMessage(payload) ?? `HTTP ${response.status}`;
          return;
        }
        const price = parsePricePayload(payload);
        if (price === null) {
          errors[pair] = providerErrorMessage(payload) ?? "unparseable price";
          return;
        }
        prices.set(pair, price);
      } catch (error) {
        errors[pair] = error instanceof Error ? error.message : "request failed";
      }
    }),
  );

  return { prices, errors };
}
