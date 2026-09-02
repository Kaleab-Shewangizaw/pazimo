"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/store/authStore";
import { fetchMyCinemaTickets, type CinemaTicket } from "@/lib/cinema-api";
import { keyOf } from "@/lib/cinemaTicketGrouping";
import { Clapperboard, Armchair, Clock, ChevronRight } from "lucide-react";

/**
 * The signed-in customer's cinema tickets.
 *
 * A separate section rather than rows folded into the event list: an event
 * ticket is grouped by event and admits a count, a cinema ticket is one seat at
 * one screening. Flattening them into one shape would misrepresent both, and
 * the event list's grouping logic has nothing to say about a seat.
 *
 * Renders nothing at all when there are none, so an account that has never been
 * to the cinema sees no empty scaffolding.
 *
 * Grouped by order (paymentReference) rather than one row per seat — a party
 * that bought several seats in one checkout shares one QR/pass now (see
 * /cinema/order/[transactionId]), so the account list should read the same
 * way: one card per order, not one per chair. `keyOf` is the same grouping
 * boundary the admin ticket dashboard uses (lib/cinemaTicketGrouping.ts), kept
 * so the two screens can never disagree about what counts as "one order".
 */

interface TicketOrder {
  key: string;
  tickets: CinemaTicket[];
}

const groupByOrder = (tickets: CinemaTicket[]): TicketOrder[] => {
  const groups = new Map<string, CinemaTicket[]>();
  tickets.forEach((t, i) => {
    const key = keyOf(t.paymentReference, t._id, i);
    const list = groups.get(key);
    if (list) list.push(t);
    else groups.set(key, [t]);
  });
  return Array.from(groups, ([key, tickets]) => ({ key, tickets }));
};

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function MyCinemaTickets() {
  const { token } = useAuthStore();
  const [tickets, setTickets] = useState<CinemaTicket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!token) {
      setLoading(false);
      return;
    }
    fetchMyCinemaTickets(token)
      .then((data) => {
        if (!cancelled) setTickets(data || []);
      })
      // Silent: this is one section of a page, and a cinema-ticket failure must
      // not take down someone's event tickets.
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (loading || tickets.length === 0) return null;

  const orders = groupByOrder(tickets);

  return (
    <section className="mb-8">
      <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
        <Clapperboard className="h-4 w-4 text-muted-foreground" />
        Cinema tickets
      </h2>

      <div className="space-y-3">
        {orders.map(({ key, tickets: group }) => {
          const first = group[0];
          const admitted = group.filter((t) => t.checkedIn).length;
          const allDead = group.every((t) => ["refunded", "cancelled"].includes(t.status));
          const seated = group.filter((t) => t.seat?.row);
          const admits = group.reduce((sum, t) => sum + (t.quantity || 1), 0);

          const seatLine = seated.length
            ? seated.length === 1
              ? `Row ${seated[0].seat!.row} · Seat ${seated[0].seat!.number}`
              : `Seats ${seated.map((t) => `${t.seat!.row}${t.seat!.number}`).join(", ")}`
            : `${first.ticketType} × ${admits}`;

          // A grouped order — several seats bought in one checkout — links to
          // the shared order pass. A single, ungrouped row (no
          // paymentReference, e.g. a box-office sale) links straight to its
          // own ticket page, same as before.
          const href = first.paymentReference
            ? `/cinema/order/${first.paymentReference}`
            : `/ticket/${first.ticketId}`;

          return (
            <Link key={key} href={href} className="block">
              <Card className="transition-shadow hover:shadow-md">
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate font-semibold">
                        {first.movie?.title || first.movieTitle}
                      </h3>
                      {allDead && (
                        <Badge variant="destructive" className="capitalize">
                          {first.status}
                        </Badge>
                      )}
                      {!allDead && admitted > 0 && admitted >= group.length && (
                        <Badge className="bg-emerald-600 text-white">Admitted</Badge>
                      )}
                      {!allDead && admitted > 0 && admitted < group.length && (
                        <Badge className="bg-amber-500 text-white">
                          {admitted} of {group.length} admitted
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      {when(first.showtimeStartsAt)}
                      {first.cinema?.name ? ` · ${first.cinema.name}` : ""}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-sm">
                      <Armchair className="h-3.5 w-3.5 text-muted-foreground" />
                      {seatLine}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
