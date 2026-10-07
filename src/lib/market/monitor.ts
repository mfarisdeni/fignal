import type { Firestore } from "firebase-admin/firestore";
import { SIGNALS_COLLECTION } from "../signals/schema";
import { evaluateSignal, isMonitoredStatus, MONITORED_STATUSES } from "./status-engine";
import { fetchLatestPrices, twelveSymbol } from "./twelvedata";

/**
 * One market-monitor tick: lock, load live signals, price their symbols once,
 * and commit only the statuses that actually change.
 *
 * Concurrency is guarded twice. The Firestore lease below keeps two cron runs
 * from doing the same work, and every write re-reads its document inside a
 * transaction and re-evaluates from the CURRENT stored status - so even if two
 * runs ever overlap, or the admin moves a signal mid-tick, the second writer
 * sees the first writer's status and evaluates a no-op instead of stomping it.
 * Status moves are compare-and-set, not blind overwrites.
 *
 * Only value imports are relative siblings with no runtime dependencies of
 * their own, so this module (like the engine and client) runs under plain
 * node against a fake Firestore for deterministic tests.
 */

export const MONITOR_LOCK_COLLECTION = "cronLocks";
export const MONITOR_LOCK_ID = "market-monitor";
/** A run that dies mid-tick must not wedge the next one: 55s << 6 minutes. */
export const MONITOR_LEASE_MS = 55_000;
export const MONITOR_MAX_SIGNALS = 200;
export const MONITOR_WRITER = "cron:market-monitor";

export type PriceFetcher = (pairs: string[]) => Promise<{
  prices: Map<string, number>;
  errors: Record<string, string>;
}>;

export type SignalUpdate = {
  id: string;
  pair: string;
  from: string;
  to: string;
  price: number;
};

export type MonitorResult =
  | { ran: false; reason: string }
  | {
      ran: true;
      checked: number;
      updated: SignalUpdate[];
      /** Fignal pairs actually priced this run (deduped). */
      symbols: string[];
      priceErrors: Record<string, string>;
      ms: number;
    };

type StoredSignal = {
  pair: string;
  direction: string;
  status: string;
  entryMin?: number | null;
  entryMax?: number | null;
  sl?: number | null;
  tp1?: number | null;
  tp2?: number | null;
};

/**
 * Single-flight lease in Firestore (serverless-safe: no in-memory state).
 * First run to find the lock missing-or-expired owns this minute; everyone
 * else skips. Never released early - expiry alone re-arms it, so a crashed
 * run cannot wedge the monitor and can at most delay one tick.
 */
export async function acquireMonitorLock(
  db: Firestore,
  runId: string,
  now: number = Date.now(),
): Promise<boolean> {
  const ref = db.collection(MONITOR_LOCK_COLLECTION).doc(MONITOR_LOCK_ID);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists) {
      const data = snap.data() as { expiresAt?: unknown } | undefined;
      if (typeof data?.expiresAt === "number" && data.expiresAt > now) {
        return false;
      }
    }
    tx.set(ref, {
      runId,
      lockedAt: new Date(now).toISOString(),
      expiresAt: now + MONITOR_LEASE_MS,
    });
    return true;
  });
}

export async function runMarketMonitor(
  db: Firestore,
  fetchPrices: PriceFetcher = fetchLatestPrices,
  now: number = Date.now(),
): Promise<MonitorResult> {
  const runId = `${now}-${Math.random().toString(36).slice(2, 10)}`;
  if (!(await acquireMonitorLock(db, runId, now))) {
    return { ran: false, reason: "previous run still holds the lock" };
  }

  const snapshot = await db
    .collection(SIGNALS_COLLECTION)
    .where("status", "in", [...MONITORED_STATUSES])
    .limit(MONITOR_MAX_SIGNALS)
    .get();

  const candidates = snapshot.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() as StoredSignal) }))
    .filter(
      (signal) =>
        twelveSymbol(signal.pair) !== null &&
        isMonitoredStatus(signal.status) &&
        (signal.direction === "BUY" || signal.direction === "SELL"),
    );

  if (candidates.length === 0) {
    return { ran: true, checked: 0, updated: [], symbols: [], priceErrors: {}, ms: Date.now() - now };
  }

  // One price call per symbol per minute - never per signal, never per tick.
  const symbols = [...new Set(candidates.map((signal) => signal.pair))];
  const { prices, errors } = await fetchPrices(symbols);

  const updated: SignalUpdate[] = [];
  for (const signal of candidates) {
    const price = prices.get(signal.pair);
    if (price === undefined) continue; // this symbol failed: leave it untouched
    if (evaluateSignal(signal, price) === null) continue; // no change: no write

    const ref = db.collection(SIGNALS_COLLECTION).doc(signal.id);
    const committed = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return null;
      const current = snap.data() as StoredSignal;
      if (!isMonitoredStatus(current.status)) return null;
      const next = evaluateSignal(current, price);
      if (next === null) return null;
      const at = new Date().toISOString();
      tx.update(ref, {
        status: next,
        statusChangedAt: at,
        statusChangedBy: MONITOR_WRITER,
        triggerPrice: price,
        triggeredAt: at,
      });
      return { from: current.status, to: next };
    });
    if (committed !== null) {
      updated.push({
        id: signal.id,
        pair: signal.pair,
        from: committed.from,
        to: committed.to,
        price,
      });
    }
  }

  return {
    ran: true,
    checked: candidates.length,
    updated,
    symbols,
    priceErrors: errors,
    ms: Date.now() - now,
  };
}
