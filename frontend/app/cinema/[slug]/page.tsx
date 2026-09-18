import { notFound } from "next/navigation";
import MovieBooking from "@/components/cinemas/movie-booking";
import type { PublicMovieDetail } from "@/components/cinemas/public-cinema-types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";
const withBase = (path: string) => (API_URL ? `${API_URL}${path}` : path);

/**
 * `slug` is the pretty "{slug}-{shortId}" segment. The API accepts that or a raw
 * id, so links written before slugs existed still resolve.
 */
async function getMovie(slug: string): Promise<PublicMovieDetail | null> {
  try {
    const res = await fetch(withBase(`/api/cinemas/public/movies/${slug}`), {
      // Showtimes sell out through the day, so a cached page would offer seats
      // that are already gone.
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.data ?? null;
  } catch (error) {
    console.error("Movie page: failed to load", error);
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getMovie(slug);
  if (!data) return { title: "Movie | Pazimo" };
  return {
    title: `${data.movie.title} at ${data.cinema.name} | Pazimo`,
    description:
      data.movie.description || `Book tickets for ${data.movie.title} on Pazimo.`,
  };
}

export default async function MoviePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getMovie(slug);

  // The endpoint 404s for a film that does not exist, is retired, or whose
  // cinema is suspended. All three read as "no such page" to a customer.
  if (!data) notFound();

  return <MovieBooking detail={data} />;
}
