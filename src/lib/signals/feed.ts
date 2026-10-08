import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  type Unsubscribe,
} from "firebase/firestore";
import { firestore } from "@/lib/firebase/client";
import { dedupeSignals } from "@/lib/signals";
import { SIGNALS_COLLECTION, type SignalDocument } from "@/lib/signals/schema";

/**
 * Live signal feed.
 *
 * This is the module that fixes the empty dashboard on a phone. It used to call
 * publishedSignals(), which returned records parsed out of localStorage - so a
 * member saw whatever the publishing browser happened to have stored, and
 * nothing at all on any other device. The feed was never slow or broken; it had
 * no shared source of truth.
 *
 * onSnapshot rather than a one-shot get(): a member who leaves the dashboard open
 * through a session should see the desk's next publish arrive rather than a list
 * that quietly goes stale.
 */

/**
 * Only the newest few. Every document read is billable, so an unbounded listener
 * would quietly grow the cost of every dashboard left open.
 */
const FEED_LIMIT = 50;

export function subscribeToSignals(
  onData: (signals: SignalDocument[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  let db;
  try {
    db = firestore();
  } catch (error) {
    // Missing Firebase config. Reported rather than thrown so the dashboard can
    // say what is wrong instead of failing to render.
    onError(error instanceof Error ? error : new Error(String(error)));
    return () => {};
  }

  // generatedAt is an ISO 8601 string, which sorts lexicographically in
  // chronological order - no extra numeric index needed.
  const feed = query(
    collection(db, SIGNALS_COLLECTION),
    orderBy("generatedAt", "desc"),
    limit(FEED_LIMIT),
  );

  return onSnapshot(
    feed,
    (snapshot) => {
      // A double publish leaves two identical documents live; members see one
      // card, and the counts, filters and history all agree on it. The desk
      // still sees both in /admin and deletes the leftover clone there.
      onData(
        dedupeSignals(
          snapshot.docs.map((doc) => ({
            ...(doc.data() as SignalDocument),
            id: doc.id,
          })),
        ),
      );
    },
    (error) => onError(error),
  );
}