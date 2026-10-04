import {
  CONFIDENCE_ORDER,
  confidenceRank,
  type Confidence,
  type HistoricalSignal,
  type Market,
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

const WIN_RESULTS = ["TP1_HIT", "TP2_HIT"];
const LOSS_RESULTS = ["SL_HIT"];

/** Nearest letter grade for a fractional confidence rank. */
function rankToConfidence(rank: number): Confidence {
  return CONFIDENCE_ORDER.reduce((best, c) =>
    Math.abs(confidenceRank[c] - rank) < Math.abs(confidenceRank[best] - rank)
      ? c
      : best,
  );
}

/**
 * Track record derived from closed setups: the historical feed plus any of
 * today's signals that already closed. Expired and cancelled setups are
 * excluded — they say nothing about whether the analysis was right.
 */
export function summarizePerformance(
  history: HistoricalSignal[],
  signals: TradingSignal[],
): PerformanceSummary {
  const closed: { confidence?: Confidence; result: string }[] = [
    ...history.map((h) => ({ confidence: h.confidence, result: h.result })),
    ...signals
      .filter((s) => DONE_STATUSES.includes(s.status as SignalStatus))
      .map((s) => ({ confidence: s.confidence, result: s.status })),
  ];

  const resolved = closed.filter(
    (c) =>
      WIN_RESULTS.includes(c.result) ||
      LOSS_RESULTS.includes(c.result),
  );
  const wins = resolved.filter((c) => WIN_RESULTS.includes(c.result)).length;

  const graded = closed.filter(
    (c): c is { confidence: Confidence; result: string } =>
      c.confidence != null,
  );
  const avgRank = graded.length
    ? graded.reduce((sum, c) => sum + confidenceRank[c.confidence], 0) /
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
  XAGUSD: 2,
  EURUSD: 4,
  GBPUSD: 4,
  AUDUSD: 4,
  USDCAD: 4,
  EURJPY: 3,
  NAS100: 0,
  US30: 0,
  SPX500: 1,
  BTCUSD: 0,
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

/** "20:04 WIB" */
export function formatTimeWIB(iso: string): string {
  const t = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: WIB,
  }).format(new Date(iso));
  return `${t} WIB`;
}

/** "Thu 2 Oct" */
export function formatDateShort(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: WIB,
  }).format(new Date(iso));
}

/** e.g. "Friday · London / New York session" or "Saturday · Weekend — BTC focus" */
export function sessionLabel(now = new Date()): string {
  const day = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    timeZone: WIB,
  }).format(now);
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      hour12: false,
      timeZone: WIB,
    }).format(now),
  );
  const isWeekend = day === "Saturday" || day === "Sunday";
  if (isWeekend) return `${day} · Weekend — BTC focus`;
  if (hour >= 6 && hour < 14) return `${day} · Asia session`;
  if (hour >= 14 && hour < 22) return `${day} · London / New York session`;
  return `${day} · Sydney / Tokyo session`;
}

/* ------------------------------------------------------------------ */
/* Labels & presentation maps                                          */
/* ------------------------------------------------------------------ */

export const STATUS_LABEL: Record<TradingSignal["status"], string> = {
  UPCOMING: "Upcoming",
  ACTIVE: "Active",
  ENTRY_HIT: "Entry hit",
  TP1_HIT: "TP1 hit",
  TP2_HIT: "TP2 hit",
  SL_HIT: "SL hit",
  EXPIRED: "Expired",
  CANCELLED: "Cancelled",
  NO_TRADE: "No trade",
};

export const CONFIDENCE_DESCRIPTION: Record<Confidence, string> = {
  "A+": "Highest confidence",
  A: "High confidence",
  "A-": "High confidence",
  "B+": "Moderate-high confidence",
  B: "Moderate confidence",
  "B-": "Moderate confidence",
  C: "Lower confidence",
};

/** Text colour per grade — used for numeric/letter values outside a badge. */
export const CONFIDENCE_TEXT: Record<Confidence, string> = {
  "A+": "text-conf-aplus",
  A: "text-conf-a",
  "A-": "text-conf-a",
  "B+": "text-conf-bplus",
  B: "text-conf-b",
  "B-": "text-conf-b",
  C: "text-conf-c",
};
