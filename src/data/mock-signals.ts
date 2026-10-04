import { publishedSignals } from "@/data/prompt-store";
import type { HistoricalSignal, TradingSignal } from "@/types/signal";

/**
 * Signal repository.
 *
 * This module is the ONLY place that knows where signal data comes from.
 * The UI consumes `TradingSignal` objects through `lib/signals.ts`, so this
 * file can later be swapped for a Supabase-backed repository without any
 * component changes:
 *
 *   Supabase → signal repository → signal components
 *
 * Prompts published from /admin are read from the prompt store and lead the
 * feed; the mock records below only stand in for the rest of the day's book.
 * Timestamps are anchored to "now" so the dashboard always looks fresh.
 */

function minutesAgo(min: number): string {
  return new Date(Date.now() - min * 60_000).toISOString();
}

function daysAgo(days: number, hour = 20): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, 30, 0, 0);
  return d.toISOString();
}

export const mockSignals: TradingSignal[] = [
  {
    id: "sig-xau-01",
    pair: "XAUUSD",
    direction: "BUY",
    confidence: "A+",
    entryMin: 2645,
    entryMax: 2650,
    sl: 2635,
    tp1: 2665,
    tp2: 2680,
    status: "ACTIVE",
    generatedAt: minutesAgo(4),
    reason:
      "Asia low was swept and reclaimed, price now holding above session VWAP with bullish displacement on the 5M",
  },
  {
    id: "sig-eur-01",
    pair: "EURUSD",
    direction: "SELL",
    confidence: "A",
    entryMin: 1.085,
    entryMax: 1.0858,
    sl: 1.0882,
    tp1: 1.0812,
    tp2: 1.0784,
    status: "ENTRY_HIT",
    generatedAt: minutesAgo(52),
    reason:
      "London open failed to hold 1.0860, lower high formed into daily supply with a clean bearish break of structure",
  },
  {
    id: "sig-nas-01",
    pair: "NAS100",
    direction: "BUY",
    confidence: "B+",
    entryMin: 20150,
    entryMax: 20180,
    sl: 20090,
    tp1: 20260,
    tp2: 20350,
    status: "TP1_HIT",
    generatedAt: minutesAgo(178),
    reason:
      "Opening range breakout retested, the 20150 demand zone held on the first touch and buyers stepped in",
  },
  {
    id: "sig-xau-02",
    pair: "XAUUSD",
    direction: "SELL",
    confidence: "B",
    entryMin: 2672,
    entryMax: 2676,
    sl: 2688,
    tp1: 2658,
    tp2: 2644,
    status: "TP2_HIT",
    generatedAt: minutesAgo(312),
    reason:
      "Double top at 2688 confirmed by a bearish engulfing candle, structure shifted to lower highs",
  },
  {
    id: "sig-eur-02",
    pair: "EURUSD",
    direction: "BUY",
    confidence: "C",
    entryMin: 1.079,
    entryMax: 1.0796,
    sl: 1.0768,
    tp1: 1.082,
    tp2: 1.084,
    status: "SL_HIT",
    generatedAt: minutesAgo(430),
    reason:
      "Range low rejection was shallow, the bounce into the 1.0790 supply shelf had no follow-through",
  },
  {
    id: "sig-xau-03",
    pair: "XAUUSD",
    direction: "BUY",
    confidence: "A",
    entryMin: 2638,
    entryMax: 2642,
    sl: 2628,
    tp1: 2658,
    tp2: 2672,
    status: "ENTRY_HIT",
    generatedAt: minutesAgo(96),
    reason:
      "Bullish flag resolved above 2648, the retest is holding as support with volume still contracting",
  },
  {
    id: "sig-nas-02",
    pair: "NAS100",
    direction: "SELL",
    confidence: "B+",
    entryMin: 20235,
    entryMax: 20265,
    sl: 20305,
    tp1: 20170,
    tp2: 20110,
    status: "UPCOMING",
    generatedAt: minutesAgo(18),
    reason:
      "Buy-side liquidity above 20200 was grabbed, bearish displacement confirmed on the 15M",
  },
  {
    id: "sig-btc-notrade",
    pair: "BTCUSD",
    direction: "NO_TRADE",
    status: "NO_TRADE",
    generatedAt: minutesAgo(9),
    note: "Weekend setups are published Saturday morning WIB once the weekly structure is clear.",
  },
];

export const mockHistory: HistoricalSignal[] = [
  {
    id: "his-01",
    pair: "XAUUSD",
    direction: "BUY",
    confidence: "A+",
    result: "TP2_HIT",
    closedAt: daysAgo(1),
  },
  {
    id: "his-02",
    pair: "EURUSD",
    direction: "SELL",
    confidence: "A",
    result: "TP1_HIT",
    closedAt: daysAgo(1, 16),
  },
  {
    id: "his-03",
    pair: "NAS100",
    direction: "BUY",
    confidence: "B+",
    result: "SL_HIT",
    closedAt: daysAgo(2, 21),
  },
  {
    id: "his-04",
    pair: "XAUUSD",
    direction: "SELL",
    confidence: "A",
    result: "TP1_HIT",
    closedAt: daysAgo(3, 15),
  },
  {
    id: "his-05",
    pair: "BTCUSD",
    direction: "BUY",
    confidence: "B",
    result: "TP2_HIT",
    closedAt: daysAgo(5, 10),
  },
  {
    id: "his-06",
    pair: "EURUSD",
    direction: "BUY",
    confidence: "B+",
    result: "TP1_HIT",
    closedAt: daysAgo(5, 17),
  },
  {
    id: "his-07",
    pair: "NAS100",
    direction: "SELL",
    confidence: "B",
    result: "SL_HIT",
    closedAt: daysAgo(6, 22),
  },
  {
    id: "his-08",
    pair: "XAUUSD",
    direction: "BUY",
    confidence: "A",
    result: "TP1_HIT",
    closedAt: daysAgo(7, 14),
  },
];

/** Simulated latency so loading skeletons are exercised like a real feed. */
export function fetchSignals(): Promise<TradingSignal[]> {
  return new Promise((resolve) =>
    // Admin-published signals lead the feed — they are the live desk output,
    // the mock records below are only the placeholder that stands in for the
    // rest of the day's book until the real feed is connected.
    setTimeout(() => resolve([...publishedSignals(), ...mockSignals]), 900),
  );
}

export function fetchHistory(): Promise<HistoricalSignal[]> {
  return new Promise((resolve) =>
    setTimeout(() => resolve(mockHistory), 1100),
  );
}
