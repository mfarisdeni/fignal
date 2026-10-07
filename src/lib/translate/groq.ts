import "server-only";

/**
 * Translation of the analyst's reason, via the Groq OpenAI-compatible gateway.
 *
 * Server-only because the key is a bearer token: any key that reaches the
 * browser is a key anyone can spend.
 *
 * Two rules this module exists to enforce:
 *
 * 1. The original is never replaced. The caller stores `reason` (English) and
 *    `reasonId` (Indonesian) side by side. A trading desk's wording is a record
 *    of what was actually analysed, so translating in place would quietly
 *    rewrite the audit trail.
 *
 * 2. Finance vocabulary is pinned. "Entry", "stop loss", "take profit",
 *    "liquidity", "session" are desk terms; a literal MT gloss of "wait for the
 *    pullback" reads as nonsense to the analyst who wrote it. The prompt below
 *    keeps them intact and tells the model not to invent levels.
 *
 * The model is asked for text only. No JSON schema, no prose to strip - one
 * less thing to fail quietly.
 */

const SYSTEM_PROMPT = `You translate trading-desk commentary from English into natural Indonesian for Indonesian traders.

Rules:
- Preserve all trading terms as they are used by Indonesian traders: entry, exit, stop loss, take profit TP1/TP2/TP3, risk:reward, support, resistance, breakout, false breakout, pullback, retest, liquidity, session, sniper setup, confirm, confirmation, candle, wick, momentum, divergence, overbought, oversold.
- Preserve every number, price level, pair name (XAUUSD, BTCUSD, EURUSD, NAS100), grade (A+, A, B+, B) and directional word (BUY, SELL, WAIT) exactly as written. Never round, convert or reformat them.
- Do not add analysis, caveats, disclaimers or commentary that is not in the source. Do not shorten it.
- Write idiomatic Indonesian, not translated-sounding Indonesian. Formal "Anda" register, matching a professional trading desk.
- Output only the Indonesian text. No preamble, no quotes, no explanation.`;

export type TranslationResult =
  | { ok: true; text: string }
  | { ok: false; reason: string };

export async function translateToIndonesian(
  english: string,
): Promise<TranslationResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return { ok: false, reason: "GROQ_API_KEY is not configured" };
  }

  const base = (process.env.GROQ_API_URL ?? "https://api.groq.com/openai/v1").replace(
    /\/+$/,
    "",
  );
  // gpt-oss-20b is the default: translation runs inside the publish request,
  // so the fastest adequate model wins. Override with GROQ_MODEL
  // (e.g. openai/gpt-oss-120b, qwen/qwen3-32b) without a code change.
  const model = process.env.GROQ_MODEL ?? "openai/gpt-oss-20b";

  try {
    const response = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 900,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: english },
        ],
      }),
      // Publish must not hang on a slow gateway; fall back to English instead.
      signal: AbortSignal.timeout(20_000),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return { ok: false, reason: `Groq ${response.status}: ${detail.slice(0, 300)}` };
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = payload.choices?.[0]?.message?.content?.trim();

    if (!text) return { ok: false, reason: "Groq returned no content" };

    return { ok: true, text };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "translation failed",
    };
  }
}