// Presentation helpers for the public cinema surface.
//
// Split out of public-cinema-types.ts, which is now types only — see the note
// there for why. Everything here is a pure function of its arguments, so it is
// safe in a server component and a client one alike.

import type { FeaturedMovie } from "./public-cinema-types";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

/**
 * A film's public URL: /cinema/{slug}-{shortId}.
 *
 * Mirrors buildEventUrl. The shortId is what identifies the film — the slug in
 * front is decoration — so a renamed film keeps working through old links.
 * Falls back to the raw id for any row written before slugs existed.
 */
export const buildMovieUrl = (movie: {
  slug?: string | null;
  shortId?: string | null;
  _id?: string | null;
}) => {
  if (movie.slug && movie.shortId) return `/cinema/${movie.slug}-${movie.shortId}`;
  return `/cinema/${movie._id}`;
};

/** Uploads are stored as relative paths; absolute URLs pass through unchanged. */
export const posterUrl = (poster?: string | null) => {
  if (!poster) return null;
  return poster.startsWith("http") ? poster : `${API_URL}${poster}`;
};

/**
 * "Today 19:30" / "Tomorrow 14:00" / "Sat 12 Oct, 19:30".
 *
 * Relative for the next two days because that is the window a customer is
 * usually deciding within; an absolute date after that, since "in 9 days" is
 * harder to act on than the date itself.
 */
export const showtimeLabel = (iso?: string | null) => {
  if (!iso) return "No screenings scheduled";
  const when = new Date(iso);
  const time = when.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round(
    (startOfDay(when) - startOfDay(new Date())) / 86400000
  );

  if (days === 0) return `Today ${time}`;
  if (days === 1) return `Tomorrow ${time}`;
  return `${when.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  })}, ${time}`;
};

export const runtimeLabel = (minutes?: number) => {
  if (!minutes || minutes < 1) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h ${m ? `${m}m` : ""}`.trim() : `${m}m`;
};


/**
 * A movie, expressed as the platform's featured-event card data.
 *
 * The cinema rows use the SAME card component as events (FeaturedEventCard)
 * rather than a lookalike, so the two never drift apart visually. That means
 * mapping a film onto the card's vocabulary rather than the card learning about
 * films — the card stays a presentation component that knows nothing about
 * either domain.
 *
 * The field mapping is the interesting part:
 *   tag           <- the cinema's name (an event card shows its category here)
 *   dateLabel     <- the next screening, or "Coming soon" when nothing is on
 *   locationLabel <- the cinema's city/address
 *   priceLabel    <- "from X ETB" when known, else the screening count
 */
export const movieToFeaturedCard = (
  movie: FeaturedMovie,
  fromPrice?: number | null
) => ({
  id: movie._id,
  href: buildMovieUrl(movie),
  title: movie.title,
  tag: movie.cinema?.name || "Cinema",
  dateLabel: movie.nextShowtime ? showtimeLabel(movie.nextShowtime) : "Coming soon",
  locationLabel:
    [movie.cinema?.city, movie.cinema?.address].filter(Boolean).join(", ") ||
    movie.cinema?.name ||
    "Cinema",
  priceLabel:
    typeof fromPrice === "number"
      ? `from ${fromPrice.toLocaleString()} ETB`
      : movie.upcomingCount > 0
        ? `${movie.upcomingCount} showing${movie.upcomingCount === 1 ? "" : "s"}`
        : "Coming soon",
  image: posterUrl(movie.poster) || "",
  // A film is never "sold out" at the listing level — individual screenings
  // are, and that belongs on the showtime picker in Phase 2.
  soldOut: false,
  ctaLabel: "Book",
});

/**
 * A movie, expressed as the banner carousel's event shape.
 *
 * Uses the landscape coverImage and falls back to the poster: the carousel is a
 * wide hero, and a 2:3 poster stretched into it looks broken — which is exactly
 * why CinemaMovie carries the two crops separately.
 */
export const movieToBannerEvent = (movie: FeaturedMovie) => ({
  id: movie._id,
  title: movie.title,
  description: movie.description || "",
  date: movie.nextShowtime ? showtimeLabel(movie.nextShowtime) : "Coming soon",
  startTime: "",
  endTime: "",
  location: movie.cinema?.city || movie.cinema?.name || "",
  venue: movie.cinema?.name || "",
  image: posterUrl(movie.coverImage) || posterUrl(movie.poster) || "",
  price: movie.upcomingCount > 0 ? "Book now" : "Coming soon",
  rating: 0,
  attendees: 0,
  categories: movie.genre?.length ? movie.genre : ["Cinema"],
  organization: movie.cinema?.name || "Cinema",
  originalEvent: {
    ...movie,
    // The carousel builds its link from the original record; giving it the
    // movie route keeps it out of the event URL builder.
    href: buildMovieUrl(movie),
  },
});


// --- One film's page ---------------------------------------------------





/** "Today" / "Tomorrow" / "Sat 12 Oct" for the day tabs. */
export const dayLabel = (yyyyMmDd: string) => {
  const d = new Date(`${yyyyMmDd}T00:00:00`);
  const startOfDay = (x: Date) =>
    new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOfDay(d) - startOfDay(new Date())) / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
};

export const clockLabel = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });


/**
 * A movie, expressed as the trending-row card shape.
 *
 * Lives here rather than inline in a page so the home page and the cinema page
 * describe a film the same way — the reason the featured and banner mappers are
 * here too.
 */
export const movieToTrendingCard = (movie: FeaturedMovie) => ({
  id: movie._id,
  href: buildMovieUrl(movie),
  title: movie.title,
  dateLabel: movie.nextShowtime ? showtimeLabel(movie.nextShowtime) : "Coming soon",
  locationLabel:
    [movie.cinema?.name, movie.cinema?.city].filter(Boolean).join(" · ") || "Cinema",
  attendeesLabel:
    movie.upcomingCount > 0
      ? `${movie.upcomingCount} showing${movie.upcomingCount === 1 ? "" : "s"}`
      : "Coming soon",
  priceLabel: movie.ageRating || "Cinema",
  image: posterUrl(movie.poster) || "",
  soldOut: false,
  ctaLabel: "Book",
});
