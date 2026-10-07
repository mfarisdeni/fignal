import type { TradingSignal } from "@/types/signal";

/**
 * A signal as stored in Firestore.
 *
 * Deliberately extends TradingSignal rather than redefining it: the card, the
 * filters and the session formatting all consume TradingSignal, so if the
 * stored shape drifted from it every component would need a mapping layer and
 * something would eventually be forgotten.
 *
 * Only two fields are added, both about translation. `reason` is always the
 * analyst's original English - a trading desk's wording is a record of what was
 * actually analysed, so translating in place would quietly rewrite the audit
 * trail - and `reasonId` is the Indonesian shown when the member picks Indonesian.
 *
 * The 1-minute market monitor additionally writes `triggerPrice`/`triggeredAt`
 * (and PATCH writes `statusChangedAt`/`statusChangedBy`) straight onto the
 * document; the feed spreads stored data and ignores what it does not render,
 * so monitor metadata never disturbs the UI.
 */
export type SignalDocument = TradingSignal & {
  /** Indonesian translation of `reason`, or null if translation has not landed. */
  reasonId: string | null;
  /** True when the publish succeeded but translation did not. */
  translationPending: boolean;
  /** Price sample that last moved this signal, written by the market monitor. */
  triggerPrice?: number;
  /** When the monitor last moved this signal. ISO 8601. */
  triggeredAt?: string;
};

export const SIGNALS_COLLECTION = "signals";