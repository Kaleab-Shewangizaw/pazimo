"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import {
  Calendar,
  Clock,
  Film,
  MapPin,
  PlayCircle,
  Share2,
  Ticket,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { clockLabel, dayLabel, posterUrl, runtimeLabel, youtubeVideoId } from "./cinema-format";
import BookingFlow from "./booking-flow";
import TrailerPlayer from "./trailer-player";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PublicMovieDetail, PublicShowtime } from "./public-cinema-types";

const money = (n: number, currency = "ETB") =>
  `${n.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency}`;

/**
 * One film, laid out as the event detail page lays out an event.
 *
 * The two are the same kind of page — an image, what it is, and a panel you buy
 * from — so they share a structure rather than each inventing one: full-bleed
 * hero with the title over it, a meta row of icon facts, then a two-thirds
 * column of description beside a sticky bordered card. A customer who has
 * bought an event ticket already knows how to read this.
 *
 * The film's two crops earn their keep here. The landscape cover fills the
 * desktop hero, where a 2:3 poster would letterbox; the portrait poster is what
 * mobile shows, where the wide crop would be a stripe. The event page has only
 * one image and has to use it for both.
 */
export default function MovieBooking({ detail }: { detail: PublicMovieDetail }) {
  const { movie, cinema, days, fromPrice } = detail;

  const [dayIndex, setDayIndex] = useState(0);
  const [showtimeId, setShowtimeId] = useState<string | null>(null);
  const [booking, setBooking] = useState(false);

  const day = days[dayIndex];

  // The chosen screening — or the only one there is. A day with a single
  // showtime has no choice to make, so asking for a click before the button
  // works is friction that buys nothing.
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
  const cinemaLogo = posterUrl(cinema.image);
  const runtime = runtimeLabel(movie.durationMinutes);
  const hasScreenings = days.some((d) => d.showtimes.length > 0);
  const address = [cinema.address, cinema.city].filter(Boolean).join(", ");
  const trailerVideoId = youtubeVideoId(movie.trailerUrl);

  const details = [
    { label: "Runtime", value: runtime },
    { label: "Rating", value: movie.ageRating },
    { label: "Language", value: movie.language },
    { label: "Subtitles", value: movie.subtitles },
    { label: "Genre", value: movie.genre?.join(", ") },
    {
      label: "Screenings",
      value: hasScreenings
        ? `${days.reduce((n, d) => n + d.showtimes.length, 0)} upcoming`
        : undefined,
    },
  ].filter((d): d is { label: string; value: string } => Boolean(d.value));

  const share = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (navigator.share) {
        await navigator.share({ title: movie.title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      // A cancelled share sheet rejects too — nothing to report.
    }
  };

  // The booking panel is identical on both layouts, so it is written once.
  const bookingPanel = (
    <div className="space-y-5">
      {!hasScreenings ? (
        <div className="rounded-xl border border-gray-200 py-10 text-center dark:border-white/10">
          <Clock className="mx-auto mb-3 h-6 w-6 text-gray-400 dark:text-gray-600" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Nothing scheduled yet. Check back soon.
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Select a day:
            </h3>
            <div className="flex flex-wrap gap-2">
              {days.map((d, i) => (
                <Button
                  key={d.date}
                  type="button"
                  variant={i === dayIndex ? "default" : "outline"}
                  onClick={() => selectDay(i)}
                  className={`flex-1 ${
                    i === dayIndex
                      ? "bg-[#0D47A1] hover:bg-[#0D47A1]/90 dark:bg-yellow-400 dark:text-black"
                      : ""
                  }`}
                >
                  {dayLabel(d.date)}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Select a time:
            </h3>
            {day?.showtimes.length ? (
              <div className="grid grid-cols-2 gap-2">
                {day.showtimes.map((s) => {
                  // Reads the resolved showtime, not the raw id, so a single
                  // screening chosen for the customer still looks chosen.
                  const selected = s._id === showtime?._id;
                  return (
                    <button
                      key={s._id}
                      disabled={s.soldOut}
                      onClick={() => setShowtimeId(s._id)}
                      aria-pressed={selected}
                      className={`rounded-lg border p-3 text-left transition-colors ${
                        s.soldOut
                          ? "cursor-not-allowed border-gray-200 opacity-40 dark:border-white/10"
                          : selected
                            ? "border-[#0D47A1] bg-[#0D47A1]/5 dark:border-yellow-400 dark:bg-yellow-400/10"
                            : "border-gray-200 hover:border-gray-400 dark:border-white/10 dark:hover:border-white/30"
                      }`}
                    >
                      <span className="block text-base font-semibold tabular-nums text-gray-900 dark:text-white">
                        {clockLabel(s.startsAt)}
                      </span>
                      <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
                        {s.soldOut ? "Sold out" : s.hall?.name || "Screen"}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No screenings on {dayLabel(day.date)}.
              </p>
            )}
          </div>

          {showtime && showtime.ticketTypes.length > 0 && (
            <div className="space-y-2 border-t border-gray-200 pt-4 dark:border-white/10">
              {showtime.ticketTypes.map((tier) => (
                <div
                  key={tier._id}
                  className="flex items-baseline justify-between gap-3"
                >
                  <span className="min-w-0 truncate text-sm text-gray-700 dark:text-gray-300">
                    {tier.name}
                  </span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-gray-900 dark:text-white">
                    {money(tier.price, currency)}
                  </span>
                </div>
              ))}
              <p className="pt-1 text-xs text-gray-500 dark:text-gray-400">
                The seat you pick sets the price.
              </p>
            </div>
          )}

          <Button
            size="lg"
            disabled={!showtime}
            onClick={() => setBooking(true)}
            className="w-full bg-[#0D47A1] hover:bg-[#0D47A1]/90 dark:bg-yellow-400 dark:text-black dark:hover:bg-yellow-400/90"
          >
            {showtime ? "Choose seats" : "Select a time"}
          </Button>
        </>
      )}
    </div>
  );

  // Three blocks of content, written once and read twice: stacked in a column
  // on a desktop, split across the bottom tabs on a phone. The event page keeps
  // two copies of its content and they have drifted apart; this keeps one.
  const trailerSection = trailerVideoId ? (
    <div>
      <h2 className="mb-4 text-xl font-bold text-gray-900 dark:text-white md:text-2xl">
        Trailer
      </h2>
      <TrailerPlayer videoId={trailerVideoId} title={movie.title} />
    </div>
  ) : null;

  const aboutSection = movie.description ? (
    <div>
      <h2 className="mb-4 text-xl font-bold text-gray-900 dark:text-white md:text-2xl">
        About This Film
      </h2>
      <div className="space-y-4 leading-relaxed text-gray-600 dark:text-gray-400">
        <p className="whitespace-pre-line">{movie.description}</p>
      </div>
      {movie.subtitles && (
        <p className="mt-3 text-sm text-gray-500 dark:text-gray-500">
          Subtitles · {movie.subtitles}
        </p>
      )}
      {/* A trailer link is only shown here as a fallback — a recognised
          YouTube link gets the full player in trailerSection instead, so this
          would otherwise be a second, redundant way to reach the same video. */}
      {movie.trailerUrl && !trailerVideoId && (
        <a
          href={movie.trailerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 flex items-center gap-1 text-sm font-medium text-[#0D47A1] hover:underline dark:text-blue-400"
        >
          <PlayCircle className="h-4 w-4" />
          Watch trailer
        </a>
      )}
    </div>
  ) : null;

  // Always present, unlike the description, so the column is never a single
  // card floating beside a full panel. These are the questions a customer
  // actually asks about a screening — how long, what rating, what language,
  // subtitled or not.
  const detailsSection = details.length > 0 ? (
    <div>
      <h2 className="mb-4 text-xl font-bold text-gray-900 dark:text-white md:text-2xl">
        Details
      </h2>
      <dl className="grid grid-cols-1 gap-x-10 gap-y-3 sm:grid-cols-2">
        {details.map(({ label, value }) => (
          <div
            key={label}
            className="flex items-baseline justify-between gap-4 border-b border-gray-200 pb-3 dark:border-white/10"
          >
            <dt className="text-sm text-gray-500 dark:text-gray-400">{label}</dt>
            <dd className="text-right text-sm font-medium text-gray-900 dark:text-white">
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  ) : null;

  const cinemaSection = (
    <div>
      <h2 className="mb-4 text-xl font-bold text-gray-900 dark:text-white md:text-2xl">
        Cinema
      </h2>
      <div className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#1A1D24]">
        {/* The cinema's own logo where it has one — the site's identity, not
            ours, is what should greet a customer here. Falls back to initials
            on the brand accent, which is what this always showed. */}
        {cinemaLogo ? (
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full ring-1 ring-gray-200 dark:ring-white/10">
            <Image src={cinemaLogo} alt={cinema.name} fill className="object-cover" sizes="48px" />
          </div>
        ) : (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#0D47A1] text-lg font-bold text-white dark:bg-yellow-400 dark:text-black">
            {cinema.name.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate font-semibold text-gray-900 dark:text-white">
            {cinema.name}
          </p>
          <p className="truncate text-sm text-gray-500 dark:text-gray-400">
            {address || "Cinema"}
          </p>
        </div>
      </div>
    </div>
  );

  const ticketsCard = (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-md transition-colors dark:border-white/10 dark:bg-[#1A1D24] md:p-6">
      <div className="mb-6 flex items-baseline justify-between gap-3">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          Select Tickets
        </h2>
        {/* The entry price, before a screening is chosen. It is the first
            thing anyone wants from this panel and the seat picker is two
            clicks away, so withholding it until then makes people guess. */}
        {typeof fromPrice === "number" && (
          <span className="shrink-0 text-sm text-gray-500 dark:text-gray-400">
            from{" "}
            <span className="font-semibold text-gray-900 dark:text-white">
              {money(fromPrice)}
            </span>
          </span>
        )}
      </div>
      {bookingPanel}
    </div>
  );

  return (
    // The layout parks a 48px spacer under the header to keep ordinary pages
    // clear of it. This page does not want it: the header is transparent and
    // fixed, and the backdrop is meant to run all the way to the top edge
    // behind it — the same trick, and the same numbers, as the event page.
    <div className="-mt-1 min-h-screen bg-white transition-colors duration-300 dark:bg-[#0A0A0A] md:-mt-12">
      {/* ── Hero (desktop) ── */}
      <section className="relative hidden bg-gray-300 transition-colors dark:bg-[#1A1D24] md:block">
        <div className="relative mx-auto h-[50vh] min-h-[420px] w-full overflow-hidden bg-gray-600 dark:bg-[#0A0A0A] md:h-[88vh]">
          {cover ? (
            <Image
              src={cover}
              alt={`${movie.title} — banner`}
              fill
              className="object-cover"
              priority
              sizes="100vw"
              quality={90}
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <Film className="h-12 w-12 text-white/20" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-white via-white/30 to-transparent dark:from-[#0A0A0A] dark:via-[#0A0A0A]/40" />
        </div>

        <div className="absolute bottom-0 left-0 right-0 z-10 px-5 pb-6 md:px-10 md:pb-10 lg:px-16 lg:pb-14">
          <h1 className="mb-3 text-2xl font-bold leading-tight text-black dark:text-white sm:text-4xl md:text-5xl lg:text-6xl">
            {movie.title}
          </h1>
          <div className="flex flex-wrap items-center gap-3 text-sm text-black/90 dark:text-white/90 md:gap-5">
            <span className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4 shrink-0 text-blue-300 dark:text-blue-400" />
              {cinema.name}
              {address ? `, ${address}` : ""}
            </span>
            {runtime && (
              <span className="flex items-center gap-1.5">
                <Clock className="h-4 w-4 shrink-0 text-blue-300 dark:text-blue-400" />
                {runtime}
              </span>
            )}
            {movie.ageRating && (
              <span className="flex items-center gap-1.5">
                <UserCheck className="h-4 w-4 shrink-0 text-blue-300 dark:text-blue-400" />
                {movie.ageRating}
              </span>
            )}
            {movie.language && (
              <span className="flex items-center gap-1.5">
                <Film className="h-4 w-4 shrink-0 text-blue-300 dark:text-blue-400" />
                {movie.language}
              </span>
            )}
          </div>
        </div>

        <div className="absolute bottom-10 right-4 z-10 flex items-center gap-2 md:right-10">
          <button
            onClick={share}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/30 backdrop-blur-sm transition-colors hover:bg-black/50 dark:hover:bg-white/10"
            aria-label="Share this film"
          >
            <Share2 className="h-4 w-4 text-white" />
          </button>
        </div>
      </section>

      {/* ── Hero (mobile) ── */}
      {/* The portrait poster in a contained card, the way the event page shows
          its banner on a phone: a full-bleed landscape crop at this width is a
          stripe, and the poster is the film's own designed identity. */}
      <div className="px-4 pt-4 md:hidden">
        <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-gray-200 shadow-md dark:bg-[#1A1D24]">
          {poster ? (
            <Image
              src={poster}
              alt={movie.title}
              fill
              className="object-cover"
              priority
              sizes="100vw"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <Film className="h-10 w-10 text-gray-400" />
            </div>
          )}
        </div>

        <div className="mt-4 flex items-start justify-between gap-3">
          <h1 className="text-xl font-bold leading-tight text-gray-900 dark:text-white">
            {movie.title}
          </h1>
          <button
            onClick={share}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white transition-colors hover:bg-gray-50 dark:border-white/10 dark:bg-[#1A1D24] dark:hover:bg-white/5"
            aria-label="Share this film"
          >
            <Share2 className="h-4 w-4 text-gray-700 dark:text-white" />
          </button>
        </div>

        <div className="mt-4 space-y-2 text-sm">
          <p className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-blue-500 dark:text-blue-400" />
            <span>
              <span className="font-medium text-[#0D47A1] dark:text-blue-400">
                {cinema.name}
              </span>
              {address && (
                <span className="block text-gray-500 dark:text-gray-400">{address}</span>
              )}
            </span>
          </p>
          {(runtime || movie.ageRating || movie.language) && (
            <p className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
              <Clock className="h-4 w-4 shrink-0 text-gray-400" />
              {[runtime, movie.ageRating, movie.language].filter(Boolean).join(" · ")}
            </p>
          )}
          {showtime && (
            <p className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
              <Calendar className="h-4 w-4 shrink-0 text-gray-400" />
              {dayLabel(day.date)}, {clockLabel(showtime.startsAt)}
            </p>
          )}
        </div>
      </div>

      {/* ── Content (desktop) ── */}
      <section className="hidden py-16 md:block">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-3 lg:gap-14">
            <div className="space-y-12 lg:col-span-2">
              {trailerSection}
              {aboutSection}
              {detailsSection}
              {cinemaSection}
            </div>

            <div className="lg:col-span-1">
              <div className="lg:sticky lg:top-6">{ticketsCard}</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Content (mobile) ── */}
      {/* A phone gets the same three tabs the event page gets, in the same bar
          at the same height, because it is the same decision being made: buy,
          read about it, or find out where it is. Tickets opens first — the
          customer arrived from a poster, not from a synopsis. */}
      <div className="mx-auto max-w-7xl px-4 py-6 md:hidden">
        <Tabs defaultValue="tickets" className="w-full">
          <TabsList className="fixed bottom-0 left-0 right-0 z-30 flex h-14 w-full justify-around rounded-none border-t border-gray-200 bg-white p-0 dark:border-white/10 dark:bg-[#1A1D24]">
            {(
              [
                ["tickets", "Tickets", Ticket],
                ["about", "About", Film],
                ["cinema", "Cinema", MapPin],
              ] as const
            ).map(([value, label, Icon]) => (
              <TabsTrigger
                key={value}
                value={value}
                className="flex h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-none px-0 text-xs text-gray-600 dark:text-gray-400 data-[state=active]:border-t-2 data-[state=active]:border-[#0D47A1] data-[state=active]:bg-blue-50 data-[state=active]:text-[#0D47A1] dark:data-[state=active]:border-yellow-400 dark:data-[state=active]:bg-yellow-400/10 dark:data-[state=active]:text-yellow-400"
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="pb-20">
            <TabsContent value="tickets" className="mt-0">
              {ticketsCard}
            </TabsContent>
            <TabsContent value="about" className="mt-0 space-y-10">
              {trailerSection}
              {aboutSection || (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No synopsis yet for this film.
                </p>
              )}
              {detailsSection}
            </TabsContent>
            <TabsContent value="cinema" className="mt-0">
              {cinemaSection}
            </TabsContent>
          </div>
        </Tabs>
      </div>

      <Dialog open={booking} onOpenChange={setBooking}>
        {/* A sheet that owns the whole screen on a phone, a framed panel on a
            desktop. Either way the header and the price bar stay put and only
            the room scrolls, so the way forward is never scrolled off. */}
        <DialogContent className="flex h-[100dvh] max-h-[100dvh] w-full max-w-none flex-col gap-0 overflow-hidden rounded-none border-0 p-0 sm:h-auto sm:max-h-[90vh] sm:max-w-3xl sm:rounded-2xl sm:border">
          <DialogHeader className="shrink-0 space-y-0.5 border-b border-border px-4 py-4 text-left sm:px-6">
            <DialogTitle className="pr-8 text-base font-semibold sm:text-lg">
              {movie.title}
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
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
