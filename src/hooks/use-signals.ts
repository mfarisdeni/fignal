import { useEffect, useState } from "react";
import { fetchHistory, fetchSignals } from "@/data/mock-signals";
import { SIGNALS_UPDATED_EVENT } from "@/data/prompt-store";
import type { HistoricalSignal, TradingSignal } from "@/types/signal";

/**
 * Data-fetching hook consumed by the dashboard.
 * Swapping the mock repository for Supabase only changes this hook's internals.
 */
export function useSignals() {
  const [signals, setSignals] = useState<TradingSignal[]>([]);
  const [history, setHistory] = useState<HistoricalSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = () => {
      Promise.all([fetchSignals(), fetchHistory()]).then(([s, h]) => {
        if (cancelled) return;
        setSignals(s);
        setHistory(h);
        setUpdatedAt(new Date());
        setLoading(false);
      });
    };

    load();

    // An admin publishing from /admin writes to the signal store from another
    // route; refetch on that event so this feed is never stale.
    window.addEventListener(SIGNALS_UPDATED_EVENT, load);

    return () => {
      cancelled = true;
      window.removeEventListener(SIGNALS_UPDATED_EVENT, load);
    };
  }, []);

  return { signals, history, loading, updatedAt };
}
