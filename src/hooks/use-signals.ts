import { useEffect, useMemo, useState } from "react";
import { fetchSignals } from "@/data/signal-repository";
import { SIGNALS_UPDATED_EVENT } from "@/data/prompt-store";
import { closedHistory } from "@/lib/signals";
import type { TradingSignal } from "@/types/signal";

/**
 * Data-fetching hook consumed by the dashboard.
 * Swapping the repository for Supabase only changes this hook's internals.
 *
 * History is derived from the feed rather than fetched beside it, so the two
 * can never drift apart.
 */
export function useSignals() {
  const [signals, setSignals] = useState<TradingSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const history = useMemo(() => closedHistory(signals), [signals]);

  useEffect(() => {
    let cancelled = false;

    const load = () => {
      fetchSignals().then((s) => {
        if (cancelled) return;
        setSignals(s);
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
