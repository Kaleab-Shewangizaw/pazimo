"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CinemaGate } from "@/components/cinema/cinema-gate";
import {
  fetchMovies,
  fetchShowtimes,
  fetchTicketSales,
  money,
  type CinemaMovie,
  type CinemaProfile,
  type CinemaShowtime,
  type CinemaTicket,
} from "@/lib/cinema-api";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Ticket, Users, Search } from "lucide-react";

const selectClass =
  "h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm dark:border-gray-700 dark:bg-gray-900";

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

/**
 * One buyer's order for the selected screening.
 *
 * A `CinemaTicket` row is one SEAT on an assigned-seating hall — a customer
 * who picked 3 chairs produced 3 separate rows sharing one `paymentReference`
 * (their checkout's transaction id, or the box office's own per-sale
 * reference). Grouping by that reference is what turns "3 rows" back into
 * the one purchase a cinema actually wants to see: one buyer, one order,
 * however many tickets it held. A row with no reference at all (very old
 * data, if any) stands alone rather than merging with anything else.
 */
interface BuyerOrder {
  key: string;
  buyerName: string;
  buyerPhone?: string;
  channel: "online" | "box_office";
  purchaseDate: string;
  totalQuantity: number;
  totalAmount: number;
  currency: string;
  typeBreakdown: { type: string; quantity: number }[];
  checkedInCount: number;
  // The group's overall state for the badge: refunded/cancelled wins (money
  // actually came back or never counted), otherwise whether every ticket in
  // the order has been admitted yet.
  status: "refunded" | "cancelled" | "admitted" | "partially_admitted" | "active";
}

const groupIntoOrders = (tickets: CinemaTicket[]): BuyerOrder[] => {
  const groups = new Map<string, CinemaTicket[]>();
  tickets.forEach((t, i) => {
    const key = t.paymentReference || `single:${t._id || i}`;
    const list = groups.get(key);
    if (list) list.push(t);
    else groups.set(key, [t]);
  });

  return Array.from(groups.entries()).map(([key, group]) => {
    const first = group[0];
    const totalQuantity = group.reduce((sum, t) => sum + (t.quantity || 0), 0);
    const totalAmount = group.reduce((sum, t) => sum + (t.totalAmount || 0), 0);
    const checkedInCount = group.reduce(
      (sum, t) => sum + (t.checkedIn ? t.quantity || 0 : 0),
      0
    );

    const byType = new Map<string, number>();
    for (const t of group) {
      byType.set(t.ticketType, (byType.get(t.ticketType) || 0) + (t.quantity || 0));
    }

    const anyRefunded = group.some((t) => t.status === "refunded");
    const anyCancelled = group.some((t) => t.status === "cancelled");
    const status: BuyerOrder["status"] = anyRefunded
      ? "refunded"
      : anyCancelled
        ? "cancelled"
        : checkedInCount === 0
          ? "active"
          : checkedInCount >= totalQuantity
            ? "admitted"
            : "partially_admitted";

    return {
      key,
      buyerName: first.customerName?.trim() || "Guest",
      buyerPhone: first.customerPhone,
      channel: first.channel,
      purchaseDate: first.purchaseDate,
      totalQuantity,
      totalAmount,
      currency: first.currency,
      typeBreakdown: Array.from(byType.entries()).map(([type, quantity]) => ({
        type,
        quantity,
      })),
      checkedInCount,
      status,
    };
  });
};

const STATUS_BADGE: Record<
  BuyerOrder["status"],
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  active: { label: "Not yet admitted", variant: "default" },
  partially_admitted: { label: "Partially admitted", variant: "outline" },
  admitted: { label: "Admitted", variant: "outline" },
  refunded: { label: "Refunded", variant: "secondary" },
  cancelled: { label: "Cancelled", variant: "secondary" },
};

function TicketsContent({ token }: { cinema: CinemaProfile; token: string }) {
  const [movies, setMovies] = useState<CinemaMovie[]>([]);
  const [selectedMovieId, setSelectedMovieId] = useState("");
  const [loadingMovies, setLoadingMovies] = useState(true);

  const [showtimes, setShowtimes] = useState<CinemaShowtime[]>([]);
  const [selectedShowtimeId, setSelectedShowtimeId] = useState("");
  const [loadingShowtimes, setLoadingShowtimes] = useState(false);

  const [tickets, setTickets] = useState<CinemaTicket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [search, setSearch] = useState("");

  // Movies with at least one screening — one with none is a dead end in the
  // schedule selector below it, so it is left off rather than shown empty.
  useEffect(() => {
    fetchMovies(token)
      .then((data) => {
        const withScreenings = data.filter((m) => (m.showtimeCount || 0) > 0);
        setMovies(withScreenings);
        if (withScreenings.length && !selectedMovieId) {
          setSelectedMovieId(withScreenings[0]._id);
        }
      })
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setLoadingMovies(false));
    // Runs once on mount — selecting a movie later never re-fetches the list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // This film's screenings, most recent first — a sales report is read
  // looking backward far more often than forward.
  useEffect(() => {
    if (!selectedMovieId) {
      setShowtimes([]);
      setSelectedShowtimeId("");
      return;
    }
    setLoadingShowtimes(true);
    fetchShowtimes(token, `?movieId=${selectedMovieId}`)
      .then((data) => {
        const sorted = [...data].sort(
          (a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime()
        );
        setShowtimes(sorted);
        setSelectedShowtimeId(sorted[0]?._id || "");
      })
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setLoadingShowtimes(false));
  }, [token, selectedMovieId]);

  const reloadTickets = useCallback(async () => {
    if (!selectedShowtimeId) {
      setTickets([]);
      return;
    }
    setLoadingTickets(true);
    try {
      // A single screening's seat count is bounded by the hall — 1000 comfortably
      // covers any real room, so this never needs its own pagination control.
      const res = await fetchTicketSales(
        token,
        `?showtimeId=${selectedShowtimeId}&limit=1000`
      );
      setTickets(res.data);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoadingTickets(false);
    }
  }, [token, selectedShowtimeId]);

  useEffect(() => {
    reloadTickets();
  }, [reloadTickets]);

  const selectedShowtime = showtimes.find((s) => s._id === selectedShowtimeId);

  const orders = useMemo(() => groupIntoOrders(tickets), [tickets]);

  const filteredOrders = useMemo(() => {
    if (!search.trim()) return orders;
    const q = search.trim().toLowerCase();
    return orders.filter(
      (o) =>
        o.buyerName.toLowerCase().includes(q) ||
        (o.buyerPhone || "").toLowerCase().includes(q)
    );
  }, [orders, search]);

  if (loadingMovies) {
    return (
      <div className="container mx-auto max-w-6xl px-4 py-8">
        <Skeleton className="mb-6 h-9 w-64" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
        Tickets
      </h1>
      <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
        What one screening sold, and who bought it.
      </p>

      {/* --- movie + schedule pickers ---------------------------------- */}
      <Card className="border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950/50">
        <CardContent className="grid gap-4 p-5 sm:grid-cols-2">
          <div>
            <Label className="text-xs">Film</Label>
            {movies.length === 0 ? (
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                No film has a screening yet. Schedule one under Programme.
              </p>
            ) : (
              <select
                className={selectClass}
                value={selectedMovieId}
                onChange={(e) => setSelectedMovieId(e.target.value)}
              >
                {movies.map((m) => (
                  <option key={m._id} value={m._id}>
                    {m.title}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <Label className="text-xs">Screening</Label>
            {loadingShowtimes ? (
              <Skeleton className="mt-1 h-9 w-full" />
            ) : showtimes.length === 0 ? (
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                No screenings scheduled for this film.
              </p>
            ) : (
              <select
                className={selectClass}
                value={selectedShowtimeId}
                onChange={(e) => setSelectedShowtimeId(e.target.value)}
              >
                {showtimes.map((s) => (
                  <option key={s._id} value={s._id}>
                    {formatDateTime(s.startsAt)} — {s.hall?.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </CardContent>
      </Card>

      {selectedShowtime && (
        <>
          {/* --- sales by ticket type ------------------------------------ */}
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {selectedShowtime.ticketTypes.map((t) => (
              <Card
                key={t._id}
                className="border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950/50"
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    <Ticket className="h-3.5 w-3.5" />
                    {t.name}
                  </div>
                  <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {t.sold}
                    <span className="ml-1 text-sm font-normal text-gray-400">
                      / {t.allocation} sold
                    </span>
                  </p>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {money(t.sold * t.price, selectedShowtime.currency)} · {money(t.price, selectedShowtime.currency)} each
                  </p>
                </CardContent>
              </Card>
            ))}
            {selectedShowtime.ticketTypes.length === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                This screening has no ticket types priced yet.
              </p>
            )}
          </div>

          {/* --- who bought them -------------------------------------- */}
          <Card className="mt-6 border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950/50">
            <CardContent className="p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                  <Users className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  Buyers ({filteredOrders.length})
                </h2>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <Input
                    className="pl-9"
                    placeholder="Search buyer name or phone"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:text-gray-400">
                      <th className="py-2 pr-4">Buyer</th>
                      <th className="py-2 pr-4">Tickets bought</th>
                      <th className="py-2 pr-4 text-right">Amount</th>
                      <th className="py-2 pr-4">Channel</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2">Purchased</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingTickets ? (
                      <tr>
                        <td colSpan={6} className="py-8">
                          <Skeleton className="h-24 w-full" />
                        </td>
                      </tr>
                    ) : filteredOrders.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="py-6 text-center text-gray-500 dark:text-gray-400"
                        >
                          {tickets.length === 0
                            ? "No tickets sold for this screening yet."
                            : "No buyer matches that search."}
                        </td>
                      </tr>
                    ) : (
                      filteredOrders.map((o) => {
                        const badge = STATUS_BADGE[o.status];
                        return (
                          <tr
                            key={o.key}
                            className="border-b border-gray-100 dark:border-gray-800/60"
                          >
                            <td className="py-2 pr-4">
                              <div className="font-medium text-gray-900 dark:text-gray-100">
                                {o.buyerName}
                              </div>
                              {o.buyerPhone && (
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  {o.buyerPhone}
                                </div>
                              )}
                            </td>
                            <td className="py-2 pr-4">
                              <span className="font-semibold text-gray-900 dark:text-gray-100">
                                {o.totalQuantity}
                              </span>
                              <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">
                                {o.typeBreakdown
                                  .map((b) => `${b.type} ×${b.quantity}`)
                                  .join(", ")}
                              </span>
                            </td>
                            <td className="py-2 pr-4 text-right tabular-nums">
                              {money(o.totalAmount, o.currency)}
                            </td>
                            <td className="py-2 pr-4 text-xs capitalize text-gray-500 dark:text-gray-400">
                              {o.channel === "box_office" ? "Box office" : "Online"}
                            </td>
                            <td className="py-2 pr-4">
                              <Badge variant={badge.variant}>{badge.label}</Badge>
                            </td>
                            <td className="py-2 text-xs text-gray-500 dark:text-gray-400">
                              {new Date(o.purchaseDate).toLocaleString()}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

export default function CinemaTicketsPage() {
  return (
    <CinemaGate>
      {(cinema, token) => <TicketsContent cinema={cinema} token={token} />}
    </CinemaGate>
  );
}
