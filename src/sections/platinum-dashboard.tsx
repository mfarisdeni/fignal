import { useMemo, useState } from "react";
import { TopNav, type DashboardView } from "@/components/layout/top-nav";
import { AuthGate } from "@/components/platinum/auth-gate";
import { ConfidenceLegend } from "@/components/platinum/confidence-legend";
import { MarketSummary } from "@/components/platinum/market-summary";
import { PlatinumHeader } from "@/components/platinum/platinum-header";
import { RecentHistory } from "@/components/platinum/recent-history";
import { RiskNotice } from "@/components/platinum/risk-notice";
import { SignalFilters } from "@/components/platinum/signal-filters";
import { SignalList } from "@/components/platinum/signal-list";
import { DashboardSkeleton } from "@/components/platinum/skeletons";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/hooks/use-language";
import { useSignals } from "@/hooks/use-signals";
import {
  availableMarkets,
  filterSignals,
  resolveMarketFilter,
  splitFeatured,
  summarizeDay,
  summarizePerformance,
  type StatusFilter,
} from "@/lib/signals";
import type { Market } from "@/types/signal";

/**
 * Fignal Platinum dashboard — /platinum
 *
 * The page consumes structured signal objects only. It knows nothing about
 * where signals come from (the admin desk today, Supabase tomorrow).
 */
export function PlatinumDashboard() {
  // hasAccess, not isAuthenticated. Signing up creates an account; it does not buy
  // access. Only a paid membership (or the desk itself) opens this route - the
  // gate below also serves the checkout for accounts that have not paid yet.
  const { hasAccess } = useAuth();
  const { signals, history, loading, updatedAt } = useSignals();
  const { t } = useLanguage();

  const [view, setView] = useState<DashboardView>("signals");
  const [market, setMarket] = useState<Market | "ALL">("ALL");
  const [status, setStatus] = useState<StatusFilter>("ALL");

const summary = useMemo(() => summarizeDay(signals), [signals]);

  const performance = useMemo(() => summarizePerformance(signals), [signals]);

/* Only pairs the feed actually holds get a pill. */
  const markets = useMemo(() => availableMarkets(signals), [signals]);

  /* A remembered selection can outlive its market, so the filter that gets
     applied is resolved, not assumed. */
  const activeMarket = resolveMarketFilter(markets, market);

  const { featured, rest, noTrade } = useMemo(() => {
    const filtered = filterSignals(signals, activeMarket, status);
    const { featured, rest } = splitFeatured(filtered);
    return {
      featured,
      rest,
      noTrade: filtered.filter((s) => s.status === "NO_TRADE"),
    };
  }, [signals, activeMarket, status]);

  if (!hasAccess) return <AuthGate />;

  return (
    <div className="min-h-screen bg-background">
      <TopNav view={view} onViewChange={setView} />

      <main className="mx-auto max-w-[1280px] px-4 pb-16 pt-6 sm:px-6 sm:pt-8">
        <PlatinumHeader updatedAt={updatedAt} activeCount={summary.active} />

        <div className="mt-5">
          <ConfidenceLegend />
        </div>

        {loading ? (
          <div className="mt-6">
            <DashboardSkeleton />
          </div>
        ) : view === "signals" ? (
          <div className="mt-6 space-y-6">
            <MarketSummary summary={summary} performance={performance} />

            {/* Sticky filter bar on mobile for thumb reach */}
            <div className="sticky top-14 z-20 -mx-4 bg-background/90 px-0 py-2 backdrop-blur-md sm:static sm:mx-0 sm:bg-transparent sm:py-0 sm:backdrop-blur-none">
<SignalFilters
                markets={markets}
                market={activeMarket}
                status={status}
                onMarketChange={setMarket}
                onStatusChange={setStatus}
              />
            </div>

            <SignalList
              featured={featured}
              rest={rest}
noTrade={noTrade}
              market={activeMarket}
              status={status}
            />

            <section aria-label={t("history.title")}>
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="text-sm font-semibold tracking-tight">
                  {t("history.title")}
                </h2>
                <button
                  type="button"
                  onClick={() => setView("history")}
                  className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  {t("history.viewAll")}
                </button>
              </div>
              <RecentHistory history={history} limit={3} />
            </section>

            <RiskNotice />
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            <MarketSummary summary={summary} performance={performance} />

            <section aria-label={t("history.title")}>
              <h2 className="mb-3 text-sm font-semibold tracking-tight">
                {t("history.title")}
              </h2>
              <RecentHistory history={history} />
            </section>
            <RiskNotice />
          </div>
        )}
      </main>
    </div>
  );
}
