import { analysisToSignal, parseAnalysis } from "@/lib/analysis";
import {
  CONFIDENCE_ORDER,
  type AnalysisRecord,
  type Market,
  type SignalStatus,
  type TradingSignal,
} from "@/types/signal";

/**
 * Repository for prompts submitted through /admin.
 *
 * A record keeps the raw prompt next to the summary pulled out of it, so the
 * member-facing numbers always have their source material one click away and
 * a mis-parse can be traced back to the exact wording the desk produced.
 *
 * Storage is localStorage, matching the placeholder sessions in `use-auth`.
 * Swapping this file for a Supabase table is the whole migration: nothing
 * outside the repository knows where a published signal came from.
 */

const STORAGE_KEY = "fignal-admin-analysis";

/** Fired after every write so an open dashboard can refetch. */
export const SIGNALS_UPDATED_EVENT = "fignal:signals-updated";

/**
 * Market names published before the registry was renamed, mapped to the current
 * spelling. Keyed as plain strings on purpose: "NAS100" is no longer a Market, so
 * a typed key here would make the one name we still have to accept impossible
 * to write down.
 */
const LEGACY_MARKETS: Record<string, Market> = { NAS100: "US100" };

/**
 * Grades outside the current scale are dropped rather than trusted: an
 * analysis stored before the scale was trimmed to A+/A/B+/B has to read as
 * ungraded, not as a badge the UI cannot render.
 *
 * Markets are migrated rather than dropped. The index used to be published as
 * NAS100 and is now US100 — the same instrument under the name members
 * actually trade it by, and the one this desk lists — so records written
 * earlier must not silently disappear from the feed.
 */
function normalize(record: AnalysisRecord): AnalysisRecord {
  const { confidence, pair } = record;
  const market = LEGACY_MARKETS[pair] ?? pair;
  const grade =
    confidence !== undefined && CONFIDENCE_ORDER.includes(confidence)
      ? confidence
      : undefined;
  if (market === pair && grade === confidence) return record;
  return { ...record, pair: market, confidence: grade };
}

function read(): AnalysisRecord[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed)
      ? (parsed as AnalysisRecord[]).map(normalize)
      : [];
  } catch {
    /* private mode or corrupted payload — treat as an empty desk */
    return [];
  }
}

function write(records: AnalysisRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    /* quota exceeded or private mode — the session still works in memory */
  }
  window.dispatchEvent(new Event(SIGNALS_UPDATED_EVENT));
}

/** Newest submission first — the admin's review order. */
export function loadAnalyses(): AnalysisRecord[] {
  return read().sort(
    (a, b) =>
      new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime(),
  );
}

/**
 * Parse a prompt and publish it. A trade signal starts as UPCOMING: the
 * analysis exists, the trade has not been taken, and the admin moves it on by
 * hand. A prompt that calls for no setup is published as NO_TRADE, so it reads
 * as the absence of a trade rather than as a pending one.
 */
export function submitAnalysis(raw: string): AnalysisRecord {
  const parsed = parseAnalysis(raw);
  const record: AnalysisRecord = {
    ...parsed,
    id: `an-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    submittedAt: new Date().toISOString(),
    raw,
    status: parsed.call === "NO_TRADE" ? "NO_TRADE" : "UPCOMING",
  };
  write([record, ...read()]);
  return record;
}

/** Move a published signal along its lifecycle — this is what feeds the
 *  dashboard's TP-hit / SL-hit counters and the win-rate summary. */
export function setAnalysisStatus(id: string, status: SignalStatus): void {
  write(read().map((record) => (record.id === id ? { ...record, status } : record)));
}

export function removeAnalysis(id: string): void {
  write(read().filter((record) => record.id !== id));
}

/** Admin-published signals, ready to merge into the member feed. */
export function publishedSignals(): TradingSignal[] {
  return loadAnalyses().map(analysisToSignal);
}
