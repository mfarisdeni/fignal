export type Confidence = "A+" | "A" | "B+" | "B" | "C";

export type SignalDirection = "BUY" | "SELL";

export type Market = "XAUUSD" | "EURUSD" | "NAS100" | "BTCUSD";

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
  note?: string;
};

/** A completed signal shown in the Recent History section. */
export type HistoricalSignal = {
  id: string;
  pair: Market;
  direction: SignalDirection;
  confidence: Confidence;
  result: "TP1_HIT" | "TP2_HIT" | "SL_HIT" | "EXPIRED" | "CANCELLED";
  closedAt: string; // ISO 8601
};

/** Deterministic confidence ranking — the single source of truth for ordering. */
export const confidenceRank: Record<Confidence, number> = {
  "A+": 5,
  A: 4,
  "B+": 3,
  B: 2,
  C: 1,
};

export const CONFIDENCE_ORDER: Confidence[] = ["A+", "A", "B+", "B", "C"];

export const MARKETS: Market[] = ["XAUUSD", "EURUSD", "NAS100", "BTCUSD"];
