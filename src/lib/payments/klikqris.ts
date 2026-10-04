import "server-only";

/**
 * KlikQris configuration.
 *
 * Credentials come from environment variables only. The Farisium version of this
 * file hardcodes both the sandbox and the production key in source, which means
 * the production merchant credential lives in git history permanently - so that
 * pattern is deliberately not copied. If a value is missing, the module throws
 * rather than falling back to a literal.
 */

const MODES = {
  sandbox: { base: "https://klikqris.com/api/sandbox" },
  production: { base: "https://klikqris.com/api" },
} as const;

export type KlikQrisMode = keyof typeof MODES;

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}. See .env.example.`);
  }
  return value;
}

export type KlikQrisConfig = {
  mode: KlikQrisMode;
  base: string;
  apiKey: string;
  merchantId: string;
};

export function klikQris(): KlikQrisConfig {
  const mode = (process.env.KLIKQRIS_MODE as KlikQrisMode) ?? "production";
  const base = process.env.KLIKQRIS_API_BASE || MODES[mode]?.base || MODES.production.base;

  return {
    mode,
    base: base.replace(/\/+$/, ""),
    apiKey: required("KLIKQRIS_API_KEY"),
    merchantId: required("KLIKQRIS_ID_MERCHANT"),
  };
}

/**
 * The price is a server constant, never a client-supplied number.
 *
 * Farisium accepts an `amount` from the client and maps it through a tier table.
 * That table is the only thing standing between a caller and a Rp1.000 order, so
 * FIGNAL has no amount parameter at all: there is one product, it costs
 * Rp10.000, and no request can ask for a different figure.
 */
export const MEMBERSHIP_PRICE_IDR = 10_000;

/** Shown struck through next to the real price. */
export const MEMBERSHIP_LIST_PRICE_IDR = 20_000;

/**
 * How long one payment buys, in days.
 *
 * Seven days, not a month. Expiry is the point: when it lapses the member loses
 * /platinum and has to pay again to extend, so the value of the plan is decided
 * by how often the desk actually delivers rather than by a generous default.
 */
export const MEMBERSHIP_DAYS = 7;

export const MEMBERSHIP_MS = MEMBERSHIP_DAYS * 24 * 60 * 60 * 1000;