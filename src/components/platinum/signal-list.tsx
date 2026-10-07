import { NoTradeState } from "./no-trade-state";
import { SignalCard } from "./signal-card";
import { useLanguage } from "@/hooks/use-language";
import type { StatusFilter } from "@/lib/signals";
import type { Market, TradingSignal } from "@/types/signal";

/**
 * Reusable signal list. Receives pre-filtered signals, renders every setup as
 * the same card (no featured variant), shows NO_TRADE records as calm
 * empty-state cards, and resolves every empty combination with a thoughtful
 * state.
 */
export function SignalList({
  signals,
  noTrade,
  market,
  status,
}: {
  signals: TradingSignal[];
  noTrade: TradingSignal[];
  market: Market | "ALL";
  status: StatusFilter;
}) {
  const { t } = useLanguage();
  const nothing = signals.length === 0 && noTrade.length === 0;

  if (nothing) {
    if (status === "ACTIVE") {
      return <NoTradeState note={t("empty.noActive")} />;
    }
    if (status === "COMPLETED") {
      return <NoTradeState note={t("empty.noCompleted")} />;
    }
    if (market === "BTCUSD") {
      return <NoTradeState pair="BTCUSD" note={t("empty.noBtc")} />;
    }
    if (market !== "ALL") {
      return <NoTradeState pair={market} note={t("empty.waiting")} />;
    }
    return <NoTradeState note={t("empty.noPublished")} />;
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* One card per row on mobile, two per row on desktop. */}
      {signals.length > 0 && (
        <div className="grid grid-cols-1 items-start gap-3 sm:gap-4 lg:grid-cols-2">
          {signals.map((s, i) => (
            <SignalCard key={s.id} signal={s} index={i} />
          ))}
        </div>
      )}

      {noTrade.map((s) => (
        <NoTradeState key={s.id} pair={s.pair} note={s.note} compact />
      ))}
    </div>
  );
}
