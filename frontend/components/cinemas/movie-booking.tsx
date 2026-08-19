"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Clock,
  Film,
  MapPin,
  Minus,
  Plus,
  PlayCircle,
  Ticket,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { clockLabel, dayLabel, posterUrl, runtimeLabel } from "./cinema-format";
import type { PublicMovieDetail, PublicShowtime } from "./public-cinema-types";

const money = (n: number, currency = "ETB") =>
  `${n.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency}`;

/**
 * The booking flow for one film: pick a day, pick a time, pick tickets.
 *
 * Quantities live here rather than on each tier so that changing the selected
 * screening can reset them — a basket built against the 14:00 show must not
 * silently carry over to the 20:00 one, where the tiers, prices and remaining
 * seats are all different rows.
 *
 * Nothing here computes a price the server will trust. The totals shown are a
 * preview for the customer; the amount actually charged is recomputed from the
 * showtime server-side, the same rule concessionBasketService follows — the
 * client says WHICH tier and how many, never what it costs.
 */
export default function MovieBooking({ detail }: { detail: PublicMovieDetail }) {
  const { movie, cinema, days, fromPrice } = detail;

  const [dayIndex, setDayIndex] = useState(0);
  const [showtimeId, setShowtimeId] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const day = days[dayIndex];
  const showtime: PublicShowtime | undefined = useMemo(
    () => day?.showtimes.find((s) => s._id === showtimeId),
    [day, showtimeId]
  );

  const selectShowtime = (id: string) => {
    setShowtimeId(id);
    // Reset: tier ids differ per screening, so carrying quantities across would
    // point at rows that do not exist on the new one.
    setQuantities({});
  };

  const selectDay = (index: number) => {
    setDayIndex(index);
    setShowtimeId(null);
    setQuantities({});
  };

  const setQty = (tierId: string, next: number, max: number) => {
    // Capped at what is actually left, so the UI cannot ask for seats the
    // server would reject — and never below zero.
    const clamped = Math.max(0, Math.min(next, max, 10));
    setQuantities((q) => ({ ...q, [tierId]: clamped }));
  };

  const lines = useMemo(() => {
    if (!showtime) return [];
    return showtime.ticketTypes
      .map((t) => ({ tier: t, qty: quantities[t._id] || 0 }))
      .filter((l) => l.qty > 0);
  }, [showtime, quantities]);

  const seatCount = lines.reduce((n, l) => n + l.qty, 0);
  const total = lines.reduce((n, l) => n + l.qty * l.tier.price, 0);
  const currency = showtime?.currency || "ETB";

  const poster = posterUrl(movie.poster);
  const cover = posterUrl(movie.coverImage) || poster;
  const runtime = runtimeLabel(movie.durationMinutes);

  return (
    <div className="min-h-screen bg-background">
      {/* Hero — the landscape cover, which is why the model keeps two crops. */}
      <div className="relative">
        <div className="relative h-56 w-full overflow-hidden bg-muted sm:h-72 md:h-80">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt="" aria-hidden className="h-full w-full object-cover" />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/20" />
        </div>

        <div className="container mx-auto max-w-6xl px-4">
          <Link
            href="/cinemas"
            className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1.5 text-sm text-white backdrop-blur transition-colors hover:bg-black/70 sm:left-8"
          >
            <ArrowLeft className="h-4 w-4" />
            Cinemas
          </Link>

          <div className="-mt-24 flex flex-col gap-5 sm:-mt-28 sm:flex-row sm:items-end">
            <div className="h-52 w-36 flex-shrink-0 overflow-hidden rounded-xl border border-border bg-muted shadow-xl sm:h-64 sm:w-44">
              {poster ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={poster} alt={movie.title} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <Film className="h-10 w-10 text-muted-foreground/40" />
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1 pb-2">
              <h1 className="font-display text-3xl font-bold text-foreground sm:text-4xl">
                {movie.title}
              </h1>
              <p className="mt-1 text-lg text-muted-foreground">
                <span className="text-primary dark:text-yellow-400">@</span>{" "}
                {cinema.name}
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {movie.ageRating && <Badge variant="secondary">{movie.ageRating}</Badge>}
                {runtime && <Badge variant="outline">{runtime}</Badge>}
                {movie.language && <Badge variant="outline">{movie.language}</Badge>}
                {movie.genre?.slice(0, 3).map((g) => (
                  <Badge key={g} variant="outline">{g}</Badge>
                ))}
                {typeof fromPrice === "number" && (
                  <Badge className="bg-indigo-600 hover:bg-indigo-600">
                    from {money(fromPrice)}
                  </Badge>
                )}
              </div>

              <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                {[cinema.address, cinema.city].filter(Boolean).join(", ") || cinema.name}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto max-w-6xl px-4 py-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            {(movie.description || movie.trailerUrl) && (
              <Card>
                <CardContent className="space-y-3 p-5">
                  {movie.description && (
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {movie.description}
                    </p>
                  )}
                  {movie.subtitles && (
                    <p className="text-xs text-muted-foreground">
                      Subtitles: {movie.subtitles}
                    </p>
                  )}
                  {movie.trailerUrl && (
                    <a
                      href={movie.trailerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                    >
                      <PlayCircle className="h-4 w-4" />
                      Watch trailer
                    </a>
                  )}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardContent className="p-5">
                <h2 className="mb-4 font-semibold text-foreground">Choose a screening</h2>

                {days.length === 0 ? (
                  <div className="py-10 text-center">
                    <Clock className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">
                      No screenings scheduled right now. Check back soon.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Days */}
                    <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
                      {days.map((d, i) => (
                        <button
                          key={d.date}
                          onClick={() => selectDay(i)}
                          className={`flex-shrink-0 rounded-lg border px-4 py-2 text-sm transition-colors ${
                            i === dayIndex
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                          }`}
                        >
                          <span className="font-medium">{dayLabel(d.date)}</span>
                          <span className="ml-1.5 text-xs opacity-70">
                            {d.showtimes.length}
                          </span>
                        </button>
                      ))}
                    </div>

                    {/* Times */}
                    <div className="flex flex-wrap gap-2">
                      {day?.showtimes.map((s) => {
                        const selected = s._id === showtimeId;
                        return (
                          <button
                            key={s._id}
                            disabled={s.soldOut}
                            onClick={() => selectShowtime(s._id)}
                            className={`rounded-lg border px-4 py-2.5 text-left transition-colors ${
                              s.soldOut
                                ? "cursor-not-allowed border-border bg-muted/50 opacity-50"
                                : selected
                                  ? "border-primary bg-primary/10"
                                  : "border-border hover:border-primary/50"
                            }`}
                          >
                            <span className="block font-mono text-sm font-semibold tabular-nums text-foreground">
                              {clockLabel(s.startsAt)}
                            </span>
                            <span className="block text-xs text-muted-foreground">
                              {s.soldOut ? "Sold out" : s.hall?.name}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Tickets — only once a screening is chosen, because prices and
                availability belong to the screening, not the film. */}
            {showtime && (
              <Card>
                <CardContent className="p-5">
                  <h2 className="mb-1 font-semibold text-foreground">Tickets</h2>
                  <p className="mb-4 text-sm text-muted-foreground">
                    {dayLabel(day.date)} at {clockLabel(showtime.startsAt)}
                    {showtime.hall?.name ? ` · ${showtime.hall.name}` : ""}
                  </p>

                  <div className="space-y-3">
                    {showtime.ticketTypes.map((tier) => {
                      const qty = quantities[tier._id] || 0;
                      const out = tier.seatsRemaining === 0;
                      return (
                        <div
                          key={tier._id}
                          className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
                        >
                          <div className="min-w-0">
                            <p className="font-medium text-foreground">{tier.name}</p>
                            {tier.description && (
                              <p className="text-xs text-muted-foreground">
                                {tier.description}
                              </p>
                            )}
                            <p className="text-sm text-muted-foreground">
                              {money(tier.price, showtime.currency)}
                              {out ? (
                                <span className="ml-2 text-destructive">Sold out</span>
                              ) : tier.seatsRemaining <= 10 ? (
                                <span className="ml-2 text-amber-600 dark:text-amber-400">
                                  Only {tier.seatsRemaining} left
                                </span>
                              ) : null}
                            </p>
                          </div>

                          <div className="flex flex-shrink-0 items-center gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              disabled={qty === 0}
                              onClick={() => setQty(tier._id, qty - 1, tier.seatsRemaining)}
                              aria-label={`Fewer ${tier.name}`}
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </Button>
                            <span className="w-6 text-center font-medium tabular-nums">
                              {qty}
                            </span>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              disabled={out || qty >= Math.min(tier.seatsRemaining, 10)}
                              onClick={() => setQty(tier._id, qty + 1, tier.seatsRemaining)}
                              aria-label={`More ${tier.name}`}
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Summary */}
          <div className="lg:sticky lg:top-6 lg:self-start">
            <Card>
              <CardContent className="p-5">
                <h2 className="mb-4 flex items-center gap-2 font-semibold text-foreground">
                  <Ticket className="h-4 w-4 text-primary" />
                  Your order
                </h2>

                {!showtime ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    Pick a day and a time to see tickets.
                  </p>
                ) : lines.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    Choose how many tickets you want.
                  </p>
                ) : (
                  <>
                    <div className="mb-3 rounded-lg bg-muted/50 p-3 text-sm">
                      <p className="font-medium text-foreground">{movie.title}</p>
                      <p className="text-muted-foreground">
                        {cinema.name}
                        {showtime.hall?.name ? ` · ${showtime.hall.name}` : ""}
                      </p>
                      <p className="text-muted-foreground">
                        {dayLabel(day.date)}, {clockLabel(showtime.startsAt)}
                      </p>
                    </div>

                    <ul className="space-y-2 text-sm">
                      {lines.map(({ tier, qty }) => (
                        <li key={tier._id} className="flex justify-between gap-2">
                          <span className="text-muted-foreground">
                            {qty} × {tier.name}
                          </span>
                          <span className="tabular-nums text-foreground">
                            {money(qty * tier.price, currency)}
                          </span>
                        </li>
                      ))}
                    </ul>

                    <div className="mt-3 flex justify-between border-t border-border pt-3 font-semibold">
                      <span className="text-foreground">
                        Total · {seatCount} {seatCount === 1 ? "seat" : "seats"}
                      </span>
                      <span className="tabular-nums text-foreground">
                        {money(total, currency)}
                      </span>
                    </div>
                  </>
                )}

                {/* Checkout is Phase 2. Disabled rather than hidden so the flow
                    reads end to end, and labelled honestly rather than
                    pretending to be a working button. */}
                <Button className="mt-4 w-full" size="lg" disabled>
                  {lines.length === 0 ? "Select tickets" : "Checkout coming soon"}
                </Button>
                {lines.length > 0 && (
                  <p className="mt-2 text-center text-xs text-muted-foreground">
                    Online payment for cinema tickets is being set up.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
