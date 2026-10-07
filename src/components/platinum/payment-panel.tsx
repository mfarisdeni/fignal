"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, QrCode } from "lucide-react";
import { authHeaders, useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/hooks/use-language";
import { Button } from "@/components/ui/button";

/**
 * QRIS checkout for the Rp10.000 membership.
 *
 * The base price above the button is cosmetic; the billed total is a server
 * constant in lib/payments/klikqris.ts. But once an order exists, the total
 * shown comes from the server's order response (base + provider unique code),
 * so the screen always shows the exact amount the QRIS actually bills. An
 * explicit confirm step sits between the price and order creation so stray
 * taps don't mint pending QRIS orders.
 *
 * Polling is a convenience, never the authority. /api/payments/status only
 * reports what Firestore holds, and only the webhook writes PAID, so a member
 * cannot unlock themselves by polling - or by editing this file.
 */

const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const PRICE = 10_000;
const LIST_PRICE = 20_000;

type Order = {
  orderId: string;
  total: number;
  qrisImage: string | null;
  qrisUrl: string | null;
  expiredAt: string | null;
};

export function PaymentPanel() {
  const { refreshClaims } = useAuth();
  const { t } = useLanguage();
  const [order, setOrder] = useState<Order | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);
  const [paid, setPaid] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const start = useCallback(async () => {
    setStarting(true);
    setError("");
    try {
      const response = await fetch("/api/payments/create", {
        method: "POST",
        headers: { "content-type": "application/json", ...(await authHeaders()) },
      });
      const payload = (await response.json().catch(() => null)) as
        | (Order & { error?: never })
        | { error: string }
        | null;

      if (!response.ok || !payload || "error" in payload) {
        throw new Error(
          payload && "error" in payload ? payload.error : t("pay.startFail"),
        );
      }
      setOrder(payload);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("pay.startFail"));
    } finally {
      setStarting(false);
    }
  }, [t]);

  /**
   * Poll until the webhook marks the order paid, then pull fresh claims so the
   * membership claim lands in the current session without a re-login.
   */
  useEffect(() => {
    if (!order?.orderId || paid) return;

    let cancelled = false;

    const check = async () => {
      try {
        const response = await fetch(
          `/api/payments/status?orderId=${encodeURIComponent(order.orderId)}`,
          { headers: await authHeaders(), cache: "no-store" },
        );
        if (!response.ok) return;
        const payload = (await response.json()) as { paid?: boolean };
        if (payload.paid && !cancelled) {
          setPaid(true);
          await refreshClaims();
        }
      } catch {
        /* transient network error; the next tick retries */
      }
    };

    // Poll for two minutes - a QRIS scan and confirm usually lands well inside
    // that, and an abandoned tab should stop making requests.
    const started = Date.now();
    const tick = async () => {
      if (cancelled) return;
      await check();
      if (cancelled || Date.now() - started > 120_000) return;
      timer.current = setTimeout(tick, 4000);
    };

    void tick();

    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [order?.orderId, paid, refreshClaims]);

  if (paid) {
    return (
      <div className="mt-6 rounded-xl border border-border bg-card p-5 text-center">
        <CheckCircle2 className="mx-auto h-7 w-7 text-buy" aria-hidden="true" />
        <p className="mt-3 text-sm font-semibold">{t("pay.received")}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {t("pay.receivedSub")}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-xl border border-border bg-card p-5">
      <div className="flex items-baseline justify-center gap-2">
        <span className="text-sm text-muted-foreground line-through tnum">
          {rupiah.format(LIST_PRICE)}
        </span>
        <span className="text-xl font-semibold tnum">{rupiah.format(PRICE)}</span>
      </div>
      <p className="mt-1 text-center text-[11px] font-medium text-buy">
        {t("pay.promo")}
      </p>
      {!order && (
        <p className="mx-auto mt-2 max-w-[26ch] text-center text-[11px] leading-relaxed text-muted-foreground">
          {t("pay.uniqueIntro")}
        </p>
      )}

      {error && (
        <p role="alert" className="mt-4 text-center text-xs text-destructive">
          {error}
        </p>
      )}

      {!order && !confirming ? (
        <Button onClick={() => setConfirming(true)} className="mt-5 w-full rounded-full">
          <QrCode className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
          {t("pay.continue")}
        </Button>
      ) : !order ? (
        <div className="mt-5">
          <div className="rounded-lg bg-muted/50 p-4">
            <p className="text-sm font-semibold">{t("pay.confirmTitle")}</p>
            <div className="mt-2 flex items-baseline justify-between gap-2 text-sm">
              <span className="text-muted-foreground">Fignal Platinum</span>
              <span className="font-semibold tnum">{rupiah.format(PRICE)}</span>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              {t("pay.uniqueNote")}
            </p>
          </div>
          <Button
            onClick={() => void start()}
            disabled={starting}
            className="mt-4 w-full rounded-full"
          >
            {starting ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                {t("pay.preparing")}
              </>
            ) : (
              t("pay.proceed")
            )}
          </Button>
          <Button
            variant="ghost"
            onClick={() => setConfirming(false)}
            disabled={starting}
            className="mt-1 w-full rounded-full"
          >
            {t("pay.back")}
          </Button>
        </div>
      ) : (
        <div className="mt-5 text-center">
          <p className="text-[28px] font-bold leading-none tnum">{rupiah.format(order.total)}</p>
          <p className="mt-1.5 text-xs font-semibold">{t("pay.exactAmount")}</p>
          <p className="mx-auto mb-4 mt-1 max-w-[32ch] text-[11px] leading-relaxed text-muted-foreground">
            {t("pay.uniqueNote")}
          </p>
          {order.qrisImage ? (
            // Hosted by KlikQris, not us.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={order.qrisImage}
              alt="QRIS payment code"
              className="mx-auto h-52 w-52 rounded-lg border border-border bg-white p-2"
            />
          ) : (
            order.qrisUrl && (
              <a
                href={order.qrisUrl}
                className="text-sm font-medium underline underline-offset-4"
              >
                {t("pay.openCode")}
              </a>
            )
          )}

          <p className="mt-3 text-xs text-muted-foreground">
            {t("pay.scanNote")}
          </p>
          <p className="mt-1 font-mono-num text-[11px] text-muted-foreground tnum">
            {order.orderId}
          </p>
        </div>
      )}
    </div>
  );
}
