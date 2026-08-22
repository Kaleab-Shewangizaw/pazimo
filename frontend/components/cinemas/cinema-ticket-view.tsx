"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clapperboard, MapPin, Clock, Armchair, CheckCircle2 } from "lucide-react";

/**
 * One cinema ticket, as the customer sees it.
 *
 * Shared by /ticket/{id} — the link that goes out in the confirmation SMS and
 * email — and by the account ticket list, so a ticket looks the same wherever
 * it is opened.
 *
 * The QR is an <img> pointing at the API rather than a blob rendered here. It
 * is derived entirely from the ticket's own id, so it can be cached hard and
 * never has to be stored: that is the same decision that keeps 517 MB of
 * base64 out of the tickets collection.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export interface CinemaTicketData {
  ticketId: string;
  movieTitle: string;
  hallName?: string;
  showtimeStartsAt: string;
  ticketType: string;
  quantity: number;
  totalAmount: number;
  currency: string;
  status: string;
  paymentStatus: string;
  checkedIn?: boolean;
  checkedAt?: string | null;
  customerName?: string;
  seat?: {
    row?: string;
    number?: string;
    seatKey?: string;
    categoryLabel?: string;
  } | null;
  cinema?: { name?: string; address?: string; city?: string } | null;
  movie?: { title?: string; poster?: string | null } | null;
}

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function CinemaTicketView({ ticket }: { ticket: CinemaTicketData }) {
  // A refunded or cancelled ticket still renders — the customer needs to see
  // what happened to it — but it must never look scannable.
  const dead = ["refunded", "cancelled"].includes(ticket.status);
  const used = ticket.checkedIn;

  return (
    <div className="container mx-auto max-w-xl px-4 py-8">
      <Card className="overflow-hidden border border-border">
        <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-5 py-3">
          <Clapperboard className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Cinema ticket
          </span>
          {dead && (
            <Badge variant="destructive" className="ml-auto capitalize">
              {ticket.status}
            </Badge>
          )}
          {!dead && used && (
            <Badge className="ml-auto bg-emerald-600 text-white">Admitted</Badge>
          )}
        </div>

        <CardContent className="space-y-5 p-5">
          <div>
            <h1 className="font-display text-2xl font-bold leading-tight">
              {ticket.movie?.title || ticket.movieTitle}
            </h1>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              {when(ticket.showtimeStartsAt)}
            </p>
            {ticket.cinema?.name && (
              <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" />
                {ticket.cinema.name}
                {ticket.cinema.city ? `, ${ticket.cinema.city}` : ""}
                {ticket.hallName ? ` · ${ticket.hallName}` : ""}
              </p>
            )}
          </div>

          {/* The seat, given the most weight after the film: it is the single
              thing the customer checks on the way in. */}
          {ticket.seat?.seatKey ? (
            <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-4">
              <Armchair className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Your seat</p>
                <p className="text-lg font-semibold">
                  Row {ticket.seat.row} · Seat {ticket.seat.number}
                  {ticket.seat.categoryLabel && (
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      ({ticket.seat.categoryLabel})
                    </span>
                  )}
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
              General admission — {ticket.ticketType} × {ticket.quantity}
            </div>
          )}

          <div className="flex flex-col items-center gap-3 rounded-lg border border-border p-5">
            {dead ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                This ticket was {ticket.status} and will not be admitted.
              </p>
            ) : (
              <>
                <div className="rounded-lg bg-white p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`${API_URL}/api/cinemas/public/tickets/${ticket.ticketId}/qr.png`}
                    alt={`QR code for ticket ${ticket.ticketId}`}
                    width={200}
                    height={200}
                    className="h-[200px] w-[200px]"
                  />
                </div>
                <p className="font-mono text-sm tracking-widest">{ticket.ticketId}</p>
                <p className="text-center text-xs text-muted-foreground">
                  {used
                    ? `Admitted${ticket.checkedAt ? ` at ${when(ticket.checkedAt)}` : ""}`
                    : "Show this at the door"}
                </p>
              </>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-border pt-4 text-sm">
            <span className="text-muted-foreground">{ticket.ticketType}</span>
            <span className="font-semibold tabular-nums">
              {ticket.totalAmount.toLocaleString()} {ticket.currency}
            </span>
          </div>

          {used && (
            <p className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Already admitted — this code will not scan again.
            </p>
          )}
        </CardContent>
      </Card>

      <Button asChild variant="outline" className="mt-6 w-full">
        <Link href="/cinemas">Browse more films</Link>
      </Button>
    </div>
  );
}
