import { publishedSignals } from "@/data/prompt-store";
import type { TradingSignal } from "@/types/signal";

/**
 * Signal repository.
 *
 * This module is the ONLY place that knows where signal data comes from. The
 * UI consumes `TradingSignal` objects through `lib/signals.ts`, so this file
 * can later be swapped for a Supabase-backed repository without any component
 * changes:
 *
 *   Supabase → signal repository → signal components
 *
 * The desk is connected, so the feed is whatever /admin has published — there
 * are no placeholder records standing in for it. An empty feed therefore means
 * an empty desk, and the dashboard says so rather than filling the gap.
 *
 * Nothing is delayed here on purpose: the records are already on the device, so
 * a simulated round-trip would only make a live desk feel slower than it is.
 */
export function fetchSignals(): Promise<TradingSignal[]> {
  return Promise.resolve(publishedSignals());
}
