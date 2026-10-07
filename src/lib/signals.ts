import {
  DEFAULT_LANGUAGE,
  LOCALE,
  translate,
  type Language,
} from "@/lib/i18n";
import {
  CONFIDENCE_ORDER,
  MARKETS,
  confidenceRank,
  type Confidence,
  type HistoricalSignal,
  type Market,
  type SignalDirection,
  type SignalStatus,
  type TradingSignal,
} from "@/types/signal";

/* ------------------------------------------------------------------ */
/* Sorting                                                             */
/* ------------------------------------------------------------------ */

/**
 * Sort signals from highest confidence to lowest (A+ → A → B+ → B → C).
 * Ties break on recency. Never alphabetical, never insertion order.
 * NO_TRADE records always sink to the end.
 */
export function sortSignalsByConfidence<T extends TradingSignal>(
  signals: T[],
): T[] {
  return [...signals].sort((a, b) => {
    const ra = a.confidence ? confidenceRank[a.confidence] : -1;
    const rb = b.confidence ? confidenceRank[b.confidence] : -1;
    if (ra !== rb) return rb - ra;
    return new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime();
  });
}

/** The featured signal is simply the first after confidence sorting. */
export function splitFeatured(signals: TradingSignal[]): {
  featured: TradingSignal | null;
  rest: TradingSignal[];
} {
  const sorted = sortSignalsByConfidence(signals).filter(
    (s) => s.status !== "NO_TRADE",
  );
  return { featured: sorted[0] ?? null, rest: sorted.slice(1) };
}

/* ------------------------------------------------------------------ */
/* Filtering                                                           */
/* ------------------------------------------------------------------ */

export type StatusFilter = "ALL" | "ACTIVE" | "COMPLETED";

const LIVE_STATUSES: SignalStatus[] = ["UPCOMING", "ACTIVE", "ENTRY_HIT"];
const DONE_STATUSES: SignalStatus[] = [
  "TP1_HIT",
  "TP2_HIT",
  "SL_HIT",
  "EXPIRED",
  "CANCELLED",
];

export function isLiveStatus(status: TradingSignal["status"]): boolean {
  return LIVE_STATUSES.includes(status as SignalStatus);
}

const RESULT_STATUSES: SignalStatus[] = ["TP1_HIT", "TP2_HIT", "SL_HIT"];

/** Setups that resolved with money decided - the track-record section. */
export function isResultStatus(status: TradingSignal["status"]): boolean {
  return RESULT_STATUSES.includes(status as SignalStatus);
}

/**
 * The markets worth offering as a filter, taken from what the feed actually
 * holds rather than from the registry.
 *
 * A pill for a market with nothing behind it is a dead end: the member taps it,
 * sees an empty card, and concludes the app is broken. So the row only ever
 * lists markets that have a signal, and MARKETS decides the order — the four
 * the desk covers first, anything else the parser picked up after them. A new
 * pair therefore appears on its own, from a pasted prompt, with no UI change.
 *
 * Derived from every signal rather than only the live ones, so narrowing to
 * completed setups can never leave the filter pointing at a market that has
 * just been filtered out of the row.
 */
export function availableMarkets(signals: TradingSignal[]): Market[] {
  const present = new Set(signals.map((signal) => signal.pair));
  return MARKETS.filter((market) => present.has(market));
}

/**
 * The market filter the dashboard should actually apply.
 *
 * A remembered selection can outlive its market — that was the last signal and
 * it was deleted, or the desk has published nothing since. Honouring it would
 * put an un-clearable filter over an empty feed, so an unavailable market reads
 * as All. The stored choice is left alone, so the member's pick comes back if
 * that market ever does.
 */
export function resolveMarketFilter(
  markets: Market[],
  selected: Market | "ALL",
): Market | "ALL" {
  return selected !== "ALL" && !markets.includes(selected) ? "ALL" : selected;
}

export function filterSignals(
  signals: TradingSignal[],
  market: Market | "ALL",
  status: StatusFilter,
): TradingSignal[] {
  return signals.filter((s) => {
    if (market !== "ALL" && s.pair !== market) return false;
    if (s.status === "NO_TRADE") return status === "ALL";
    if (status === "ACTIVE") return isLiveStatus(s.status);
    if (status === "COMPLETED")
      return DONE_STATUSES.includes(s.status as SignalStatus);
    return true;
  });
}

/* ------------------------------------------------------------------ */
/* Summary                                                             */
/* ------------------------------------------------------------------ */

export type DaySummary = {
  total: number;
  active: number;
  tp1: number;
  tp2: number;
  sl: number;
};

export function summarizeDay(signals: TradingSignal[]): DaySummary {
  const real = signals.filter((s) => s.status !== "NO_TRADE");
  return {
    total: real.length,
    active: real.filter((s) => isLiveStatus(s.status)).length,
    tp1: real.filter((s) => s.status === "TP1_HIT").length,
    tp2: real.filter((s) => s.status === "TP2_HIT").length,
    sl: real.filter((s) => s.status === "SL_HIT").length,
  };
}

/* ------------------------------------------------------------------ */
/* Performance                                                         */
/* ------------------------------------------------------------------ */

export type PerformanceSummary = {
  /** Setups that reached a target or a stop — the only fair win-rate base. */
  resolved: number;
  wins: number;
  losses: number;
  /** 0–1, or null when nothing has resolved yet. */
  winRate: number | null;
  /** Mean confidence grade across published setups, rounded to a grade. */
  avgConfidence: Confidence | null;
};

const WIN_RESULTS: HistoricalSignal["result"][] = ["TP1_HIT", "TP2_HIT"];
const LOSS_RESULTS: HistoricalSignal["result"][] = ["SL_HIT"];

/** Statuses that close a setup out. Expired and cancelled are closed too. */
const CLOSED_STATUSES: HistoricalSignal["result"][] = [
  "TP1_HIT",
  "TP2_HIT",
  "SL_HIT",
  "EXPIRED",
  "CANCELLED",
];

/** Nearest letter grade for a fractional confidence rank. */
function rankToConfidence(rank: number): Confidence {
  return CONFIDENCE_ORDER.reduce((best, c) =>
    Math.abs(confidenceRank[c] - rank) < Math.abs(confidenceRank[best] - rank)
      ? c
      : best,
  );
}

/**
 * Completed setups, newest first.
 *
 * The desk keeps every signal in one place, so history is a view over the
 * published feed rather than a second list that could disagree with it. A
 * no-trade record is not a closed trade and never appears here.
 */
export function closedHistory(signals: TradingSignal[]): HistoricalSignal[] {
  return signals
    .filter(
      (s) =>
        s.direction !== "NO_TRADE" &&
        CLOSED_STATUSES.includes(s.status as HistoricalSignal["result"]),
    )
    .map((s) => ({
      id: s.id,
      pair: s.pair,
      direction: s.direction as SignalDirection,
      confidence: s.confidence,
      result: s.status as HistoricalSignal["result"],
      closedAt: s.generatedAt,
    }))
    .sort(
      (a, b) =>
        new Date(b.closedAt).getTime() - new Date(a.closedAt).getTime(),
    );
}

/**
 * Track record of the live desk: win rate from the setups that have actually
 * resolved, average grade from everything published.
 *
 * Expired and cancelled setups are left out of the win rate — they say nothing
 * about whether the analysis was right — but they are not a win either. No
 * setup is counted twice: the closed ones are read straight off the feed.
 */
export function summarizePerformance(
  signals: TradingSignal[],
): PerformanceSummary {
  const closed = closedHistory(signals);
  const resolved = closed.filter(
    (c) =>
      WIN_RESULTS.includes(c.result) || LOSS_RESULTS.includes(c.result),
  );
  const wins = resolved.filter((c) => WIN_RESULTS.includes(c.result)).length;

  const graded = signals.filter(
    (s) => s.status !== "NO_TRADE" && s.confidence != null,
  );
  const avgRank = graded.length
    ? graded.reduce((sum, s) => sum + confidenceRank[s.confidence!], 0) /
      graded.length
    : 0;

  return {
    resolved: resolved.length,
    wins,
    losses: resolved.length - wins,
    winRate: resolved.length ? wins / resolved.length : null,
    avgConfidence: graded.length ? rankToConfidence(avgRank) : null,
  };
}

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

/** Decimals per market — no unnecessary trailing precision. */
const PAIR_DECIMALS: Record<Market, number> = {
  XAUUSD: 0,
  EURUSD: 4,
  NAS100: 0,
  BTCUSD: 0,
  XAGUSD: 2,
  GBPUSD: 4,
  AUDUSD: 4,
  USDCAD: 4,
  EURJPY: 3,
  US30: 0,
  SPX500: 1,
};

export function formatPrice(value: number, pair: Market): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: PAIR_DECIMALS[pair],
    maximumFractionDigits: PAIR_DECIMALS[pair],
  });
}

export function formatEntry(signal: TradingSignal): string {
  if (signal.entryMin == null) return "—";
  const min = formatPrice(signal.entryMin, signal.pair);
  if (signal.entryMax == null || signal.entryMax === signal.entryMin)
    return min;
  return `${min} – ${formatPrice(signal.entryMax, signal.pair)}`;
}
const WIB = "Asia/Jakarta";

/** "20:04 WIB" / "20.04 WIB" */
export function formatTimeWIB(iso: string, language: Language = DEFAULT_LANGUAGE): string {
  const time = new Intl.DateTimeFormat(LOCALE[language], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: WIB,
  }).format(new Date(iso));
  return `${time} WIB`;
}

/** e.g. "Thu 2 Oct" / "Kam 2 Okt" */
export function formatDateShort(
  iso: string,
  language: Language = DEFAULT_LANGUAGE,
): string {
  return new Intl.DateTimeFormat(LOCALE[language], {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: WIB,
  }).format(new Date(iso));
}

/**
 * Which FX session is running right now.
 *
 * Sessions overlap, so one name has to win and it is not arbitrary: New York
 * beats London, London beats Tokyo, Tokyo beats Sydney. Each block below is
 * the WIB hour range where that session is the dominant one — New York spans
 * midnight, hence the wrap.
 */
export function sessionLabel(
  language: Language = DEFAULT_LANGUAGE,
  now = new Date(),
): string {
  const day = new Intl.DateTimeFormat(LOCALE[language], {
    weekday: "long",
    timeZone: WIB,
  }).format(now);
  const hour = Number(
    new Intl.DateTimeFormat(LOCALE[language], {
      hour: "2-digit",
      hour12: false,
      timeZone: WIB,
    }).format(now),
  );

  // Weekday as a number, not a name: "Saturday" is "Sabtu" in Indonesian, and
  // comparing the translated name would quietly skip the weekend there. WIB is
  // a flat +7 with no daylight saving, so shifting is exact.
  const wibDay = new Date(now.getTime() + 7 * 60 * 60 * 1000).getUTCDay();
  if (wibDay === 0 || wibDay === 6)
    return translate(language, "session.weekend", { day });

  if (hour >= 23 || hour < 4) return translate(language, "session.newYork");
  if (hour < 7) return translate(language, "session.sydney");
  if (hour < 14) return translate(language, "session.tokyo");
  return translate(language, "session.london");
}

/* ------------------------------------------------------------------ */
/* Labels & presentation maps                                          */
/* ------------------------------------------------------------------ */

/** Text colour per grade — used for numeric/letter values outside a badge. */
export const CONFIDENCE_TEXT: Record<Confidence, string> = {
  "A+": "text-conf-aplus",
  A: "text-conf-a",
  "B+": "text-conf-bplus",
  B: "text-conf-b",
};
