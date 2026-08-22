"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Clock, Loader2, Popcorn, Ticket, XCircle } from "lucide-react";
import { fetchCinemaOrder, verifyPaymentStatus } from "@/lib/cinema-api";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

/**
 * What one paid order produced — the tickets, their QR codes, and the snacks.
 *
 * Keyed by TRANSACTION rather than by ticket, because an order can be several
 * seats and a customer coming back from a payment redirect knows only the
 * transaction they started.
 *
 * Polls while the payment is still pending. Settlement runs from the provider's
 * webhook, which lands whenever the provider decides — the customer is already
 * back on this page by then, so the page has to wait for the tickets rather
 * than assume they exist. The poll stops as soon as they do.
 */

type Order = Awaited<ReturnType<typeof fetchCinemaOrder>>;

const money = (n: number, currency = "ETB") =>
  `${n.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency}`;

export default function CinemaOrderPage() {
  // useParams rather than the `params` prop: this is a client component, and
  // React 18 has no `use()` to unwrap the promise Next 15 passes. Every other
  // client page in this app reads its route the same way.
  const { transactionId } = useParams<{ transactionId: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [waited, setWaited] = useState(0);

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
      // or — on a machine the provider cannot reach — never sent at all. A page
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
      // going to produce a ticket, and leaving the page on "waiting for your
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

  if (error) {
    return (
      <div className="container mx-auto max-w-xl px-4 py-20 text-center">
        <p className="text-lg font-semibold">We couldn&apos;t find that order</p>
        <p className="mt-2 text-sm text-muted-foreground">{error}</p>
        <Button asChild className="mt-6">
          <Link href="/cinemas">Browse cinemas</Link>
        </Button>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="container mx-auto flex max-w-xl items-center justify-center px-4 py-24 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading your order…
      </div>
    );
  }

  const settled = order.tickets.length > 0;
  const failed = !settled && ["FAILED", "CANCELLED"].includes(order.status);
  // Five minutes with no webhook and no verification result. The money may
  // still be in flight, so this deliberately does not claim the payment failed.
  const stalled = !settled && !failed && waited > 300;

  return (
    <div className="container mx-auto max-w-3xl px-4 py-10">
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
          <Button asChild className="mt-6">
            <Link href="/cinemas">Back to cinemas</Link>
          </Button>
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
          <Button className="mt-6" onClick={() => window.location.reload()}>
            Check again
          </Button>
        </div>
      ) : settled ? (
        <div className="mb-8 text-center">
          <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-emerald-500" />
          <h1 className="font-display text-2xl font-bold">You&apos;re going to the movies</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Show the QR code at the door. {order.concessions.length > 0 && "Collect your snacks at the counter."}
          </p>
        </div>
      ) : (
        <div className="mb-8 text-center">
          <Clock className="mx-auto mb-3 h-12 w-12 animate-pulse text-amber-500" />
          <h1 className="font-display text-2xl font-bold">Waiting for your payment</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Approve it on your phone if you haven&apos;t yet. This page updates on its own —
            your seats are held until it completes.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {order.tickets.map((ticket) => (
          <Card key={ticket._id} className="overflow-hidden border border-border">
            <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
              <div className="shrink-0 rounded-lg bg-white p-2">
                {/* Rendered on demand by the API from the ticket's own id, so
                    nothing image-shaped is stored on the ticket — the same
                    renderer the door scanner reads. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`${API_URL}/api/cinemas/public/tickets/${ticket.ticketId}/qr.svg`}
                  alt={`QR code for ticket ${ticket.ticketId}`}
                  className="h-32 w-32"
                />
              </div>

              <div className="min-w-0 flex-1">
                <p className="font-semibold">{ticket.movieTitle}</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(ticket.showtimeStartsAt).toLocaleString(undefined, {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {ticket.hallName ? ` · ${ticket.hallName}` : ""}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {ticket.seat?.row && (
                    <Badge className="text-sm">
                      Row {ticket.seat.row} · Seat {ticket.seat.number}
                    </Badge>
                  )}
                  <Badge variant="outline">{ticket.ticketType}</Badge>
                  <span className="text-sm tabular-nums text-muted-foreground">
                    {money(ticket.totalAmount, ticket.currency)}
                  </span>
                </div>
                <p className="mt-2 font-mono text-[11px] text-muted-foreground">
                  {ticket.ticketId}
                </p>
              </div>

              <Button asChild variant="outline" size="sm" className="shrink-0">
                <Link href={`/ticket/${ticket.ticketId}`}>
                  <Ticket className="mr-1 h-3 w-3" /> Open
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}

        {order.concessions.length > 0 && (
          <Card className="border border-border">
            <CardContent className="p-5">
              <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <Popcorn className="h-4 w-4 text-primary" />
                Collect at the counter
              </p>
              <div className="space-y-1 text-sm">
                {order.concessions.map((item) => (
                  <div key={item.cinemaBeverage} className="flex justify-between">
                    <span>
                      {item.name}{" "}
                      <span className="text-muted-foreground">× {item.quantity}</span>
                    </span>
                    <span className="tabular-nums">
                      {money(item.lineTotal, order.currency)}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Show any of your ticket QR codes at the counter to collect these.
              </p>
            </CardContent>
          </Card>
        )}

        <div className="flex justify-between rounded-lg border border-border p-4 text-sm font-semibold">
          <span>Paid</span>
          <span className="tabular-nums">{money(order.total, order.currency)}</span>
        </div>
      </div>
    </div>
  );
}
