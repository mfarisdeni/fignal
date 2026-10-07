"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, QrCode } from "lucide-react";
import { authHeaders, useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/hooks/use-language";
import { Button } from "@/components/ui/button";

/**
 * QRIS checkout for the Rp10.000 membership.
 *
 * The price shown here is cosmetic. The amount charged is a server constant in
 * lib/payments/klikqris.ts, so editing this component changes nothing about what
 * the member is billed - it would only make the screen lie.
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
  qrisImage: string | null;
  qrisUrl: string | null;
  expiredAt: string | null;
};

export function PaymentPanel() {
  const { refreshClaims } = useAuth();
  const { t } = useLanguage();
  const [order, setOrder] = useState<Order | null>(null);
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

      {error && (
        <p role="alert" className="mt-4 text-center text-xs text-destructive">
          {error}
        </p>
      )}

      {!order ? (
        <Button
          onClick={() => void start()}
          disabled={starting}
          className="mt-5 w-full rounded-full"
        >
          {starting ? (
            <>
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              {t("pay.preparing")}
            </>
          ) : (
            <>
              <QrCode className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              {t("pay.pay")} {rupiah.format(PRICE)} {t("pay.withQris")}
            </>
          )}
        </Button>
      ) : (
        <div className="mt-5 text-center">
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
