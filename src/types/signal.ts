export type Confidence = "A+" | "A" | "A-" | "B+" | "B" | "B-" | "C";

export type SignalDirection = "BUY" | "SELL";

export type Market =
  | "XAUUSD"
  | "XAGUSD"
  | "EURUSD"
  | "GBPUSD"
  | "AUDUSD"
  | "USDCAD"
  | "EURJPY"
  | "NAS100"
  | "US30"
  | "SPX500"
  | "BTCUSD";

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
  "A+": 7,
  A: 6,
  "A-": 5,
  "B+": 4,
  B: 3,
  "B-": 2,
  C: 1,
};

export const CONFIDENCE_ORDER: Confidence[] = [
  "A+",
  "A",
  "A-",
  "B+",
  "B",
  "B-",
  "C",
];

export const MARKETS: Market[] = [
  "XAUUSD",
  "XAGUSD",
  "EURUSD",
  "GBPUSD",
  "AUDUSD",
  "USDCAD",
  "EURJPY",
  "NAS100",
  "US30",
  "SPX500",
  "BTCUSD",
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
