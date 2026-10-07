import { useMemo, useState } from "react";
import { Languages, TriangleAlert, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfidenceBadge } from "@/components/platinum/confidence-badge";
import { DirectionBadge } from "@/components/platinum/direction-badge";
import { PriceMetric } from "@/components/platinum/price-metric";
import { SignalStatusBadge } from "@/components/platinum/signal-status-badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLanguage } from "@/hooks/use-language";
import { analysisToSignal, decisionLabel } from "@/lib/analysis";
import type { MessageKey } from "@/lib/i18n";
import {
  formatDateShort,
  formatEntry,
  formatPrice,
  formatTimeWIB,
} from "@/lib/signals";
import {
  SIGNAL_STATUSES,
  type AnalysisRecord,
  type SignalStatus,
  type TradeCall,
} from "@/types/signal";

/** Parser gaps are named in the admin's language, not the parser's. */
const MISSING_KEY: Record<string, MessageKey> = {
  pair: "admin.missingPair",
  entry: "admin.missingEntry",
  sl: "admin.missingSl",
  tp: "admin.missingTp",
  confidence: "admin.missingConfidence",
};

/** The parser's classification, when the prompt carried no decision line. */
const CALL_KEY: Record<TradeCall, MessageKey> = {
  ENTER: "call.enter",
  WAIT: "call.wait",
  NO_TRADE: "call.noTrade",
};

/** The analyst's own words when they wrote a decision, else our own label. */
function callText(record: AnalysisRecord, t: (key: MessageKey) => string): string {
  return decisionLabel(record) ?? t(CALL_KEY[record.call]);
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 text-[13px] leading-relaxed">{value}</div>
    </div>
  );
}

/**
 * One submitted prompt, shown as the summary that was lifted out of it.
 *
 * The raw prompt stays collapsed underneath: the numbers above are what the
 * member will see, and the text below is the evidence for them.
 */
export function AnalysisRecordCard({
  record,
  index = 0,
  onStatusChange,
  onRemove,
  onTranslate,
}: {
  record: AnalysisRecord;
  index?: number;
  onStatusChange: (id: string, status: SignalStatus) => void;
  onRemove: (id: string) => void;
  onTranslate: (id: string) => Promise<void>;
}) {
  const { language, t } = useLanguage();
  const [translating, setTranslating] = useState(false);

  async function handleTranslate() {
    if (translating) return;
    setTranslating(true);
    try {
      await onTranslate(record.id);
      toast.success(t("admin.translateDone"));
    } catch {
      toast.error(t("admin.translateFail"));
    } finally {
      setTranslating(false);
    }
  }
  const signal = useMemo(() => analysisToSignal(record), [record]);
  const side =
    record.direction === "BUY" || record.direction === "SELL"
      ? record.direction
      : null;

const missing = record.missing
    .map((field) => t(MISSING_KEY[field] ?? "admin.missingPair"))
    .join(", ");

  return (
    <article
      aria-label={t("admin.ariaRecord", {
        pair: record.pair,
        call: callText(record, t),
        confidence: record.confidence ?? t("history.ungraded"),
      })}
      className="animate-enter rounded-lg border border-border bg-card p-4 shadow-card sm:p-5"
      style={{ animationDelay: `${Math.min(index, 6) * 60}ms` }}
    >
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
        {record.confidence ? (
          <ConfidenceBadge confidence={record.confidence} />
        ) : (
          <span className="inline-flex h-6 items-center rounded-md border border-border px-2 text-[11px] font-medium text-muted-foreground">
            {t("history.ungraded")}
          </span>
        )}
        <h3 className="text-[15px] font-semibold tracking-tight">{record.pair}</h3>
        <DirectionBadge direction={side ?? "NO_TRADE"} />
        <span
          className={`rounded-md border px-2 py-1 text-[11px] font-semibold uppercase tracking-wide ${
            record.call === "ENTER"
              ? "border-buy/30 bg-buy/10 text-buy"
              : record.call === "WAIT"
                ? "border-upcoming/30 bg-upcoming/10 text-upcoming"
                : "border-border bg-muted/60 text-muted-foreground"
          }`}
        >
          {callText(record, t)}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <SignalStatusBadge status={record.status} />
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onRemove(record.id)}
            aria-label={t("admin.ariaDelete", { pair: record.pair })}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </div>
      </div>

      {record.missing.length > 0 && (
        <p
          role="status"
          className="mt-3 flex items-start gap-2 rounded-md border border-upcoming/30 bg-upcoming/10 px-3 py-2 text-xs leading-relaxed text-upcoming"
        >
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {t("admin.missing", { fields: missing })}
        </p>
      )}

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        <PriceMetric
          label={t("card.entry")}
          value={formatEntry(signal)}
          emphasis="strong"
          className={
            side === "BUY"
              ? "border-l-2 border-buy/40 pl-2.5"
              : "border-l-2 border-sell/40 pl-2.5"
          }
        />
        <PriceMetric
          label={t("card.stopLoss")}
          value={record.sl != null ? formatPrice(record.sl, record.pair) : "—"}
          tone="sell"
        />
        <PriceMetric
          label="TP1"
          value={record.tp1 != null ? formatPrice(record.tp1, record.pair) : "—"}
          tone="buy"
          emphasis="strong"
        />
        <PriceMetric
          label="TP2"
          value={record.tp2 != null ? formatPrice(record.tp2, record.pair) : "—"}
        />
      </dl>

      {(record.riskReward ||
        record.sniper ||
        record.invalidation ||
        record.reason) && (
        <dl className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
          {record.riskReward && (
            <Detail label={t("admin.riskReward")} value={record.riskReward} />
          )}
          {record.sniper && <Detail label={t("admin.sniper")} value={record.sniper} />}
          {record.invalidation && (
            <Detail label={t("admin.invalidation")} value={record.invalidation} />
          )}
          {record.reason && (
            <div className="min-w-0 sm:col-span-2">
              <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                {t("admin.reason")}
              </div>
              <div className="mt-0.5 text-[13px] leading-relaxed">{record.reason}</div>
            </div>
          )}
        </dl>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-4">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          {t("admin.statusLabel")}
          <Select
            value={record.status}
            onValueChange={(value) =>
              onStatusChange(record.id, value as SignalStatus)
            }
          >
            <SelectTrigger
              size="sm"
              className="h-8 w-40 rounded-full text-xs"
              aria-label={t("admin.statusAria", { pair: record.pair })}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SIGNAL_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {t(`status.${status}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => void handleTranslate()}
          disabled={translating}
          className="ml-auto h-7 rounded-full px-2.5 text-xs text-muted-foreground"
        >
          <Languages className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
          {translating ? "…" : t("admin.translate")}
        </Button>
        <span className="text-xs text-muted-foreground tnum">
          {formatDateShort(record.submittedAt, language)} · {formatTimeWIB(record.submittedAt, language)}
        </span>
      </div>

      <details className="group mt-3 border-t border-border pt-3">
        <summary className="cursor-pointer text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
          {t("admin.rawPrompt", { n: record.raw.length })}
        </summary>
        <pre className="scroll-thin mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted/50 p-3 font-mono-num text-[11.5px] leading-relaxed text-muted-foreground">
          {record.raw}
        </pre>
      </details>
    </article>
  );
}
