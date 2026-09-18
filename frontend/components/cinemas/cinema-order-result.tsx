"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Clock, Loader2, Popcorn, XCircle } from "lucide-react";
import {
  cancelCinemaCheckout,
  fetchCinemaOrder,
  verifyPaymentStatus,
} from "@/lib/cinema-api";
import TicketPassCard from "@/components/tickets/ticket-pass-card";
import {
  buildCinemaOrderPassFields,
  cinemaPassPosterUrl,
  cinemaPassTitle,
  cinemaPassWatermark,
} from "@/lib/cinemaTicketPass";
import { cinemaOrderQrUrl, downloadCinemaOrderQr } from "@/lib/cinemaTicketQr";
import { toast } from "sonner";

/**
 * What one paid order produced — the tickets, their QR codes, and the snacks.
 *
 * Keyed by TRANSACTION rather than by ticket, because an order can be several
 * seats and a customer coming back from a payment redirect knows only the
 * transaction they started.
 *
 * Polls while the payment is still pending. Settlement runs from the provider's
 * webhook, which lands whenever the provider decides — the customer may still
 * be looking at this exact view by then, so it waits for the tickets rather
 * than assume they exist. The poll stops as soon as they do.
 *
 * Shared by the standalone `/cinema/order/[transactionId]` page (a payment
 * redirect return, or the bookmark link from "my tickets") and by
 * booking-flow.tsx's direct-charge step, which renders this inline instead of
 * navigating away — see the `embedded` prop.
 */

type Order = Awaited<ReturnType<typeof fetchCinemaOrder>>;

const money = (n: number, currency = "ETB") =>
  `${n.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency}`;

export interface CinemaOrderResultProps {
  transactionId: string;
  /** Renders without the page-level container/max-width — the parent already
   * provides a scrollable sheet (booking-flow.tsx's direct-charge step). */
  embedded?: boolean;
  /** Called from every exit point (failed, or "Done" once settled). Falls
   * back to a plain link to /cinemas when absent — the standalone page has
   * nowhere else to send someone. */
  onExit?: () => void;
  /**
   * Fires once, the moment the order settles (tickets exist) — lets an
   * embedding dialog drop its own header/border/background at exactly that
   * point, so what's left on screen is only the ticket, the same way the
   * event checkout swaps into a bare, transparent dialog once its own
   * tickets are ready rather than keeping its normal chrome around them.
   */
  onSettledChange?: (settled: boolean) => void;
}

export default function CinemaOrderResult({
  transactionId,
  embedded = false,
  onExit,
  onSettledChange,
}: CinemaOrderResultProps) {
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [waited, setWaited] = useState(0);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await fetchCinemaOrder(transactionId);
      setOrder(data);
      return data;
    } catch (e) {
      setError((e as Error).message);
      return null;
    }
  }, [transactionId]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const tick = async () => {
      // ASK THE PROVIDER FIRST, then read the order.
      //
      // Settlement normally runs from the provider's webhook. But a webhook is
      // a promise, not a guarantee: it can be delayed, blocked by a firewall,
      // or — on a machine the provider cannot reach — never sent at all. A view
      // that only re-read our own database would then spin for five minutes and
      // give up on a payment the customer had already approved on their phone.
      //
      // This is the same endpoint the event checkout polls. It verifies with
      // Chapa or SantimPay and, on success, runs settlement itself, so the
      // tickets exist by the time the next line reads them. Failures are
      // ignored on purpose — it is a nudge, and the order read below is what
      // actually decides what the customer sees.
      await verifyPaymentStatus(transactionId).catch(() => {});

      const data = await load();
      if (cancelled) return;
      // Stop as soon as the tickets exist. Also stop after five minutes: past
      // that the payment has almost certainly failed, and polling for ever
      // would keep a dead tab hitting the API.
      // Stop on any terminal state. A declined or cancelled payment is never
      // going to produce a ticket, and leaving the view on "waiting for your
      // payment" tells the customer to keep waiting for something that has
      // already failed.
      const terminal = ["FAILED", "CANCELLED"].includes(data?.status || "");
      if (data?.tickets?.length || terminal || waited > 300) return;
      setWaited((w) => w + 4);
      timer = setTimeout(tick, 4000);
    };

    tick();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // `waited` deliberately not a dependency: including it would restart the
    // whole poll on every tick instead of continuing the existing one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  // Computed off `order` directly rather than the `settled` const below —
  // that one is declared after the early returns further down, and hooks
  // can't follow a conditional return.
  useEffect(() => {
    onSettledChange?.((order?.tickets.length ?? 0) > 0);
  }, [order, onSettledChange]);

  const wrap = (children: React.ReactNode) =>
    embedded ? (
      <div className="mx-auto max-w-xl">{children}</div>
    ) : (
      <div className="container mx-auto max-w-3xl px-4 py-10">{children}</div>
    );

  if (error) {
    return wrap(
      <div className="px-4 py-16 text-center">
        <p className="text-lg font-semibold">We couldn&apos;t find that order</p>
        <p className="mt-2 text-sm text-muted-foreground">{error}</p>
        {onExit ? (
          <Button className="mt-6" onClick={onExit}>
            Back to cinemas
          </Button>
        ) : (
          <Button asChild className="mt-6">
            <Link href="/cinemas">Browse cinemas</Link>
          </Button>
        )}
      </div>
    );
  }

  if (!order) {
    return wrap(
      <div className="flex items-center justify-center px-4 py-24 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading your order…
      </div>
    );
  }

  const settled = order.tickets.length > 0;
  const failed = !settled && ["FAILED", "CANCELLED"].includes(order.status);
  // Five minutes with no webhook and no verification result. The money may
  // still be in flight, so this deliberately does not claim the payment failed.
  const stalled = !settled && !failed && waited > 300;

  return wrap(
    <>
      {failed ? (
        <div className="mb-8 text-center">
          <XCircle className="mx-auto mb-3 h-12 w-12 text-red-500" />
          <h1 className="font-display text-2xl font-bold">
            {order.status === "CANCELLED" ? "Payment cancelled" : "Payment didn't go through"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            You have not been charged, and your seats have been released. Pick them
            again if you still want them.
          </p>
          {onExit ? (
            <Button className="mt-6" onClick={onExit}>
              Back to cinemas
            </Button>
          ) : (
            <Button asChild className="mt-6">
              <Link href="/cinemas">Back to cinemas</Link>
            </Button>
          )}
        </div>
      ) : stalled ? (
        <div className="mb-8 text-center">
          <Clock className="mx-auto mb-3 h-12 w-12 text-amber-500" />
          <h1 className="font-display text-2xl font-bold">Still waiting</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            We haven&apos;t heard back about this payment yet. If you approved it,
            keep this reference and refresh in a moment —{" "}
            <span className="font-mono text-xs">{order.transactionId}</span>
          </p>
          <div className="mt-6 flex flex-col items-center gap-2">
            <Button onClick={() => window.location.reload()}>Check again</Button>
            {/* The way out. Without it the only way to free the seats is to
                wait out the hold, and the customer has no idea that is what
                they are waiting for. */}
            <Button
              variant="ghost"
              size="sm"
              disabled={cancelling}
              onClick={async () => {
                setCancelling(true);
                try {
                  await cancelCinemaCheckout(transactionId);
                  await load();
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setCancelling(false);
                }
              }}
            >
              {cancelling ? "Releasing…" : "Cancel and release my seats"}
            </Button>
          </div>
        </div>
      ) : settled ? null : (
        <div className="mb-8 text-center">
          {/* Same spinner the event checkout shows while it verifies a
              payment — a still Clock icon reads as "pending," not "actively
              working," which is what this state actually is. */}
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-4 border-[#0D47A1] dark:border-yellow-400" />
          <h1 className="font-display text-2xl font-bold">Waiting for your payment</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Approve it on your phone if you haven&apos;t yet. This updates on its own —
            your seats are held until it completes.
          </p>
        </div>
      )}

      {/* Just the ticket — no box behind it at all, the same way the event
          checkout's own post-purchase dialog is `bg-transparent`: the
          ticket floats directly on the page, nothing framing it. */}
      {order.tickets.length > 0 && (
        <div className="mb-6 flex flex-col items-center gap-4">
          <TicketPassCard
            title={cinemaPassTitle(order.tickets[0])}
            watermark={cinemaPassWatermark(order.tickets[0])}
            backdropImageUrl={cinemaPassPosterUrl(order.tickets[0].movie?.poster)}
            fields={buildCinemaOrderPassFields(order.tickets, order.transactionId)}
            qrSrc={cinemaOrderQrUrl(order.transactionId)}
            qrAlt={`QR code for order ${order.transactionId}`}
            // Only right after paying (booking-flow embeds this with onExit
            // wired to closing the sheet) does the ticket greet like this —
            // the standalone /cinema/order/[id] page passes no onExit, so a
            // bookmark revisit or a hosted-checkout return just sees the
            // plain poster, matching how the event ticket page never says
            // "You're going!" outside its own post-purchase modal.
            bannerHeading={onExit ? "You're going to the movies!" : undefined}
            bannerSubheading={onExit ? "Your ticket is ready" : undefined}
            downloadFileName={`order-${order.transactionId}`}
            shareTitle={`${cinemaPassTitle(order.tickets[0])} — Tickets`}
            onCaptureFailed={() => {
              downloadCinemaOrderQr(
                order.transactionId,
                `order-${order.transactionId}.png`
              ).catch(() => toast.error("Could not download the QR code"));
            }}
            onDone={onExit}
            // Pre-bought snacks live ON the ticket, not in a second box below
            // it — this only ever renders once `settled`, since concessions
            // still show up on the order record even when the payment
            // failed and nothing was actually bought.
            belowQr={
              order.concessions.length > 0 ? (
                <div className="w-full text-white/80">
                  <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.15em] text-white/50">
                    <Popcorn className="h-3.5 w-3.5" />
                    Collect at the counter
                  </p>
                  <div className="space-y-1 text-sm">
                    {order.concessions.map((item) => (
                      <div key={item.cinemaBeverage} className="flex justify-between">
                        <span>
                          {item.name} <span className="text-white/50">× {item.quantity}</span>
                        </span>
                        <span className="tabular-nums">
                          {money(item.lineTotal, order.currency)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : undefined
            }
          />

          {/* Each ticket's own code, for anyone in the group arriving
              separately — the order QR above admits everything at once, so a
              subset of the group can peel off with just their own ticket's
              code instead. One ticket covers every seat in its price
              category, so its link lists all of them, not just one. */}
          {order.tickets.length > 1 && (
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {order.tickets.map((ticket) => (
                <Link
                  key={ticket._id}
                  href={`/ticket/${ticket.ticketId}`}
                  className="underline underline-offset-2"
                >
                  {ticket.seats?.length
                    ? `Seat${ticket.seats.length > 1 ? "s" : ""} ${ticket.seats.map((s) => `${s.row}${s.number}`).join(", ")}`
                    : `Ticket ${ticket.ticketId.slice(-6).toUpperCase()}`}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
