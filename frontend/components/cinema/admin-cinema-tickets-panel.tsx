"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Ticket, Users, Search, Clapperboard } from "lucide-react";
import { money, type CinemaMovie, type CinemaShowtime, type CinemaTicket } from "@/lib/cinema-api";
import { groupIntoOrders, ORDER_STATUS_BADGE } from "@/lib/cinemaTicketGrouping";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

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

interface CinemaOption {
  _id: string;
  name: string;
  city?: string | null;
  isActive: boolean;
}

/**
 * The admin's read of one screening's sales: cinema -> film -> screening ->
 * sales-by-ticket-type -> who bought it. The same report the cinema itself
 * sees on its own Tickets page (same grouping, same cards), scoped by an
 * extra cinema picker up front and reading the /admin/:cinemaId/* endpoints
 * instead of /me/*.
 */
export default function AdminCinemaTicketsPanel({ token }: { token: string | null }) {
  const [cinemas, setCinemas] = useState<CinemaOption[]>([]);
  const [selectedCinemaId, setSelectedCinemaId] = useState("");
  const [loadingCinemas, setLoadingCinemas] = useState(true);

  const [movies, setMovies] = useState<CinemaMovie[]>([]);
  const [selectedMovieId, setSelectedMovieId] = useState("");
  const [loadingMovies, setLoadingMovies] = useState(false);

  const [showtimes, setShowtimes] = useState<CinemaShowtime[]>([]);
  const [selectedShowtimeId, setSelectedShowtimeId] = useState("");
  const [loadingShowtimes, setLoadingShowtimes] = useState(false);

  const [tickets, setTickets] = useState<CinemaTicket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [search, setSearch] = useState("");

  // Every cinema on the platform — including a suspended one, since a report
  // is read looking backward and a cinema stopped selling today still sold
  // something yesterday.
  useEffect(() => {
    if (!token) return;
    fetch(`${API_URL}/api/cinemas/admin?limit=200`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (!data.success) throw new Error(data.message || "Failed to load cinemas");
        const rows: CinemaOption[] = data.data || [];
        setCinemas(rows);
        if (rows.length && !selectedCinemaId) setSelectedCinemaId(rows[0]._id);
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load cinemas"))
      .finally(() => setLoadingCinemas(false));
    // Runs once — the cinema list itself never changes while this tab is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // This cinema's films with at least one screening — one with none is a
  // dead end in the schedule selector below it.
  useEffect(() => {
    if (!token || !selectedCinemaId) {
      setMovies([]);
      setSelectedMovieId("");
      return;
    }
    setLoadingMovies(true);
    fetch(`${API_URL}/api/cinemas/admin/${selectedCinemaId}/movies`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (!data.success) throw new Error(data.message || "Failed to load films");
        const withScreenings: CinemaMovie[] = (data.data || []).filter(
          (m: CinemaMovie) => (m.showtimeCount || 0) > 0
        );
        setMovies(withScreenings);
        setSelectedMovieId(withScreenings[0]?._id || "");
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load films"))
      .finally(() => setLoadingMovies(false));
  }, [token, selectedCinemaId]);

  // This film's screenings, most recent first.
  useEffect(() => {
    if (!token || !selectedCinemaId || !selectedMovieId) {
      setShowtimes([]);
      setSelectedShowtimeId("");
      return;
    }
    setLoadingShowtimes(true);
    fetch(
      `${API_URL}/api/cinemas/admin/${selectedCinemaId}/showtimes?movieId=${selectedMovieId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
      .then((r) => r.json())
      .then((data) => {
        if (!data.success) throw new Error(data.message || "Failed to load screenings");
        const sorted: CinemaShowtime[] = [...(data.data || [])].sort(
          (a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime()
        );
        setShowtimes(sorted);
        setSelectedShowtimeId(sorted[0]?._id || "");
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load screenings"))
      .finally(() => setLoadingShowtimes(false));
  }, [token, selectedCinemaId, selectedMovieId]);

  const reloadTickets = useCallback(async () => {
    if (!token || !selectedCinemaId || !selectedShowtimeId) {
      setTickets([]);
      return;
    }
    setLoadingTickets(true);
    try {
      // A single screening's seat count is bounded by the hall — 1000
      // comfortably covers any real room, so this never needs its own
      // pagination control.
      const res = await fetch(
        `${API_URL}/api/cinemas/admin/${selectedCinemaId}/ticket-sales?showtimeId=${selectedShowtimeId}&limit=1000`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Failed to load tickets");
      setTickets(data.data || []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load tickets");
    } finally {
      setLoadingTickets(false);
    }
  }, [token, selectedCinemaId, selectedShowtimeId]);

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

  if (loadingCinemas) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* --- cinema + film + schedule pickers --------------------------- */}
      <Card>
        <CardContent className="grid gap-4 p-5 sm:grid-cols-3">
          <div>
            <Label className="text-xs">Cinema</Label>
            {cinemas.length === 0 ? (
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                No cinema on the platform yet.
              </p>
            ) : (
              <select
                className={selectClass}
                value={selectedCinemaId}
                onChange={(e) => setSelectedCinemaId(e.target.value)}
              >
                {cinemas.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                    {c.city ? ` — ${c.city}` : ""}
                    {!c.isActive ? " (suspended)" : ""}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <Label className="text-xs">Film</Label>
            {loadingMovies ? (
              <Skeleton className="mt-1 h-9 w-full" />
            ) : movies.length === 0 ? (
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                No film has a screening yet.
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {selectedShowtime.ticketTypes.map((t) => (
              <Card key={t._id}>
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
          <Card>
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

      {!selectedCinemaId && (
        <p className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <Clapperboard className="h-4 w-4" /> Select a cinema to see its ticket sales.
        </p>
      )}
    </div>
  );
}
