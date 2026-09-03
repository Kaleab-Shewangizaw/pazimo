// Shapes returned by the public cinema endpoints.
//
// TYPES ONLY. The runtime helpers that used to live here now sit in
// cinema-format.ts.
//
// They were split because this module is imported by both server components
// (the cinema and home pages) and client components (the booking flow), and a
// file that exports types AND values across that boundary is the shape that
// makes a bundler hand back a module whose functions are undefined at runtime.
// Types erase at compile time; values do not. Keeping them apart means the
// type import can never drag a runtime module into a bundle that does not want
// one.
//
// These deliberately mirror only what the API actually projects for anonymous
// callers — no commission rates, no owning account. If a field is not here it is
// because the server does not send it to customers, not because it was forgotten.

export interface PublicCinema {
  _id: string;
  name: string;
  description?: string;
  city?: string;
  address?: string;
  phoneNumber?: string;
  image?: string | null;
}

export interface FeaturedMovie {
  _id: string;
  slug?: string | null;
  shortId?: string | null;
  title: string;
  description?: string;
  poster?: string | null;
  coverImage?: string | null;
  durationMinutes?: number;
  ageRating?: string;
  genre?: string[];
  language?: string;
  cinema: PublicCinema;
  nextShowtime: string | null;
  upcomingCount: number;
}

export interface CinemaMovieCard {
  _id: string;
  slug?: string | null;
  shortId?: string | null;
  title: string;
  description?: string;
  poster?: string | null;
  durationMinutes?: number;
  ageRating?: string;
  genre?: string[];
  language?: string;
  subtitles?: string;
  nextShowtime: string;
  upcomingCount: number;
  fromPrice: number | null;
}


export interface PublicTier {
  _id: string;
  name: string;
  price: number;
  description?: string;
  seatsRemaining: number;
}

export interface PublicShowtime {
  _id: string;
  startsAt: string;
  endsAt?: string | null;
  currency: string;
  hall?: { _id: string; name: string; screenType?: string };
  ticketTypes: PublicTier[];
  soldOut: boolean;
}

export interface PublicMovieDay {
  /** YYYY-MM-DD in the server's timezone. */
  date: string;
  showtimes: PublicShowtime[];
}

export interface PublicMovieDetail {
  movie: {
    _id: string;
    slug?: string | null;
    shortId?: string | null;
    title: string;
    description?: string;
    poster?: string | null;
    coverImage?: string | null;
    durationMinutes?: number;
    genre?: string[];
    cast?: string[];
    language?: string;
    subtitles?: string;
    ageRating?: string;
    trailerUrl?: string;
    releaseDate?: string | null;
    status: "coming_soon" | "now_showing" | "archived";
  };
  cinema: PublicCinema;
  days: PublicMovieDay[];
  fromPrice: number | null;
  upcomingCount: number;
}
