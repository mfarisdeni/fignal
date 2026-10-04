import {
  CONFIDENCE_ORDER,
  type AnalysisRecord,
  type Confidence,
  type Market,
  type ParsedAnalysis,
  type SignalDirection,
  type TradeCall,
  type TradingSignal,
} from "@/types/signal";

/**
 * Market-analysis prompt parser.
 *
 * The admin pastes a finished analysis (the output of the desk's prompt) and
 * this module lifts the numbers the member dashboard actually renders:
 * pair, call, confidence, entry, stop loss and the two targets.
 *
 * Two rules govern everything here:
 *
 *  1. Never invent a level. If the prompt does not state an entry, the field
 *     stays undefined and the gap is named in `missing` so the admin can fix
 *     the prompt instead of shipping a fabricated price to members.
 *  2. Read structure, not wording. Blocks are found by their label ("SL:",
 *     "Grade:") and headings ("SNIPER INSTRUCTION") rather than by sentence
 *     order, so a reordered or longer analysis still parses.
 */

/* ------------------------------------------------------------------ */
/* Price scanning                                                      */
/* ------------------------------------------------------------------ */

type PriceToken = { value: number; start: number; end: number };

/**
 * Every price-like number in a block, keeping offsets so the text *between*
 * two candidates can be inspected — that gap is what separates a real zone
 * ("4215 - 4225") from two unrelated levels.
 *
 * A number glued to a letter is skipped so "M15" and "H4" can never pose as
 * prices, and bare single digits are skipped so "1:4" cannot win either.
 */
function priceTokens(block: string): PriceToken[] {
  const tokens: PriceToken[] = [];
  for (const match of block.matchAll(/\d[\d,]*(?:\.\d+)?/g)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    const before = block[start - 1] ?? "";
    const after = block[end] ?? "";
    if (/[A-Za-z]/.test(before) || /[A-Za-z]/.test(after)) continue;
    const value = Number(match[0].replace(/,/g, ""));
    if (!Number.isFinite(value)) continue;
    if (value < 100 && !match[0].includes(".")) continue;
    tokens.push({ value, start, end });
  }
  return tokens;
}

/** Matches when two prices are joined into one zone: "-", "to", "→", etc. */
const RANGE_GAP = /^\s*(?:-{1,2}|–|—|to|→)\s*$/i;

/**
 * Entry handling: a range when the prompt gives one, a flat level otherwise.
 * Ranges are normalised ascending so the member always reads low → high.
 */
function parseEntryZone(block: string | undefined): {
  entryMin?: number;
  entryMax?: number;
} {
  if (!block) return {};
  const [first, second] = priceTokens(block);
  if (!first) return {};
  if (second && RANGE_GAP.test(block.slice(first.end, second.start))) {
    return {
      entryMin: Math.min(first.value, second.value),
      entryMax: Math.max(first.value, second.value),
    };
  }
  return { entryMin: first.value, entryMax: first.value };
}

/** Stop loss is a single level — the first price the block states. */
function parseLevel(block: string | undefined): number | undefined {
  return block ? priceTokens(block)[0]?.value : undefined;
}

/**
 * Targets: prefer explicitly numbered "TP1:" / "TP2:" lines, otherwise fall
 * back to the first two prices in the block in the order they appear.
 */
function parseTargets(block: string | undefined): { tp1?: number; tp2?: number } {
  if (!block) return {};
  const numbered = (n: number) => {
    const found = new RegExp(`TP\\s*${n}[^\\d]{0,12}(\\d[\\d,]*(?:\\.\\d+)?)`, "i").exec(
      block,
    );
    return found ? Number(found[1].replace(/,/g, "")) : undefined;
  };
  const levels = priceTokens(block).map((token) => token.value);
  const tp1 = numbered(1) ?? levels[0];
  const tp2 = numbered(2) ?? (tp1 == null ? levels[1] : levels.find((l) => l !== tp1));
  return { tp1, tp2 };
}

/* ------------------------------------------------------------------ */
/* Block discovery                                                     */
/* ------------------------------------------------------------------ */

type LabelBlock = { key: string; text: string; start: number };

const LABEL_LINE = /^([A-Za-z][A-Za-z0-9 /&'()-]{0,38}?)\s*:\s*(.*)$/;
const UPPER_LINE = /^[A-Z0-9][A-Z0-9 &/()'-]{2,}$/;

/**
 * An ALL-CAPS section title such as "TRADE DECISION" or "SNIPER INSTRUCTION".
 * Short single words are deliberately excluded — "SHORT" and "BUY" are values
 * on their own line, "CONFIDENCE" and "INVALIDATION" are headings.
 */
function isHeading(line: string): boolean {
  return UPPER_LINE.test(line) && (line.includes(" ") || line.length >= 8);
}

/** "Risk/Reward", "Stop Loss" and "H4 Bias" all collapse to one key. */
function normalizeLabel(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Split the prompt into labelled blocks. A "Label:" line opens a block and
 * every following non-label line belongs to it, so multi-line values such as
 * the Entry paragraph survive intact.
 *
 * An ALL-CAPS heading closes the open block: a value never runs on into the
 * next section, which is what keeps "Grade:" from swallowing the paragraph
 * under CONFIDENCE.
 */
function labelBlocks(text: string): LabelBlock[] {
  const blocks: { key: string; start: number; parts: string[] }[] = [];
  let active: { key: string; start: number; parts: string[] } | null = null;
  let offset = 0;

  for (const line of text.split(/\r?\n/)) {
    const lineStart = offset;
    offset += line.length + 1;

    const trimmed = line.trim();
    if (isHeading(trimmed)) {
      active = null;
      continue;
    }

    const label = LABEL_LINE.exec(trimmed);
    if (label) {
      active = {
        key: normalizeLabel(label[1]),
        start: lineStart,
        parts: [label[2]],
      };
      blocks.push(active);
      continue;
    }
    active?.parts.push(line);
  }

  return blocks.map((block) => ({
    key: block.key,
    start: block.start,
    text: block.parts.join("\n").trim(),
  }));
}

function pickLabel(
  blocks: LabelBlock[],
  aliases: string[],
  after = -1,
): LabelBlock | undefined {
  return blocks.find((block) => block.start >= after && aliases.includes(block.key));
}

/**
 * Every matching block joined in document order. Targets need this because a
 * prompt often numbers them — "TP1:" and "TP2:" each open their own block.
 */
function joinLabels(blocks: LabelBlock[], aliases: string[]): string | undefined {
  const texts = blocks
    .filter((block) => aliases.includes(block.key) && block.text)
    .map((block) => block.text);
  return texts.length ? texts.join("\n") : undefined;
}

const BIAS_LABELS = ["h4bias", "bias", "htfbias", "h1bias", "trendbias"];
const DECISION_LABELS = ["decision", "tradedecision", "action", "verdict"];
const ENTRY_LABELS = [
  "entry",
  "entryzone",
  "entryarea",
  "entryprice",
  "entrylevel",
  "entrylevels",
  "entrycondition",
  "entrytrigger",
];
const SL_LABELS = ["sl", "stoploss", "stoplosslevel"];
const TP_LABELS = ["tp", "tp1", "tp2", "tp3", "targets", "target", "takeprofit"];
const RR_LABELS = ["riskreward", "rr", "riskrewardratio"];
const GRADE_LABELS = ["grade", "confidencegrade", "confidence", "rating"];
const REASON_LABELS = ["reason", "rationale", "reasoning"];

/** Body of an ALL-CAPS section, e.g. the line under "SNIPER INSTRUCTION". */
function sectionBody(text: string, heading: string): string | undefined {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex(
    (line) => normalizeLabel(line) === normalizeLabel(heading),
  );
  if (start === -1) return undefined;

  const body: string[] = [];
  for (const line of lines.slice(start + 1)) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (body.length) break;
      continue;
    }
    // The section's own first line may read as a heading — only a *later*
    // heading or label ends the section.
    if (body.length && (isHeading(trimmed) || LABEL_LINE.test(trimmed))) break;
    body.push(trimmed);
  }
  return body.length ? body.join(" ") : undefined;
}

/** First non-empty line of a block — headings often own the next line. */
function firstLine(block: LabelBlock | undefined): string | undefined {
  if (!block) return undefined;
  return block.text.split("\n").find((line) => line.trim().length > 0)?.trim();
}

/* ------------------------------------------------------------------ */
/* Field extraction                                                    */
/* ------------------------------------------------------------------ */

const MARKET_ALIASES: Record<Market, string[]> = {
  XAUUSD: ["xauusd", "gold", "xau"],
  EURUSD: ["eurusd", "eur"],
  NAS100: ["nas100", "us100", "ndx", "nasdaq"],
  BTCUSD: ["btcusd", "btc", "bitcoin"],
};

/**
 * The title line names the market; the body only mentions it in passing, so
 * the head of the prompt is searched first to avoid a prose false positive.
 */
function detectMarket(text: string): Market | undefined {
  const lower = text.toLowerCase();
  const head = lower.slice(0, 200);
  for (const scope of [head, lower]) {
    for (const market of Object.keys(MARKET_ALIASES) as Market[]) {
      if (MARKET_ALIASES[market].some((alias) => new RegExp(`\\b${alias}\\b`).test(scope)))
        return market;
    }
  }
  return undefined;
}

function directionFromBias(bias: string): SignalDirection | null {
  if (/\b(BULLISH|BUY|LONG)\b/.test(bias)) return "BUY";
  if (/\b(BEARISH|SELL|SHORT)\b/.test(bias)) return "SELL";
  return null;
}

/**
 * The decision line drives the call; the timeframe bias supplies the side.
 * "WAIT (NO CHASE)" is a wait *on a direction*, not a no-trade — the plan is
 * still published, because that is exactly what the member is waiting on.
 */
function detectCall(
  decision: string | undefined,
  bias: string | undefined,
): { call: TradeCall; direction: SignalDirection | "NO_TRADE" } {
  const said = (decision ?? "").toUpperCase();
  const biasText = (bias ?? "").toUpperCase();
  const side = directionFromBias(biasText);

  if (/\bNO[\s-]?TRADE\b/.test(said) || /\bNO[\s-]?TRADE\b/.test(biasText))
    return { call: "NO_TRADE", direction: "NO_TRADE" };
  if (/\b(ENTER|LONG|BUY)\b/.test(said)) return { call: "ENTER", direction: "BUY" };
  if (/\b(SELL|SHORT)\b/.test(said)) return { call: "ENTER", direction: "SELL" };
  if (/\b(WAIT|NO[\s-]?CHASE|HOLD|PATIENT|NO ENTRY|STAND[\s-]?ASIDE)\b/.test(said))
    return { call: "WAIT", direction: side ?? "NO_TRADE" };
  if (side) return { call: "ENTER", direction: side };
  return { call: "NO_TRADE", direction: "NO_TRADE" };
}

function asConfidence(value: string): Confidence | undefined {
  const grade = value.toUpperCase() as Confidence;
  return CONFIDENCE_ORDER.includes(grade) ? grade : undefined;
}

/**
 * Grades arrive as "Grade: B", "Grade:\nB" or "Confidence Grade — A+". The
 * labelled block wins; the loose text scan is a last resort.
 */
function detectConfidence(
  blocks: LabelBlock[],
  text: string,
): Confidence | undefined {
  const grade = pickLabel(blocks, GRADE_LABELS);
  if (grade) {
    const bare = /^\**\s*([ABC]\+?)\s*\.?\**$/i.exec(grade.text.trim());
    if (bare) {
      const value = asConfidence(bare[1]);
      if (value) return value;
    }
    const inline = /(?:grade|rating|confidence)\s*[:-]?\s*\**\s*([ABC]\+?)\b/i.exec(
      grade.text,
    );
    if (inline) {
      const value = asConfidence(inline[1]);
      if (value) return value;
    }
  }
  const loose = /(?:confidence|grade|rating)\D{0,24}?([ABC]\+?)\b/i.exec(text);
  return loose ? asConfidence(loose[1]) : undefined;
}

/* ------------------------------------------------------------------ */
/* Entry point                                                         */
/* ------------------------------------------------------------------ */

/**
 * Pull the summary out of a raw analysis prompt.
 *
 * Pure and total: any string in, a summary out. An unparseable prompt yields
 * a record whose `missing` list explains itself rather than throwing.
 */
export function parseAnalysis(raw: string): ParsedAnalysis {
  const text = raw.replace(/\r\n/g, "\n");
  const blocks = labelBlocks(text);

  const bias = pickLabel(blocks, BIAS_LABELS);
  const decision = pickLabel(blocks, DECISION_LABELS);
  const grade = pickLabel(blocks, GRADE_LABELS);

  const market = detectMarket(text);
  const { call, direction } = detectCall(firstLine(decision), firstLine(bias));
  const confidence = detectConfidence(blocks, text);
  const { entryMin, entryMax } = parseEntryZone(
    pickLabel(blocks, ENTRY_LABELS)?.text,
  );
  const sl = parseLevel(pickLabel(blocks, SL_LABELS)?.text);
  const { tp1, tp2 } = parseTargets(joinLabels(blocks, TP_LABELS));

  const missing: string[] = [];
  if (!market) missing.push("pair");
  if (entryMin == null) missing.push("entry");
  if (sl == null) missing.push("sl");
  if (tp1 == null) missing.push("tp");
  if (confidence == null) missing.push("confidence");

  return {
    pair: market ?? "XAUUSD",
    call,
    direction,
    confidence,
    entryMin,
    entryMax,
    sl,
    tp1,
    tp2,
    decision: firstLine(decision),
    riskReward: firstLine(pickLabel(blocks, RR_LABELS)),
    sniper: sectionBody(text, "SNIPER INSTRUCTION"),
    invalidation: sectionBody(text, "INVALIDATION"),
    reason: firstLine(pickLabel(blocks, REASON_LABELS, grade?.start ?? -1)),
    missing,
  };
}

const CALL_LABEL: Record<TradeCall, string> = {
  ENTER: "ENTER",
  WAIT: "WAIT",
  NO_TRADE: "NO TRADE",
};

/** The decision line is the first thing a member should read. */
export function callLabel(record: AnalysisRecord): string {
  const said = record.decision?.split("\n")[0]?.trim().toUpperCase();
  return said ? said.slice(0, 48) : CALL_LABEL[record.call];
}

function firstSentence(text: string | undefined, limit = 180): string | undefined {
  if (!text) return undefined;
  const flat = text.replace(/\s+/g, " ").trim();
  const stop = flat.search(/\.\s/);
  const sentence = stop === -1 ? flat : flat.slice(0, stop + 1);
  return sentence.length > limit ? `${sentence.slice(0, limit).trimEnd()}…` : sentence;
}

/**
 * A card shows one rationale line, so the decision and the sniper trigger are
 * folded in ahead of the analyst's own reasoning: a member must know this is
 * a wait, not a market order, before reading the numbers.
 */
function buildReason(record: AnalysisRecord): string | undefined {
  const parts = [callLabel(record)];
  if (record.sniper) parts.push(record.sniper);
  const why = firstSentence(record.reason);
  if (why) parts.push(why);
  return parts.join(" · ");
}

/** Shape a stored record into the signal the member dashboard renders. */
export function analysisToSignal(record: AnalysisRecord): TradingSignal {
  return {
    id: `sig-${record.id}`,
    pair: record.pair,
    direction: record.direction,
    confidence: record.confidence,
    entryMin: record.entryMin,
    entryMax: record.entryMax,
    sl: record.sl,
    tp1: record.tp1,
    tp2: record.tp2,
    status: record.status,
    generatedAt: record.submittedAt,
    reason: buildReason(record),
    note: record.invalidation,
  };
}
