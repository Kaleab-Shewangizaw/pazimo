import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Film, MapPin, Phone } from "lucide-react";
import { MovieCard } from "@/components/cinemas/movie-card";
import { buildMovieUrl, posterUrl } from "@/components/cinemas/cinema-format";
import type { CinemaMovieCard, PublicCinema } from "@/components/cinemas/public-cinema-types";

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
  const data = await getCinemaMovies(cinemaId);

  // The endpoint 404s for a cinema that does not exist OR has been suspended;
  // both should read as "no such page" to a customer rather than leaking which.
  if (!data?.cinema) notFound();

  const { cinema, movies } = data;
  const logo = posterUrl(cinema.image);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black">
      <section className="border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
        <div className="container mx-auto max-w-6xl px-4 py-8">
          <Link
            href="/cinemas"
            className="mb-5 inline-flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400"
          >
            <ArrowLeft className="h-4 w-4" />
            All cinemas
          </Link>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-indigo-600 to-indigo-400 shadow-md sm:h-20 sm:w-20">
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logo}
                  alt={cinema.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <Film className="h-7 w-7 text-white" />
              )}
            </div>

            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 sm:text-3xl">
                {cinema.name}
              </h1>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
                {(cinema.city || cinema.address) && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {[cinema.address, cinema.city].filter(Boolean).join(", ")}
                  </span>
                )}
                {cinema.phoneNumber && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5" />
                    {cinema.phoneNumber}
                  </span>
                )}
              </div>
            </div>
          </div>

          {cinema.description && (
            <p className="mt-4 max-w-3xl text-sm text-gray-600 dark:text-gray-400">
              {cinema.description}
            </p>
          )}
        </div>
      </section>

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
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {movies.map((movie) => (
              <MovieCard
                key={movie._id}
                // Showtime selection is the next step in the flow and does not
                // exist yet — this anchors to the film so the page at least
                // lands somewhere meaningful once it does.
                href={buildMovieUrl(movie)}
                title={movie.title}
                poster={movie.poster}
                durationMinutes={movie.durationMinutes}
                ageRating={movie.ageRating}
                genre={movie.genre}
                showtime={movie.nextShowtime}
                upcomingCount={movie.upcomingCount}
                fromPrice={movie.fromPrice}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
