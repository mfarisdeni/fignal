import { useEffect, useMemo, useState } from "react";
import { subscribeToSignals } from "@/lib/signals/feed";
import { closedHistory } from "@/lib/signals";
import type { TradingSignal } from "@/types/signal";

/**
 * Data-fetching hook consumed by the dashboard.
 *
 * This used to call fetchSignals(), which read localStorage through the prompt
 * store - so a member on a phone got whatever the admin's browser had published
 * to its own disk, which is nothing at all. It now holds a Firestore listener
 * open, so the feed is genuinely shared and genuinely live.
 *
 * History is still derived from the feed rather than fetched beside it, so the
 * two cannot drift apart.
 */
export function useSignals() {
  const [signals, setSignals] = useState<TradingSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const history = useMemo(() => closedHistory(signals), [signals]);

  useEffect(() => {
    setLoading(true);

    const unsubscribe = subscribeToSignals(
      (documents) => {
        setSignals(documents);
        setUpdatedAt(new Date());
        setLoading(false);
      },
      (failure) => {
        // A permission error here means the account is not a member; the gate
        // upstream already handles that, but surfacing it beats an empty list
        // that looks like a quiet desk.
        setError(failure);
        setLoading(false);
      },
    );

    return unsubscribe;
  }, []);

  return { signals, history, loading, error, updatedAt };
}