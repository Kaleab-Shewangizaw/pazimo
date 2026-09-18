import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Film } from "lucide-react";
import FeaturedEventCard from "@/components/featured-event-card";
import {
  cinemaMovieToFeaturedCard,
  movieToBannerEvent,
} from "@/components/cinemas/cinema-format";
import type {
  CinemaMovieCard,
  FeaturedMovie,
  PublicCinema,
} from "@/components/cinemas/public-cinema-types";
import TrendingEvents from "@/components/trending-events";
import TrendingEventsSkeleton from "@/components/skeleton/trending-events-skeleton";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";
const withBase = (path: string) => (API_URL ? `${API_URL}${path}` : path);

interface CinemaMoviesResponse {
  cinema: PublicCinema;
  movies: CinemaMovieCard[];
}

async function getCinemaMovies(
  cinemaId: string
): Promise<CinemaMoviesResponse | null> {
  try {
    const res = await fetch(
      withBase(`/api/cinemas/public/${cinemaId}/movies`),
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data?.data ?? null;
  } catch (error) {
    console.error("Cinema detail: failed to load", error);
    return null;
  }
}

// This cinema's own banner — the same admin/cinema bannerStatus flag the
// platform-wide row used to read, scoped down to one cinema's films by
// /public/:cinemaId/banner-movies. Never throws: a promoted row that fails to
// load should not take the rest of the cinema page down with it.
async function getCinemaBanner(cinemaId: string): Promise<FeaturedMovie[]> {
  try {
    const res = await fetch(
      withBase(`/api/cinemas/public/${cinemaId}/banner-movies`),
      { cache: "no-store" }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data?.data || [];
  } catch (error) {
    console.error("Cinema detail: failed to load banner movies", error);
    return [];
  }
}

// Next 15 hands params in as a promise.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ cinemaId: string }>;
}) {
  const { cinemaId } = await params;
  const data = await getCinemaMovies(cinemaId);
  return {
    title: data?.cinema?.name ? `${data.cinema.name} | Pazimo` : "Cinema | Pazimo",
    description: data?.cinema?.description || "Book cinema tickets with Pazimo.",
  };
}

export default async function CinemaDetailPage({
  params,
}: {
  params: Promise<{ cinemaId: string }>;
}) {
  const { cinemaId } = await params;
  const [data, bannerMovies] = await Promise.all([
    getCinemaMovies(cinemaId),
    getCinemaBanner(cinemaId),
  ]);

  // The endpoint 404s for a cinema that does not exist OR has been suspended;
  // both should read as "no such page" to a customer rather than leaking which.
  if (!data?.cinema) notFound();

  const { cinema, movies } = data;

  // A bannered film with nothing scheduled is a dead slide — the flag says
  // "show this off" but there is nothing to sell. Filtered out here rather
  // than at the API, which still needs to answer "what did this cinema
  // banner" for the dashboard regardless of what is currently scheduled.
  const scheduledBannerMovies = bannerMovies.filter((m) => m.upcomingCount > 0);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black">
      {/* Same position as the home page's hero: the first thing on the page,
          nothing above it. Renders nothing at all when this cinema has
          nothing bannered with an upcoming showing — no empty carousel. */}
      {scheduledBannerMovies.length > 0 && (
        <Suspense fallback={<TrendingEventsSkeleton />}>
          <TrendingEvents initialEvents={scheduledBannerMovies.map(movieToBannerEvent)} />
        </Suspense>
      )}

      <div className="container mx-auto max-w-6xl px-4 py-10">
        <h2 className="mb-5 text-xl font-bold text-gray-900 dark:text-gray-100">
          Now showing
        </h2>

        {movies.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 py-16 text-center dark:border-gray-700">
            <Film className="mx-auto mb-3 h-8 w-8 text-gray-300 dark:text-gray-700" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {cinema.name} has no screenings scheduled right now.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {movies.map((movie, index) => (
              <FeaturedEventCard
                key={movie._id}
                index={index}
                data={cinemaMovieToFeaturedCard(movie, cinema)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
