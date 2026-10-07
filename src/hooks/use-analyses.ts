import { useCallback, useState } from "react";
import {
  loadAnalyses,
  removeAnalysis,
  replaceAnalyses,
  submitAnalysis,
} from "@/data/prompt-store";
import { analysisToSignal } from "@/lib/analysis";
import { authHeaders } from "@/hooks/use-auth";
import type { AnalysisRecord, SignalStatus } from "@/types/signal";

/**
 * Read/write access to the prompt desk for /admin.
 *
 * submit() and setStatus() now go to the server instead of localStorage. That is
 * the change that makes the member feed work on a phone: a publish written only
 * to the admin's disk reached the admin's own dashboard and nothing else.
 *
 * localStorage is kept for the desk's working record - the parsed prompt, the raw
 * text, and the review list - because that is genuinely per-desk scratch data.
 * It is no longer the feed.
 */
export function useAnalyses() {
  const [records, setRecords] = useState<AnalysisRecord[]>(() => loadAnalyses());
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Publish a parsed prompt to the shared feed.
   *
   * Async now, because the publish is a network write that can be refused - the
   * admin claim may not be attached yet, or the desk may be offline. Returning a
   * record optimistically would show "published" for a signal no member can see.
   */
  const submit = useCallback(async (raw: string) => {
    setPending(true);
    setError(null);

    const record = submitAnalysis(raw); // local working copy, as before
    const signal = analysisToSignal(record);

    try {
      const response = await fetch("/api/signals", {
        method: "POST",
        headers: { "content-type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({
          pair: signal.pair,
          direction: signal.direction,
          confidence: signal.confidence,
          entryMin: signal.entryMin,
          entryMax: signal.entryMax,
          sl: signal.sl,
          tp1: signal.tp1,
          tp2: signal.tp2,
          status: signal.status,
          reason: signal.reason ?? "",
          call: record.call,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error: string }
          | null;
        // No safe server reason (a crash or gateway page has no JSON body), so
        // name the status instead of swallowing it: a 403 and a 500 are fixed
        // in very different places.
        throw new Error(
          payload?.error ??
            `The desk could not publish this (HTTP ${response.status}).`,
        );
      }

      // Keep the local id pointing at the Firestore document, so a later status
      // change addresses the same record members are looking at.
      const { id: remoteId } = (await response.json()) as { id: string };
      const stored = loadAnalyses().map((item) =>
        item.id === record.id ? { ...item, id: remoteId } : item,
      );
      replaceAnalyses(stored);
      setRecords(loadAnalyses());

      return { ...record, id: remoteId } as AnalysisRecord;
    } catch (caught) {
      // Roll back the local working copy: it was written before the server
      // confirmed, and leaving it behind publishes a phantom the members can
      // never see - and that no later status change can address.
      removeAnalysis(record.id);
      setRecords(loadAnalyses());
      const message =
        caught instanceof Error ? caught.message : "The desk could not publish this.";
      setError(message);
      throw new Error(message);
    } finally {
      setPending(false);
    }
  }, []);

  const setStatus = useCallback(
    async (id: string, status: SignalStatus) => {
      const previous = loadAnalyses();
      setError(null);
      // Optimistic: the desk moves a signal on mid-session and should not wait
      // on a round trip to see it.
      replaceAnalyses(previous.map((r) => (r.id === id ? { ...r, status } : r)));
      setRecords(loadAnalyses());

      try {
        const response = await fetch(`/api/signals/${id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json", ...(await authHeaders()) },
          body: JSON.stringify({ status }),
        });
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as
            | { error: string }
            | null;
          throw new Error(
            payload?.error ??
              `Could not update the status for members (HTTP ${response.status}).`,
          );
        }
      } catch (caught) {
        // Roll back to what Firestore actually holds.
        replaceAnalyses(previous);
        setRecords(loadAnalyses());
        setError(
          caught instanceof Error ? caught.message : "Could not update the status.",
        );
      }
    },
    [],
  );

  const remove = useCallback((id: string) => {
    removeAnalysis(id);
    setRecords(loadAnalyses());
  }, []);

  /**
   * Retry the Indonesian translation for a published signal. The id must be
   * the Firestore document id (remapped at publish time); a local-only record
   * has nothing server-side to translate and the endpoint 404s.
   */
  const translate = useCallback(async (id: string) => {
    const response = await fetch(
      `/api/signals/${encodeURIComponent(id)}/translate`,
      {
        method: "POST",
        headers: { "content-type": "application/json", ...(await authHeaders()) },
      },
    );
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { error: string }
        | null;
      throw new Error(payload?.error ?? "Translation failed.");
    }
  }, []);

  return { records, submit, setStatus, remove, translate, pending, error };
}