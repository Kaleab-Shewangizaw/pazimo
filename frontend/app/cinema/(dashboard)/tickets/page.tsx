"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CinemaGate } from "@/components/cinema/cinema-gate";
import {
  fetchConcessionSales,
  fetchMovies,
  fetchShowtimes,
  fetchTicketSales,
  money,
  type CinemaConcessionSale,
  type CinemaMovie,
  type CinemaProfile,
  type CinemaShowtime,
  type CinemaTicket,
} from "@/lib/cinema-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Ticket, Users, Search, Popcorn, ListTree } from "lucide-react";
import {
  concessionsFullText,
  concessionsSummary,
  groupIntoOrders,
  keyOf,
  ORDER_STATUS_BADGE,
  type BuyerOrder,
} from "@/lib/cinemaTicketGrouping";

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

function TicketsContent({ token }: { cinema: CinemaProfile; token: string }) {
  const [movies, setMovies] = useState<CinemaMovie[]>([]);
  const [selectedMovieId, setSelectedMovieId] = useState("");
  const [loadingMovies, setLoadingMovies] = useState(true);

  const [showtimes, setShowtimes] = useState<CinemaShowtime[]>([]);
  const [selectedShowtimeId, setSelectedShowtimeId] = useState("");
  const [loadingShowtimes, setLoadingShowtimes] = useState(false);

  const [tickets, setTickets] = useState<CinemaTicket[]>([]);
  const [concessions, setConcessions] = useState<CinemaConcessionSale[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [search, setSearch] = useState("");
  // The order whose raw tickets and concession lines are open in the detail
  // dialog.
  const [detailOrder, setDetailOrder] = useState<BuyerOrder | null>(null);

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
      setConcessions([]);
      return;
    }
    setLoadingTickets(true);
    try {
      // A single screening's seat count is bounded by the hall — 1000 comfortably
      // covers any real room, so neither of these ever needs its own pagination.
      const [ticketRes, concessionRes] = await Promise.all([
        fetchTicketSales(token, `?showtimeId=${selectedShowtimeId}&limit=1000`),
        fetchConcessionSales(token, `?showtimeId=${selectedShowtimeId}&limit=1000`),
      ]);
      setTickets(ticketRes.data);
      setConcessions(concessionRes.data);
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

  const orders = useMemo(
    () => groupIntoOrders(tickets, concessions),
    [tickets, concessions]
  );

  const filteredOrders = useMemo(() => {
    if (!search.trim()) return orders;
    const q = search.trim().toLowerCase();
    return orders.filter(
      (o) =>
        o.buyerName.toLowerCase().includes(q) ||
        (o.buyerPhone || "").toLowerCase().includes(q)
    );
  }, [orders, search]);

  // Concession revenue for this screening, refunds excluded — the same
  // question the per-ticket-type cards answer for seats.
  const concessionTotals = useMemo(() => {
    let revenue = 0;
    let units = 0;
    for (const c of concessions) {
      if (c.status === "refunded") continue;
      revenue += c.totalAmount || 0;
      units += c.quantity || 0;
    }
    return { revenue, units };
  }, [concessions]);

  // The raw rows behind the order open in the detail dialog — filtered by
  // the exact same key groupIntoOrders used, so this can never disagree with
  // what the row it was opened from actually summarizes.
  const detailTickets = useMemo(
    () =>
      detailOrder
        ? tickets.filter((t, i) => keyOf(t.paymentReference, t._id, i) === detailOrder.key)
        : [],
    [tickets, detailOrder]
  );
  const detailConcessions = useMemo(
    () =>
      detailOrder
        ? concessions.filter((c, i) => keyOf(c.paymentReference, c._id, i) === detailOrder.key)
        : [],
    [concessions, detailOrder]
  );

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

            <Card className="border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  <Popcorn className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                  Concessions
                </div>
                <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {money(concessionTotals.revenue, selectedShowtime.currency)}
                </p>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {concessionTotals.units} item{concessionTotals.units === 1 ? "" : "s"} sold
                </p>
              </CardContent>
            </Card>
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
                      <th className="py-2 pr-4">Snacks</th>
                      <th className="py-2 pr-4 text-right">Amount</th>
                      <th className="py-2 pr-4">Channel</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2 pr-4">Purchased</th>
                      <th className="py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {loadingTickets ? (
                      <tr>
                        <td colSpan={8} className="py-8">
                          <Skeleton className="h-24 w-full" />
                        </td>
                      </tr>
                    ) : filteredOrders.length === 0 ? (
                      <tr>
                        <td
                          colSpan={8}
                          className="py-6 text-center text-gray-500 dark:text-gray-400"
                        >
                          {tickets.length === 0 && concessions.length === 0
                            ? "Nothing sold for this screening yet."
                            : "No buyer matches that search."}
                        </td>
                      </tr>
                    ) : (
                      filteredOrders.map((o) => {
                        const badge = ORDER_STATUS_BADGE[o.status];
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
                            <td className="max-w-[180px] py-2 pr-4">
                              {o.totalQuantity > 0 ? (
                                <>
                                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                                    {o.totalQuantity}
                                  </span>
                                  <span
                                    className="ml-1 text-xs text-gray-500 dark:text-gray-400"
                                    title={concessionsFullText(
                                      o.typeBreakdown.map((b) => ({ name: b.type, quantity: b.quantity }))
                                    )}
                                  >
                                    {concessionsSummary(
                                      o.typeBreakdown.map((b) => ({ name: b.type, quantity: b.quantity }))
                                    )}
                                  </span>
                                </>
                              ) : (
                                <span className="text-xs text-gray-400 dark:text-gray-500">—</span>
                              )}
                            </td>
                            <td className="max-w-[200px] py-2 pr-4">
                              {o.concessions.length === 0 ? (
                                <span className="text-xs text-gray-400 dark:text-gray-500">—</span>
                              ) : (
                                <div className="flex items-start gap-1.5">
                                  <Popcorn className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                                  <div className="min-w-0">
                                    <span
                                      className="block truncate text-xs text-gray-700 dark:text-gray-300"
                                      title={concessionsFullText(o.concessions)}
                                    >
                                      {concessionsSummary(o.concessions)}
                                    </span>
                                    {o.concessionsOutstanding && (
                                      <div className="text-[11px] text-amber-600 dark:text-amber-400">
                                        Not yet collected
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </td>
                            <td className="py-2 pr-4 text-right tabular-nums">
                              {money(o.totalAmount, o.currency)}
                              {o.concessionAmount > 0 && (
                                <div className="text-[11px] font-normal text-gray-400 dark:text-gray-500">
                                  incl. {money(o.concessionAmount, o.currency)} snacks
                                </div>
                              )}
                            </td>
                            <td className="py-2 pr-4 text-xs capitalize text-gray-500 dark:text-gray-400">
                              {o.channel === "box_office" ? "Box office" : "Online"}
                            </td>
                            <td className="py-2 pr-4">
                              <Badge variant={badge.variant}>{badge.label}</Badge>
                            </td>
                            <td className="py-2 pr-4 text-xs text-gray-500 dark:text-gray-400">
                              {new Date(o.purchaseDate).toLocaleString()}
                            </td>
                            <td className="py-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={() => setDetailOrder(o)}
                              >
                                <ListTree className="mr-1 h-3.5 w-3.5" /> Details
                              </Button>
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

      {/* One buyer's individual tickets and concession lines. */}
      <Dialog open={!!detailOrder} onOpenChange={(open) => !open && setDetailOrder(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{detailOrder?.buyerName}</DialogTitle>
            <DialogDescription>
              {detailOrder && new Date(detailOrder.purchaseDate).toLocaleString()}
              {detailOrder?.buyerPhone ? ` · ${detailOrder.buyerPhone}` : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {detailTickets.length > 0 && (
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Tickets ({detailTickets.length})
                </h4>
                <div className="space-y-1.5">
                  {detailTickets.map((t) => (
                    <div
                      key={t._id}
                      className="flex items-center justify-between rounded-md border border-gray-100 px-3 py-2 text-xs dark:border-gray-800"
                    >
                      <div>
                        <span className="font-mono text-gray-900 dark:text-gray-100">
                          {t.ticketId}
                        </span>
                        <span className="ml-2 text-gray-500 dark:text-gray-400">
                          {t.ticketType}
                          {t.seat?.seatKey ? ` · seat ${t.seat.seatKey}` : ""}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="tabular-nums text-gray-500 dark:text-gray-400">
                          {money(t.totalAmount, t.currency)}
                        </span>
                        <Badge
                          variant={
                            t.status === "refunded" || t.status === "cancelled"
                              ? "secondary"
                              : t.checkedIn
                                ? "outline"
                                : "default"
                          }
                          className="text-[10px]"
                        >
                          {t.checkedIn ? "admitted" : t.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {detailConcessions.length > 0 && (
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Concessions ({detailConcessions.length})
                </h4>
                <div className="space-y-1.5">
                  {detailConcessions.map((c) => (
                    <div
                      key={c._id}
                      className="flex items-center justify-between rounded-md border border-gray-100 px-3 py-2 text-xs dark:border-gray-800"
                    >
                      <div>
                        <span className="font-mono text-gray-900 dark:text-gray-100">
                          {c.referenceNumber}
                        </span>
                        <span className="ml-2 text-gray-500 dark:text-gray-400">
                          {c.beverageName} ×{c.quantity}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="tabular-nums text-gray-500 dark:text-gray-400">
                          {money(c.totalAmount, c.currency)}
                        </span>
                        <Badge
                          variant={
                            c.status === "refunded"
                              ? "secondary"
                              : c.channel === "online" && !c.redeemedAt
                                ? "default"
                                : "outline"
                          }
                          className="text-[10px]"
                        >
                          {c.status === "refunded"
                            ? "refunded"
                            : c.channel === "manual"
                              ? "sold at counter"
                              : c.redeemedAt
                                ? "collected"
                                : "awaiting pickup"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
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
