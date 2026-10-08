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

/**
 * Reasoning families on Groq. A reasoning model spends hidden chain-of-thought
 * tokens from the same completion budget, so at the default effort it can burn
 * the whole allowance thinking and come back with empty content and
 * finish_reason "length" — exactly the "no content" failure. Translation needs
 * no deep thought, so these models are asked for low effort; anything else
 * omits the parameter, because a gateway that does not know it rejects the
 * whole request.
 */
const REASONING_MODEL = /gpt-oss|qwen3|deepseek-r1/i;

/** Completion budget with headroom for reasoning plus the longest rationale. */
const MAX_TOKENS = 4096;

/** Translation must not hang the desk; a slow gateway fails fast instead. */
const TIMEOUT_MS = 20_000;

/**
 * The visible answer out of a chat choice. Content is usually a string, but
 * some gateways return content blocks — joined here so a valid translation is
 * never reported as missing. The reasoning trace is never an answer: when the
 * model thought but said nothing, that is a failure with a finish_reason, not
 * text to show members.
 */
function choiceText(choice: unknown): string {
  const message = (choice as { message?: { content?: unknown } } | null)?.message;
  const content = message?.content;
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((part) =>
        typeof part === "string"
          ? part
          : typeof (part as { text?: unknown })?.text === "string"
            ? ((part as { text: string }).text as string)
            : "",
      )
      .join("")
      .trim();
  }
  return "";
}

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
        max_tokens: MAX_TOKENS,
        ...(REASONING_MODEL.test(model) ? { reasoning_effort: "low" } : {}),
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: english },
        ],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return { ok: false, reason: `Groq ${response.status}: ${detail.slice(0, 300)}` };
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: unknown }; finish_reason?: string }>;
    };
    const choice = payload.choices?.[0];
    const text = choiceText(choice);

    if (!text) {
      // finish_reason is the diagnosis: "length" means the budget ran out
      // (reasoning ate it), anything else means the model said nothing.
      const stopped = choice?.finish_reason ?? "unknown";
      return { ok: false, reason: `Groq returned no content (finish_reason=${stopped})` };
    }

    return { ok: true, text };
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      return { ok: false, reason: `Groq timed out after ${TIMEOUT_MS / 1000}s — try again` };
    }
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "translation failed",
    };
  }
}