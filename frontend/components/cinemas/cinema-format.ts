// Presentation helpers for the public cinema surface.
//
// Split out of public-cinema-types.ts, which is now types only — see the note
// there for why. Everything here is a pure function of its arguments, so it is
// safe in a server component and a client one alike.

import type { CinemaMovieCard, FeaturedMovie } from "./public-cinema-types";

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
 * The 11-character id out of whatever shape of YouTube URL a cinema pasted in
 * — watch?v=, youtu.be/, embed/, shorts/, with or without extra query params.
 *
 * `trailerUrl` also accepts Vimeo links and direct files (see CinemaMovie), so
 * this returns null rather than throwing on anything that isn't recognisably
 * YouTube — the caller falls back to a plain "Watch trailer" link for those,
 * rather than a video player with nothing to play.
 */
export const youtubeVideoId = (url?: string | null): string | null => {
  if (!url) return null;
  const trimmed = url.trim();
  const patterns = [
    /(?:youtube(?:-nocookie)?\.com\/(?:watch\?v=|embed\/|shorts\/|v\/)|youtu\.be\/)([\w-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match) return match[1];
  }
  return null;
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
 * A plain number ("13") reads as a minimum age, not a rating, without the
 * "+" — legacy free-text certificates (e.g. "PG-13", "NR") pass through
 * unchanged, since CinemaMovie.ageRating is still free text underneath.
 */
export const ageRatingLabel = (rating?: string | null) =>
  rating ? (/^\d+$/.test(rating) ? `${rating}+` : rating) : null;


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
 * A cinema's own "now showing" film, expressed as the same featured-event
 * card data movieToFeaturedCard produces for the promoted rows — so a film
 * looks like the exact same object whether it is on a cinema's own listing
 * grid or in one of the curated rows above it, and both are just the one
 * FeaturedEventCard component.
 *
 * Takes the cinema separately rather than expecting it on the movie, because
 * `listPublicMovies` (what feeds a cinema's own page) does not repeat the
 * cinema on every film the way the cross-cinema rows do — the page already
 * knows which cinema this is.
 */
export const cinemaMovieToFeaturedCard = (
  movie: CinemaMovieCard,
  cinema?: { name?: string; city?: string; address?: string }
) => ({
  id: movie._id,
  href: buildMovieUrl(movie),
  title: movie.title,
  tag: movie.genre?.[0] || "Now showing",
  dateLabel: movie.nextShowtime ? showtimeLabel(movie.nextShowtime) : "Coming soon",
  locationLabel:
    [cinema?.city, cinema?.address].filter(Boolean).join(", ") ||
    cinema?.name ||
    "Cinema",
  priceLabel:
    typeof movie.fromPrice === "number"
      ? `from ${movie.fromPrice.toLocaleString()} ETB`
      : movie.upcomingCount > 0
        ? `${movie.upcomingCount} showing${movie.upcomingCount === 1 ? "" : "s"}`
        : "Coming soon",
  image: posterUrl(movie.poster) || "",
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
  // The wide crop behind the hero, and the upright one for the card over it.
  // Each falls back to the other so a film with only one image still renders,
  // but a film with both gets the crop each slot was designed for.
  image: posterUrl(movie.coverImage) || posterUrl(movie.poster) || "",
  posterImage: posterUrl(movie.poster) || posterUrl(movie.coverImage) || "",
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
  priceLabel: ageRatingLabel(movie.ageRating) || "Cinema",
  image: posterUrl(movie.poster) || "",
  soldOut: false,
  ctaLabel: "Book",
});
