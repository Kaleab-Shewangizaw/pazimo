"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Clock, Film, MapPin, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { clockLabel, dayLabel, posterUrl, runtimeLabel } from "./cinema-format";
import BookingFlow from "./booking-flow";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PublicMovieDetail, PublicShowtime } from "./public-cinema-types";

const money = (n: number, currency = "ETB") =>
  `${n.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency}`;

/**
 * One film, and the path to a seat.
 *
 * THE PAGE HAS ONE JOB — get someone from "I want to see this" to "I have a
 * seat" — and the layout says so: a hero that is mostly the film's own artwork,
 * one column of decisions in the order they are made (which day, which time),
 * and a commit button that is always reachable.
 *
 * WHY THE ARTWORK CARRIES THE COLOUR
 *
 * A film already has a designed identity, so the page borrows it rather than
 * competing: the landscape cover is blurred and scaled behind the hero like the
 * light spill off a projector, and the poster sits crisp in front of it. Every
 * film's page therefore looks different without a single per-film rule, and the
 * page's own palette stays neutral so it never fights the poster.
 *
 * WHY THERE ARE ALMOST NO CARDS
 *
 * This was four stacked cards of identical weight — synopsis, screenings,
 * prices, order — which flattens everything to the same importance and is what
 * made it read as generated. Structure now comes from rules, spacing and type
 * scale. A card is used only where something IS a discrete object you choose
 * between: the time tiles.
 *
 * THE HEADER
 *
 * The site header is `fixed` and transparent on mobile and `md:relative` on
 * desktop. A fixed top margin was wrong in both: it double-spaced desktop,
 * where the header already takes its own room, and wasted the transparency on
 * mobile. The hero is full-bleed and runs underneath it; only the hero's inner
 * content is padded, and only on mobile.
 */
export default function MovieBooking({ detail }: { detail: PublicMovieDetail }) {
  const { movie, cinema, days, fromPrice } = detail;

  const [dayIndex, setDayIndex] = useState(0);
  const [showtimeId, setShowtimeId] = useState<string | null>(null);
  const [booking, setBooking] = useState(false);

  const day = days[dayIndex];

  // The chosen screening — or the only one there is.
  //
  // A day with a single showtime has no choice to make, so asking for a click
  // before the button will work is friction that buys nothing: the customer
  // sees one time, a disabled button, and no explanation of what connects them.
  // Selecting it outright is what they were going to do anyway.
  const showtime: PublicShowtime | undefined = useMemo(() => {
    const bookable = (day?.showtimes || []).filter((s) => !s.soldOut);
    if (showtimeId) return bookable.find((s) => s._id === showtimeId);
    return bookable.length === 1 ? bookable[0] : undefined;
  }, [day, showtimeId]);

  const selectDay = (index: number) => {
    setDayIndex(index);
    setShowtimeId(null);
  };

  const currency = showtime?.currency || "ETB";
  const poster = posterUrl(movie.poster);
  const cover = posterUrl(movie.coverImage) || poster;
  const runtime = runtimeLabel(movie.durationMinutes);

  // The one line under the title. Joined from what exists rather than rendered
  // as a row of badges: six outline pills was noise, and none of them was more
  // important than the others.
  const facts = [movie.ageRating, runtime, movie.language, movie.genre?.[0]]
    .filter(Boolean)
    .join("  ·  ");

  const hasScreenings = days.some((d) => d.showtimes.length > 0);

  return (
    <div className="bg-background">
      {/* ---------------------------------------------------------------- */}
      {/* Hero                                                             */}
      {/* ---------------------------------------------------------------- */}
      <header className="relative isolate overflow-hidden">
        {/* The film's own cover, blurred and oversized. `scale-110` hides the
            blur's soft edge; without it the backdrop shows a pale halo at the
            viewport edges. aria-hidden because it carries no information the
            poster and title do not already give. */}
        {cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full scale-125 object-cover opacity-70 blur-3xl saturate-150 dark:opacity-60"
          />
        )}

        {/* One scrim, and only enough of it.
            The first pass stacked a flat 70-80% wash under a full-height
            gradient, which took the artwork to near-black and lost the whole
            point of using it. Now the flat layer is light — just enough for
            text contrast — and the gradient does its work only at the bottom
            edge, where the hero has to meet the page. */}
        <div className="absolute inset-0 bg-background/55 dark:bg-background/45" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background to-transparent" />

        <div className="relative mx-auto max-w-5xl px-4 pb-10 pt-24 sm:px-6 md:pb-14 md:pt-12">
          <Link
            href="/cinemas"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            All cinemas
          </Link>

          <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-end sm:gap-8">
            {/* Poster. A fixed 2:3 box so a wrongly-cropped upload cannot
                distort the layout, and a ring rather than a border so it reads
                as a printed object rather than a UI panel. */}
            <div className="w-36 shrink-0 sm:w-44 md:w-52">
              <div className="aspect-[2/3] overflow-hidden rounded-xl bg-muted shadow-2xl ring-1 ring-black/10 dark:ring-white/10">
                {poster ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={poster}
                    alt={movie.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <Film className="h-8 w-8 text-muted-foreground/30" />
                  </div>
                )}
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                {movie.status === "coming_soon" ? "Coming soon" : "Now showing"}
              </p>

              <h1 className="mt-2 text-balance font-display text-4xl font-bold leading-[1.05] tracking-tight text-foreground sm:text-5xl md:text-6xl">
                {movie.title}
              </h1>

              {facts && (
                <p className="mt-3 text-sm text-muted-foreground">{facts}</p>
              )}

              <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                <span className="font-medium text-foreground">{cinema.name}</span>
                {[cinema.address, cinema.city].filter(Boolean).length > 0 && (
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    {[cinema.address, cinema.city].filter(Boolean).join(", ")}
                  </span>
                )}
                {movie.trailerUrl && (
                  <a
                    href={movie.trailerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 font-medium text-primary hover:underline"
                  >
                    <PlayCircle className="h-4 w-4" />
                    Trailer
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ---------------------------------------------------------------- */}
      {/* Body                                                             */}
      {/* ---------------------------------------------------------------- */}
      <main className="mx-auto max-w-5xl px-4 pb-28 sm:px-6 md:pb-0">
        {movie.description && (
          <section className="border-b border-border/60 pb-8">
            <p className="max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
              {movie.description}
            </p>
            {movie.subtitles && (
              <p className="mt-3 text-xs text-muted-foreground/70">
                Subtitles · {movie.subtitles}
              </p>
            )}
          </section>
        )}

        <section className="pt-8">
          <h2 className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Pick a time
          </h2>

          {!hasScreenings ? (
            <div className="mt-6 rounded-xl border border-dashed border-border py-16 text-center">
              <Clock className="mx-auto mb-3 h-6 w-6 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                Nothing scheduled yet. Check back soon.
              </p>
            </div>
          ) : (
            <>
              {/* Day rail. Underline rather than filled pills: this is a filter
                  above the times, not a set of equal choices beside them, and
                  an underline says "you are here" without competing with the
                  time tiles below for weight. */}
              <div className="mt-4 -mx-4 flex gap-1 overflow-x-auto border-b border-border/60 px-4 sm:mx-0 sm:px-0">
                {days.map((d, i) => {
                  const active = i === dayIndex;
                  return (
                    <button
                      key={d.date}
                      onClick={() => selectDay(i)}
                      className={`shrink-0 border-b-2 px-4 py-3 text-sm transition-colors ${
                        active
                          ? "border-primary font-semibold text-foreground"
                          : "border-transparent text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {dayLabel(d.date)}
                      <span className="ml-1.5 text-xs tabular-nums opacity-60">
                        {d.showtimes.length}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Times. The one place a card is right: each is a discrete
                  object you choose between, and the clock face is the thing
                  being compared, so it gets the size and the tabular figures. */}
              {/* A wrapping row rather than a fixed grid: a cinema with one
                  screening left should not get a single tile stranded in a
                  four-column layout with three empty cells beside it. */}
              {day?.showtimes.length ? (
                <div className="mt-6 flex flex-wrap gap-2.5">
                  {day.showtimes.map((s) => {
                    // Reads from the resolved showtime, not the raw id, so an
                    // auto-selected single screening looks selected too.
                    const selected = s._id === showtime?._id;
                    return (
                      <button
                        key={s._id}
                        disabled={s.soldOut}
                        onClick={() => setShowtimeId(s._id)}
                        aria-pressed={selected}
                        className={`group relative min-w-[9.5rem] flex-1 rounded-xl border p-4 text-left transition-all sm:max-w-[13rem] sm:flex-none ${
                          s.soldOut
                            ? "cursor-not-allowed border-border/60 opacity-40"
                            : selected
                              ? "border-primary bg-primary/5 ring-1 ring-primary"
                              : "border-border hover:border-foreground/30 hover:bg-muted/40"
                        }`}
                      >
                        <span className="block text-2xl font-semibold tabular-nums tracking-tight text-foreground">
                          {clockLabel(s.startsAt)}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                          {s.soldOut ? "Sold out" : s.hall?.name || "Screen"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-6 text-sm text-muted-foreground">
                  No screenings on {dayLabel(day.date)}.
                </p>
              )}
            </>
          )}
        </section>

        {/* Prices, once a screening is chosen. A plain definition list rather
            than a card: it is reference, not a decision — the seat picker is
            where the choice happens. */}
        {showtime && showtime.ticketTypes.length > 0 && (
          <section className="mt-10 border-t border-border/60 pt-8">
            <h2 className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Prices
            </h2>
            <dl className="mt-4 max-w-md divide-y divide-border/60">
              {showtime.ticketTypes.map((tier) => (
                <div key={tier._id} className="flex items-baseline justify-between gap-4 py-3">
                  <dt className="min-w-0">
                    <span className="block truncate text-sm text-foreground">{tier.name}</span>
                    {tier.description && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {tier.description}
                      </span>
                    )}
                  </dt>
                  <dd className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                    {money(tier.price, currency)}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-xs text-muted-foreground">
              The seat you pick sets the price.
            </p>
          </section>
        )}
      </main>

      {/* ---------------------------------------------------------------- */}
      {/* Commit                                                           */}
      {/* ---------------------------------------------------------------- */}
      {/* Fixed on mobile, where the decisions above can run past a screen and
          the page's one action must never scroll away. Static on desktop,
          where it does not need to float over anything. */}
      {hasScreenings && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-4 py-3 backdrop-blur-xl md:static md:mx-auto md:my-10 md:max-w-5xl md:border-0 md:bg-transparent md:px-6 md:py-0 md:backdrop-blur-none">
          <div className="mx-auto flex max-w-5xl items-center gap-4 md:px-0">
            {/* On a phone the bar is split: what you are buying on the left,
                the action on the right. The button said the price too, which on
                a 390px screen squeezed the left side until the time truncated —
                two halves competing to say the same thing. */}
            <div className="min-w-0 flex-1 md:hidden">
              <p className="truncate text-sm font-medium text-foreground">
                {showtime
                  ? `${dayLabel(day.date)} · ${clockLabel(showtime.startsAt)}`
                  : "Pick a time"}
              </p>
              {typeof fromPrice === "number" && (
                <p className="text-xs text-muted-foreground">
                  from {money(fromPrice)}
                </p>
              )}
            </div>

            <Button
              size="lg"
              disabled={!showtime}
              onClick={() => setBooking(true)}
              className="shrink-0 md:min-w-[16rem]"
            >
              <span className="md:hidden">
                {showtime ? "Choose seats" : "Pick a time"}
              </span>
              <span className="hidden md:inline">
                {showtime
                  ? `Choose seats${typeof fromPrice === "number" ? ` · from ${money(fromPrice)}` : ""}`
                  : "Pick a time first"}
              </span>
            </Button>
          </div>
        </div>
      )}

      <Dialog open={booking} onOpenChange={setBooking}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{movie.title}</DialogTitle>
            <DialogDescription>
              {showtime
                ? `${dayLabel(day.date)} · ${clockLabel(showtime.startsAt)}${
                    showtime.hall?.name ? ` · ${showtime.hall.name}` : ""
                  }`
                : ""}
            </DialogDescription>
          </DialogHeader>
          {showtime && (
            <BookingFlow
              // Keyed by screening: opening a different one must start from ITS
              // room and its prices, not from the last one's selection.
              key={showtime._id}
              showtimeId={showtime._id}
              cinemaId={cinema._id}
              onClose={() => setBooking(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
