"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/store/authStore";
import { fetchMyCinemaTickets, type CinemaTicket } from "@/lib/cinema-api";
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
 */

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

  return (
    <section className="mb-8">
      <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
        <Clapperboard className="h-4 w-4 text-muted-foreground" />
        Cinema tickets
      </h2>

      <div className="space-y-3">
        {tickets.map((ticket) => {
          const dead = ["refunded", "cancelled"].includes(ticket.status);
          return (
            <Link key={ticket._id} href={`/ticket/${ticket.ticketId}`} className="block">
              <Card className="transition-shadow hover:shadow-md">
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate font-semibold">
                        {ticket.movie?.title || ticket.movieTitle}
                      </h3>
                      {dead && (
                        <Badge variant="destructive" className="capitalize">
                          {ticket.status}
                        </Badge>
                      )}
                      {!dead && ticket.checkedIn && (
                        <Badge className="bg-emerald-600 text-white">Admitted</Badge>
                      )}
                    </div>
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      {when(ticket.showtimeStartsAt)}
                      {ticket.cinema?.name ? ` · ${ticket.cinema.name}` : ""}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-sm">
                      <Armchair className="h-3.5 w-3.5 text-muted-foreground" />
                      {ticket.seat?.row
                        ? `Row ${ticket.seat.row} · Seat ${ticket.seat.number}`
                        : `${ticket.ticketType} × ${ticket.quantity}`}
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
