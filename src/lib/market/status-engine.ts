import type { SignalStatus } from "@/types/signal";

/**
 * Deterministic signal-status rules for the 1-minute market monitor.
 *
 * Pure and dependency-free on purpose: no database, no clock, no network, no
 * value imports at all. The cron route feeds it a stored signal plus one fresh
 * price, and it answers which status the signal must hold now - or null when
 * nothing changes. Every branch below is covered by mock-price tests, because
 * a rule the desk cannot predict is a rule the desk cannot trust.
 *
 * Touch counts: comparisons are inclusive (>= / <=). A price exactly on a
 * level filled that level - TradingView, MT5 and every backtester agree.
 *
 * Two deliberate policies, both documented because they are judgment calls:
 *
 * 1. UPCOMING evaluates the entry only. A signal whose price is already past
 *    TP but never touched entry has no fill, so it stays UPCOMING - there is
 *    no trade to resolve. The desk cancels such setups by hand.
 *
 * 2. Stop before target. When one tick's sample touches BOTH the stop and a
 *    target, the true order is unknowable at this granularity, so the engine
 *    assumes the worst fill and reports SL_HIT. Conservative and deterministic.
 */

/** Statuses the monitor reads from Firestore each tick. */
export const MONITORED_STATUSES = ["UPCOMING", "ACTIVE", "ENTRY_HIT"] as const;

export type MonitoredStatus = (typeof MONITORED_STATUSES)[number];

export function isMonitoredStatus(status: string): status is MonitoredStatus {
  return (MONITORED_STATUSES as readonly string[]).includes(status);
}

/**
 * The slice of a stored signal the rules need. Loose by design - Firestore
 * hands back untyped data (and stores explicit nulls for missing levels), so
 * the engine validates everything itself instead of trusting the write path.
 */
export type EvaluableSignal = {
  direction: string;
  status: string;
  entryMin?: number | null;
  entryMax?: number | null;
  sl?: number | null;
  tp1?: number | null;
  tp2?: number | null;
};

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * The status this signal must hold at `price`, or null when it must stay.
 * Never returns the input status, never moves backwards, never touches
 * terminal states (TP2_HIT, SL_HIT, EXPIRED, CANCELLED, NO_TRADE).
 */
export function evaluateSignal(
  signal: EvaluableSignal,
  price: number | null | undefined,
): SignalStatus | null {
  if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) {
    return null;
  }
  if (signal.direction !== "BUY" && signal.direction !== "SELL") {
    return null;
  }
  const buy = signal.direction === "BUY";

  const entryMin = num(signal.entryMin);
  const entryMax = num(signal.entryMax);
  const sl = num(signal.sl);
  const tp1 = num(signal.tp1);
  const tp2 = num(signal.tp2);

  if (signal.status === "UPCOMING") {
    // First touch of the entry zone. A BUY zone fills top-down, so entryMax
    // is the trigger; a SELL zone fills bottom-up, so entryMin is. A single
    // level arrives as either field - whichever is set wins.
    const trigger = buy ? (entryMax ?? entryMin) : (entryMin ?? entryMax);
    if (trigger === null) return null;
    const touched = buy ? price <= trigger : price >= trigger;
    return touched ? "ACTIVE" : null;
  }

  // ENTRY_HIT is the admin's hand-entered equivalent of ACTIVE: the monitor
  // never writes it, but it must still resolve TP/SL for signals holding it.
  if (signal.status === "ACTIVE" || signal.status === "ENTRY_HIT") {
    if (sl !== null && (buy ? price <= sl : price >= sl)) return "SL_HIT";
    // Highest target first: a gap straight past TP2 reports TP2, not TP1.
    if (tp2 !== null && (buy ? price >= tp2 : price <= tp2)) return "TP2_HIT";
    if (tp1 !== null && (buy ? price >= tp1 : price <= tp1)) return "TP1_HIT";
    return null;
  }

  if (signal.status === "TP1_HIT") {
    if (tp2 !== null && (buy ? price >= tp2 : price <= tp2)) return "TP2_HIT";
    return null;
  }

  return null;
}
