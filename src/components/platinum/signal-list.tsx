import { NoTradeState } from "./no-trade-state";
import { SignalCard } from "./signal-card";
import { SignalFeaturedCard } from "./signal-featured-card";
import type { StatusFilter } from "@/lib/signals";
import type { Market, TradingSignal } from "@/types/signal";

/**
 * Reusable signal list. Receives pre-filtered signals, keeps the featured
 * card on top, renders NO_TRADE records as calm empty-state cards, and
 * resolves every empty combination with a thoughtful state.
 */
export function SignalList({
  featured,
  rest,
  noTrade,
  market,
  status,
}: {
  featured: TradingSignal | null;
  rest: TradingSignal[];
  noTrade: TradingSignal[];
  market: Market | "ALL";
  status: StatusFilter;
}) {
  const nothing = !featured && rest.length === 0 && noTrade.length === 0;

  if (nothing) {
    if (status === "ACTIVE") {
      return (
        <NoTradeState
          note="No active signals right now. New setups are published as the structure develops."
        />
      );
    }
    if (status === "COMPLETED") {
      return (
        <NoTradeState note="No completed signals yet today. Results appear here as targets or stops are reached." />
      );
    }
    if (market === "BTCUSD") {
      return (
        <NoTradeState
          pair="BTCUSD"
          note="No weekend setup published yet. BTC signals are released Saturday morning WIB."
        />
      );
    }
    if (market !== "ALL") {
      return (
        <NoTradeState
          pair={market}
          note="Fignal is waiting for a clearer market structure."
        />
      );
    }
    return (
      <NoTradeState note="No signals published yet today. Setups appear here as they are released." />
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      {featured && <SignalFeaturedCard signal={featured} />}
      {rest.map((s, i) => (
        <SignalCard key={s.id} signal={s} index={i + 1} />
      ))}
      {noTrade.map((s) => (
        <NoTradeState
          key={s.id}
          pair={s.pair}
          note={s.note}
          compact
        />
      ))}
    </div>
  );
}
