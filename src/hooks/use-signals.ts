import { useEffect, useState } from "react";
import { fetchHistory, fetchSignals } from "@/data/mock-signals";
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
    setLoading(true);
    Promise.all([fetchSignals(), fetchHistory()]).then(([s, h]) => {
      if (cancelled) return;
      setSignals(s);
      setHistory(h);
      setUpdatedAt(new Date());
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { signals, history, loading, updatedAt };
}
