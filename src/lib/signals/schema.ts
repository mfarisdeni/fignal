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
 */
export type SignalDocument = TradingSignal & {
  /** Indonesian translation of `reason`, or null if translation has not landed. */
  reasonId: string | null;
  /** True when the publish succeeded but translation did not. */
  translationPending: boolean;
};

export const SIGNALS_COLLECTION = "signals";