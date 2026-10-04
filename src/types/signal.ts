/**
 * The desk only stands behind four grades. A-, B- and C are deliberately not
 * offered: a prompt graded below B is reported as ungraded rather than shown
 * as a grade the desk does not use.
 */
export type Confidence = "A+" | "A" | "B+" | "B";

export type SignalDirection = "BUY" | "SELL";

/**
 * The markets the parser can name. The first four in MARKETS are the desk's
 * standing lineup; the rest exist so a pasted prompt that mentions a secondary
 * market still lands somewhere real instead of reporting the pair as missing.
 * Adding a market is a one-line change here plus its aliases in MARKET_ALIASES
 * — the member feed reads this list, it does not hardcode any of it.
 */
export type Market =
  | "XAUUSD"
  | "EURUSD"
  | "NAS100"
  | "BTCUSD"
  | "XAGUSD"
  | "GBPUSD"
  | "AUDUSD"
  | "USDCAD"
  | "EURJPY"
  | "US30"
  | "SPX500";

export type SignalStatus =
  | "UPCOMING"
  | "ACTIVE"
  | "ENTRY_HIT"
  | "TP1_HIT"
  | "TP2_HIT"
  | "SL_HIT"
  | "EXPIRED"
  | "CANCELLED";

export type TradingSignal = {
  id: string;
  pair: Market;
  direction: SignalDirection | "NO_TRADE";
  confidence?: Confidence;
  entryMin?: number;
  entryMax?: number;
  sl?: number;
  tp1?: number;
  tp2?: number;
  status: SignalStatus | "NO_TRADE";
  generatedAt: string; // ISO 8601
  /** One-line rationale for taking this setup — shown under the pair name. */
  reason?: string;
  note?: string;
};

/**
 * What the analysis asked the desk to do right now.
 * WAIT still carries a full plan (entry / SL / TP) — it just waits for a trigger.
 */
export type TradeCall = "ENTER" | "WAIT" | "NO_TRADE";

/**
 * Everything the parser could pull out of a raw market-analysis prompt.
 * Fields the prompt does not state stay undefined and are named in `missing`,
 * so a gap is always visible to the admin instead of being guessed.
 */
export type ParsedAnalysis = {
  pair: Market;
  call: TradeCall;
  direction: SignalDirection | "NO_TRADE";
  confidence?: Confidence;
  entryMin?: number;
  entryMax?: number;
  sl?: number;
  tp1?: number;
  tp2?: number;
  /** Verbatim decision line, e.g. "WAIT (NO CHASE)". */
  decision?: string;
  riskReward?: string;
  /** The trigger the analyst wants before entering. */
  sniper?: string;
  invalidation?: string;
  reason?: string;
  missing: string[];
};

/** A prompt submitted through /admin, plus the summary extracted from it. */
export type AnalysisRecord = ParsedAnalysis & {
  id: string;
  submittedAt: string; // ISO 8601
  /** The prompt exactly as submitted — the source material for the summary. */
  raw: string;
  /**
   * Lifecycle of the published signal — the admin keeps it current by hand.
   * A prompt the parser reads as "no valid setup" is published as NO_TRADE
   * rather than as a trade waiting to be taken.
   */
  status: SignalStatus | "NO_TRADE";
};

/** A completed signal shown in the Recent History section. */
export type HistoricalSignal = {
  id: string;
  pair: Market;
  direction: SignalDirection;
  /** A setup the prompt never graded still counts towards the win rate. */
  confidence?: Confidence;
  result: "TP1_HIT" | "TP2_HIT" | "SL_HIT" | "EXPIRED" | "CANCELLED";
  closedAt: string; // ISO 8601
};

/** Deterministic confidence ranking — the single source of truth for ordering. */
export const confidenceRank: Record<Confidence, number> = {
  "A+": 4,
  A: 3,
  "B+": 2,
  B: 1,
};

export const CONFIDENCE_ORDER: Confidence[] = ["A+", "A", "B+", "B"];

/**
 * Order here is member-facing: the four the desk stands behind come first, in
 * the order traders scan them, and any other detected market follows. The
 * parser walks this same list, so a market's position also decides which
 * mention wins when a prompt names more than one.
 */
export const MARKETS: Market[] = [
  "XAUUSD",
  "EURUSD",
  "NAS100",
  "BTCUSD",
  "XAGUSD",
  "GBPUSD",
  "AUDUSD",
  "USDCAD",
  "EURJPY",
  "US30",
  "SPX500",
];

/** Every status an admin-published signal can be moved to. */
export const SIGNAL_STATUSES: SignalStatus[] = [
  "UPCOMING",
  "ACTIVE",
  "ENTRY_HIT",
  "TP1_HIT",
  "TP2_HIT",
  "SL_HIT",
  "EXPIRED",
  "CANCELLED",
];
