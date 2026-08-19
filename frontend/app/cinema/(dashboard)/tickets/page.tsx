"use client";

import { useCallback, useEffect, useState } from "react";
import { CinemaGate } from "@/components/cinema/cinema-gate";
import {
  cinemaRequest,
  fetchShowtimes,
  fetchTicketSales,
  money,
  type CinemaProfile,
  type CinemaShowtime,
  type CinemaTicket,
} from "@/lib/cinema-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Ticket, ScanLine } from "lucide-react";

function TicketsContent({ token }: { cinema: CinemaProfile; token: string }) {
  const [showtimes, setShowtimes] = useState<CinemaShowtime[]>([]);
  const [tickets, setTickets] = useState<CinemaTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("");

  const reload = useCallback(async () => {
    const [s, t] = await Promise.all([
      fetchShowtimes(token, "?status=scheduled"),
      fetchTicketSales(token, filter ? `?search=${encodeURIComponent(filter)}` : ""),
    ]);
    setShowtimes(s);
    setTickets(t.data);
  }, [token, filter]);

  useEffect(() => {
    reload()
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [reload]);

  // --- Box office ----------------------------------------------------------
  const [sale, setSale] = useState({
    showtime: "",
    ticketType: "",
    quantity: "1",
    customerName: "",
    customerPhone: "",
  });

  const selected = showtimes.find((s) => s._id === sale.showtime);

  const sell = async () => {
    setBusy(true);
    try {
      await cinemaRequest("/api/cinemas/me/ticket-sales", token, {
        method: "POST",
        // Only WHICH tier — never the price. The server resolves that from the
        // showtime, so a tampered client cannot set its own price.
        body: JSON.stringify({
          showtime: sale.showtime,
          ticketType: sale.ticketType,
          quantity: Number(sale.quantity),
          customerName: sale.customerName || undefined,
          customerPhone: sale.customerPhone || undefined,
        }),
      });
      toast.success("Ticket sold");
      setSale({ ...sale, quantity: "1", customerName: "", customerPhone: "" });
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // --- Admission -----------------------------------------------------------
  const [scanCode, setScanCode] = useState("");
  const checkIn = async () => {
    try {
      const res = await cinemaRequest<{ data: CinemaTicket }>(
        `/api/cinemas/me/check-in/${scanCode.trim()}`,
        token,
        { method: "POST" }
      );
      toast.success(
        `Admitted — ${res.data.movieTitle}, ${res.data.ticketType} x${res.data.quantity}`
      );
      setScanCode("");
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto max-w-6xl px-4 py-8">
        <Skeleton className="mb-6 h-9 w-64" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const selectClass =
    "h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm dark:border-gray-700 dark:bg-gray-900";

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-gray-100">
        Tickets
      </h1>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950/50">
          <CardContent className="space-y-4 p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
              <Ticket className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              Sell at the box office
            </h2>

            {showtimes.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No screenings on sale. Schedule one under Programme.
              </p>
            ) : (
              <>
                <div>
                  <Label className="text-xs">Screening</Label>
                  <select
                    className={selectClass}
                    value={sale.showtime}
                    onChange={(e) =>
                      setSale({ ...sale, showtime: e.target.value, ticketType: "" })
                    }
                  >
                    <option value="">Select…</option>
                    {showtimes.map((s) => (
                      <option key={s._id} value={s._id}>
                        {s.movie?.title} — {new Date(s.startsAt).toLocaleString()}
                      </option>
                    ))}
                  </select>
                </div>

                {selected && (
                  <div>
                    <Label className="text-xs">Ticket type</Label>
                    <select
                      className={selectClass}
                      value={sale.ticketType}
                      onChange={(e) =>
                        setSale({ ...sale, ticketType: e.target.value })
                      }
                    >
                      <option value="">Select…</option>
                      {selected.ticketTypes
                        .filter((t) => t.isAvailable)
                        .map((t) => (
                          <option key={t._id} value={t._id}>
                            {t.name} — {money(t.price)} (
                            {Math.max(t.allocation - t.sold, 0)} left)
                          </option>
                        ))}
                    </select>
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <Label className="text-xs">Seats</Label>
                    <Input
                      type="number"
                      min={1}
                      value={sale.quantity}
                      onChange={(e) => setSale({ ...sale, quantity: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Customer name</Label>
                    <Input
                      value={sale.customerName}
                      onChange={(e) =>
                        setSale({ ...sale, customerName: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Phone</Label>
                    <Input
                      value={sale.customerPhone}
                      onChange={(e) =>
                        setSale({ ...sale, customerPhone: e.target.value })
                      }
                    />
                  </div>
                </div>

                <Button
                  onClick={sell}
                  disabled={busy || !sale.showtime || !sale.ticketType}
                >
                  Sell ticket
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950/50">
          <CardContent className="space-y-4 p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
              <ScanLine className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              Admit a ticket
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Enter the code from the ticket QR. Only this cinema&apos;s tickets
              can be admitted here — an event ticket will not validate.
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="Ticket code"
                value={scanCode}
                onChange={(e) => setScanCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && scanCode && checkIn()}
              />
              <Button onClick={checkIn} disabled={!scanCode.trim()}>
                Admit
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6 border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950/50">
        <CardContent className="p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Recent sales
            </h2>
            <Input
              className="w-full sm:w-64"
              placeholder="Search code, name or phone"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:text-gray-400">
                  <th className="py-2 pr-4">Code</th>
                  <th className="py-2 pr-4">Film</th>
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4 text-right">Seats</th>
                  <th className="py-2 pr-4 text-right">Amount</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2">Sold</th>
                </tr>
              </thead>
              <tbody>
                {tickets.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="py-6 text-center text-gray-500 dark:text-gray-400"
                    >
                      No tickets sold yet.
                    </td>
                  </tr>
                )}
                {tickets.map((t) => (
                  <tr
                    key={t._id}
                    className="border-b border-gray-100 dark:border-gray-800/60"
                  >
                    <td className="py-2 pr-4 font-mono text-xs">{t.ticketId}</td>
                    <td className="py-2 pr-4">{t.movieTitle}</td>
                    <td className="py-2 pr-4">{t.ticketType}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {t.quantity}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {money(t.totalAmount, t.currency)}
                    </td>
                    <td className="py-2 pr-4">
                      <Badge
                        variant={
                          t.status === "refunded" || t.status === "cancelled"
                            ? "secondary"
                            : t.checkedIn
                              ? "outline"
                              : "default"
                        }
                      >
                        {t.checkedIn ? "admitted" : t.status}
                      </Badge>
                    </td>
                    <td className="py-2 text-xs text-gray-500 dark:text-gray-400">
                      {new Date(t.purchaseDate).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
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
