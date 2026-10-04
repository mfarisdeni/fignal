import {
  CONFIDENCE_ORDER,
  type AnalysisRecord,
  MARKETS,
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
 * Three rules govern everything here:
 *
 *  1. Never invent a level. If the prompt does not state an entry, the field
 *     stays undefined and the gap is named in `missing` so the admin can fix
 *     the prompt instead of shipping a fabricated price to members.
 *  2. Read structure, not wording. Labelled blocks ("SL:", "Grade:") and
 *     section headings are found by their label, and a prose fallback covers
 *     the conversational style — the same analysis can arrive as a tidy
 *     checklist or as a paragraph of reasoning, and both must publish.
 *  3. Markdown is decoration. Headings, list markers, emphasis and emoji are
 *     stripped before parsing so "**SL:**" reads exactly like "SL:".
 */

/* ------------------------------------------------------------------ */
/* Normalisation                                                       */
/* ------------------------------------------------------------------ */

/**
 * Strip the copy-paste furniture: list markers, heading hashes, emphasis,
 * emoji and rule lines, then collapse whitespace. The words and the numbers
 * are left exactly as the analyst wrote them.
 */
function normalize(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/[\u200B]|[\u200D]|[\uFE0F]/g, "")
    .replace(/^[ \t]*(?:[-*+]\s+|\d+[.)]\s+|>+\s*)/gm, "")
    .replace(/^[ \t]*#{1,6}[ \t]*/gm, "")
    .replace(/^[ \t]*(?:[-*_][ \t]*){3,}$/gm, "")
    .replace(/[*_`~]/g, "")
    .replace(/[^\S\n]+/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n");
}

/** Flattened sentences — prose fallbacks read the prompt, not its layout. */
function sentences(text: string): string[] {
  return text
    .split(/\n+/)
    .flatMap((line) => line.split(/(?<=[.!?])\s+(?=[A-Z0-9])/))
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

/* ------------------------------------------------------------------ */
/* Price scanning                                                      */
/* ------------------------------------------------------------------ */

type PriceToken = { value: number; start: number; end: number };

/**
 * Every price-like number in a block, keeping offsets so the text *between*
 * two candidates can be inspected — that gap is what separates a real zone
 * ("84,000 - 84,100") from two unrelated levels.
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
 * Entry handling: a range when the text gives one, a flat level otherwise.
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

/** A single level — the first price the text states. */
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
    const found = new RegExp(
      `TP\\s*${n}[^\\d]{0,12}(\\d[\\d,]*(?:\\.\\d+)?)`,
      "i",
    ).exec(block);
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

/**
 * "Risk/Reward", "Stop Loss" and "H4 Bias" all collapse to one key, and a
 * qualifier in brackets is dropped: "Entry (Ideal Zone)" is just an entry.
 */
function normalizeLabel(label: string): string {
  return label
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Split the prompt into labelled blocks. A "Label:" line opens a block and
 * every following non-label line belongs to it, so multi-line values such as
 * the Entry paragraph survive intact.
 *
 * A block closes at the next heading, the next label, or the first blank line
 * *after it has content* — which is what stops a value from running on into
 * the next section, and stops "Grade:" from swallowing the CONFIDENCE
 * paragraph that follows it on its own line.
 */
function labelBlocks(text: string): LabelBlock[] {
  const blocks: { key: string; start: number; parts: string[] }[] = [];
  let active: { key: string; start: number; parts: string[] } | null = null;
  let offset = 0;

  const filled = () => (active ? active.parts.join("\n").trim().length > 0 : false);

  for (const line of text.split("\n")) {
    const lineStart = offset;
    offset += line.length + 1;

    const trimmed = line.trim();

    if (!trimmed) {
      if (filled()) active = null;
      continue;
    }
    if (isHeading(trimmed)) {
      // A heading that *names* the call or the bias opens that section, so
      // "TRADE DECISION" over a bare "BUY" still resolves. Every other
      // heading just closes whatever block was open.
      const key = normalizeLabel(trimmed);
      active =
        DECISION_LABELS.includes(key) || BIAS_LABELS.includes(key)
          ? { key, start: lineStart, parts: [] }
          : null;
      if (active) blocks.push(active);
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

/**
 * Aliases are ordered by specificity, and the first alias that matches
 * anywhere wins: "Final Verdict:" is the verdict even when a "THE DECISION:"
 * heading sits above it.
 */
function pickLabel(
  blocks: LabelBlock[],
  aliases: string[],
  after = -1,
): LabelBlock | undefined {
  for (const alias of aliases) {
    const hit = blocks.find((block) => block.start >= after && block.key === alias);
    if (hit) return hit;
  }
  return undefined;
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

const BIAS_LABELS = ["h4bias", "bias", "htfbias", "h1bias", "trendbias", "biasdirection"];
const DECISION_LABELS = [
  "finalverdict",
  "verdict",
  "tradedecision",
  "thedecision",
  "decision",
  "tradedirection",
  "direction",
  "recommendation",
  "outlook",
  "signal",
  "sentiment",
  "setup",
  "plan",
  "conclusion",
  "action",
  "call",
];
const ENTRY_LABELS = [
  "entry",
  "entryzone",
  "entryarea",
  "entryprice",
  "entrylevel",
  "entrylevels",
  "entrycondition",
  "entrytrigger",
  "entryidealzone",
];
const SL_LABELS = ["sl", "stoploss", "stoplosslevel", "sl1"];
const TP_LABELS = ["tp", "tp1", "tp2", "tp3", "targets", "target", "takeprofit"];
const RR_LABELS = ["riskreward", "rr", "riskrewardratio"];
const GRADE_LABELS = ["grade", "confidencegrade", "confidence", "rating"];
const REASON_LABELS = ["reason", "rationale", "reasoning"];
const SNIPER_LABELS = ["sniperinstruction", "sniper", "trigger", "instruction"];

/** Body of an ALL-CAPS section, e.g. the line under "SNIPER INSTRUCTION". */
function sectionBody(text: string, heading: string): string | undefined {
  const lines = text.split("\n");
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
  EURUSD: ["eurusd", "eur/usd"],
  US100: ["us100", "nas100", "us tech 100", "us 100", "ndx", "nasdaq"],
  BTCUSD: ["btcusd", "btc/usd", "bitcoin"],
  XAGUSD: ["xagusd", "silver"],
  GBPUSD: ["gbpusd", "gbp/usd"],
  AUDUSD: ["audusd", "aud/usd"],
  USDCAD: ["usdcad", "usd/cad"],
  EURJPY: ["eurjpy", "eur/jpy"],
  US30: ["us30", "dj30", "dow jones", "wall street 30"],
  SPX500: ["spx500", "spx", "s&p 500", "s&p500"],
};

/**
 * The opening line names the market; the body only mentions it in passing, so
 * the head of the prompt is searched first to avoid a prose false positive.
 */
function detectMarket(text: string): Market | undefined {
  const lower = text.toLowerCase();
  const scopes = [lower.slice(0, 200), lower];
  for (const scope of scopes) {
    for (const market of MARKETS) {
      const hit = MARKET_ALIASES[market].some((alias) =>
        new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\&]/g, "\\$&")}\\b`, "i").test(
          scope,
        ),
      );
      if (hit) return market;
    }
  }
  return undefined;
}

function directionFromBias(bias: string): SignalDirection | null {
  if (/\b(BULLISH|BUY|LONG)\b/.test(bias)) return "BUY";
  if (/\b(BEARISH|SELL|SHORT)\b/.test(bias)) return "SELL";
  return null;
}

const PREFERENCE_CUE =
  /\b(prefer|prefers|preference|leans?|leaning|looking for|favou?rs?|favou?red)\b/i;

/**
 * Which side the analyst actually wants. Prose prompts often have no bias
 * line, only sentences like "my preference leans towards a BUY setup".
 * The first stated preference wins — later mentions are usually framed as the
 * exception ("the only scenario where I would prefer a SELL").
 */
function preferredSide(text: string): SignalDirection | null {
  for (const sentence of sentences(text)) {
    if (!PREFERENCE_CUE.test(sentence)) continue;
    const side = directionFromBias(sentence.toUpperCase());
    if (side) return side;
  }
  return null;
}

/** "Do not short the middle" must not read as a short call. */
const NEGATED_SIDE =
  /\b(?:DO NOT|DON'T|DOESN'T|NEVER|NO|AVOID)\s+(?:SHORT|SELL|BUY|LONG|CHASE)\b/g;

/**
 * The decision drives the call; the timeframe bias, then the stated
 * preference, supplies the side. Decisions are read sentence by sentence, so
 * "wait for the low — do not short the middle" resolves to a wait on the long
 * side instead of picking up the negated clause. "WAIT (NO CHASE)" is a wait
 * *on a direction*, not a no-trade — the plan is still published, because
 * that is exactly what the member is waiting on.
 */
function detectCall(
  decision: string | undefined,
  bias: string | undefined,
  hint: SignalDirection | null,
): { call: TradeCall; direction: SignalDirection | "NO_TRADE" } {
  const biasText = (bias ?? "").toUpperCase();
  const side = directionFromBias(biasText) ?? hint;

  if (/\bNO[\s-]?TRADE\b/.test(biasText))
    return { call: "NO_TRADE", direction: "NO_TRADE" };

  for (const sentence of sentences(decision ?? "")) {
    const said = sentence.toUpperCase().replace(NEGATED_SIDE, " ");
    if (/\bNO[\s-]?TRADE\b/.test(said))
      return { call: "NO_TRADE", direction: "NO_TRADE" };
    if (/\b(ENTER|LONG|BUY)\b/.test(said)) return { call: "ENTER", direction: "BUY" };
    if (/\b(SELL|SHORT)\b/.test(said)) return { call: "ENTER", direction: "SELL" };
    if (/\b(WAIT|NO[\s-]?CHASE|HOLD|PATIENT|NO ENTRY|STAND[\s-]?ASIDE)\b/.test(said))
      return { call: "WAIT", direction: side ?? "NO_TRADE" };
  }

  if (side) return { call: "ENTER", direction: side };
  return { call: "NO_TRADE", direction: "NO_TRADE" };
}

function asConfidence(value: string): Confidence | undefined {
  const grade = value.toUpperCase() as Confidence;
  return CONFIDENCE_ORDER.includes(grade) ? grade : undefined;
}

/**
 * Grades arrive as "Grade: B", "Grade:\nB" or "Confidence Grade — A+". The
 * labelled block wins, and anything else must have the grade directly beside
 * the word that introduces it, so neither "confidence is a strong..." nor
 * "the confidence will upgrade to A-" is mistaken for a grade.
 */
function detectConfidence(
  blocks: LabelBlock[],
  text: string,
): Confidence | undefined {
  const grade = pickLabel(blocks, GRADE_LABELS);
  if (grade) {
    // Leading grade of the labelled block, so a trailing note such as
    // "B (Currently WAIT)" still grades B rather than being discarded.
    // The lookahead, rather than \b, is what lets a bare "A+" through: \b can
    // never match after a "+".
    const bare = /^\**\s*([ABC][+-]?)(?![A-Za-z0-9])/i.exec(grade.text.trim());
    if (bare) {
      const value = asConfidence(bare[1]);
      if (value) return value;
    }
  }

  // The grade must sit right next to the word that introduces it. A wider
  // window reads "the confidence will upgrade to A-" as the grade, which is a
  // projection about a future setup, not a grade of this one.
  const near =
    /(?:grade|rating|confidence)\s*(?:is|of|at|:\s*|=\s*|-)\s*\**\s*([ABC][+-]?)(?![A-Za-z0-9])/i.exec(
      text,
    );
  return near ? asConfidence(near[1]) : undefined;
}

/* ------------------------------------------------------------------ */
/* Prose fallbacks                                                     */
/* ------------------------------------------------------------------ */

/**
 * Sentences that argue *against* a level rather than proposing it. Skipped so
 * a rejection argument ("why shorting at 85,000 fails") never becomes an
 * entry, and "entering now is too late" never becomes one either.
 */
const CONTRAST =
  /\b(only scenario|instead of|rather than|why the|lower confidence|counter-?trend|too late|not yet|no entry|shorting at|selling at|favou?red against)\b/i;

const ENTRY_CUE =
  /\b(entry|entries|enter|enter at|buying at|buy at|setup at|buy setup|long setup|range low|drop into|pullback to|limit order|adding at|add at)\b/i;

const SL_CUE = /\b(sl|stop ?loss)\b/i;
const TP_CUE = /\b(tp|tp1|tp2|take ?profit|targets?)\b/i;

/** First sentence that proposes a level, used when no label states one. */
function proseLevel(text: string, cue: RegExp): number | undefined {
  for (const sentence of sentences(text)) {
    if (CONTRAST.test(sentence) || !cue.test(sentence)) continue;
    return priceTokens(sentence)[0]?.value;
  }
  return undefined;
}

/** Entry from prose: the first sentence that talks about entering, not about
 *  rejecting a level. "a BUY setup at the range low (84,000 - 84,100)" wins. */
function proseEntry(text: string): { entryMin?: number; entryMax?: number } {
  for (const sentence of sentences(text)) {
    if (CONTRAST.test(sentence) || !ENTRY_CUE.test(sentence)) continue;
    const zone = parseEntryZone(sentence);
    if (zone.entryMin != null) return zone;
  }
  return {};
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
  const text = normalize(raw);
  const blocks = labelBlocks(text);

  const bias = pickLabel(blocks, BIAS_LABELS);
  const decision = pickLabel(blocks, DECISION_LABELS)?.text;
  const grade = pickLabel(blocks, GRADE_LABELS);

  const market = detectMarket(text);
  const { call, direction } = detectCall(
    decision,
    firstLine(bias),
    preferredSide(text),
  );
  const confidence = detectConfidence(blocks, text);

  const entryBlock = pickLabel(blocks, ENTRY_LABELS)?.text;
  const slBlock = pickLabel(blocks, SL_LABELS)?.text;
  const tpBlock = joinLabels(blocks, TP_LABELS);

  const entry = entryBlock ? parseEntryZone(entryBlock) : proseEntry(text);
  const sl = slBlock ? parseLevel(slBlock) : proseLevel(text, SL_CUE);
  const { tp1, tp2 } = tpBlock ? parseTargets(tpBlock) : { tp1: proseLevel(text, TP_CUE) };

  const missing: string[] = [];
  if (!market) missing.push("pair");
  if (entry.entryMin == null) missing.push("entry");
  if (sl == null) missing.push("sl");
  if (tp1 == null) missing.push("tp");
  if (confidence == null) missing.push("confidence");

  return {
    pair: market ?? "XAUUSD",
    call,
    direction,
    confidence,
    entryMin: entry.entryMin,
    entryMax: entry.entryMax,
    sl,
    tp1,
    tp2,
    // The decision is stored as its opening sentence — that is the call, and
    // the trailing reasoning behind it is not what a badge should show.
    decision: sentences(decision ?? "")[0],
    riskReward: firstLine(pickLabel(blocks, RR_LABELS)),
    sniper:
      firstLine(pickLabel(blocks, SNIPER_LABELS)) ??
      sectionBody(text, "SNIPER INSTRUCTION"),
    invalidation:
      firstLine(pickLabel(blocks, ["invalidation", "invalidatedif"])) ??
      sectionBody(text, "INVALIDATION"),
    reason: firstLine(pickLabel(blocks, REASON_LABELS, grade?.start ?? -1)),
    missing,
  };
}

/**
 * The analyst's own decision line, when they wrote one. It is their wording,
 * not ours, so it is never translated; the UI supplies its own label for the
 * fallback (see `callText` in the admin card).
 */
export function decisionLabel(record: AnalysisRecord): string | undefined {
  const said = record.decision?.split("\n")[0]?.trim().toUpperCase();
  return said ? said.slice(0, 48) : undefined;
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
  const parts = [decisionLabel(record)];
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
