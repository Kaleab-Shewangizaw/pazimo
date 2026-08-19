import Link from "next/link";
import { Suspense } from "react";
import { Film, Ticket } from "lucide-react";
import { CinemaCircles } from "@/components/cinemas/cinema-circles";
import FeaturedEventsSection from "@/components/home/featured-events-section";
import TrendingEventsSection from "@/components/home/trending-events-section";
import TrendingEvents from "@/components/trending-events";
import { movieToBannerEvent, movieToFeaturedCard, movieToTrendingCard } from "@/components/cinemas/cinema-format";
import type { FeaturedMovie, PublicCinema } from "@/components/cinemas/public-cinema-types";

export const metadata = {
  title: "Cinema | Pazimo",
  description: "What's on at cinemas across Ethiopia — book your seat with Pazimo.",
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";
const withBase = (path: string) => (API_URL ? `${API_URL}${path}` : path);

// no-store, matching how the home page reads categories and events: the
// promoted row is admin-curated and showtimes move through the day, so a cached
// page would show films that are no longer on.
async function getJson<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(withBase(path), { cache: "no-store" });
    if (!res.ok) return fallback;
    const data = await res.json();
    return (data?.data ?? fallback) as T;
  } catch (error) {
    console.error(`Cinema page: failed to load ${path}`, error);
    return fallback;
  }
}

export default async function CinemasPage() {
  // Fetched together: none depends on another, and doing them in sequence would
  // make the page wait for four round trips instead of one.
  const [banner, featured, trending, cinemas] = await Promise.all([
    getJson<FeaturedMovie[]>("/api/cinemas/public/banner-movies", []),
    getJson<FeaturedMovie[]>("/api/cinemas/public/featured-movies?limit=8", []),
    getJson<FeaturedMovie[]>("/api/cinemas/public/trending-movies?limit=8", []),
    getJson<PublicCinema[]>("/api/cinemas/public/cinemas", []),
  ]);

  const nothingCurated =
    banner.length === 0 && featured.length === 0 && trending.length === 0;

  return (
    <>
      {/* The same hero carousel the home page uses. Admin-controlled: a film
          appears here only when an admin sets its banner flag. */}
      {banner.length > 0 && (
        <Suspense fallback={null}>
          <TrendingEvents initialEvents={banner.map(movieToBannerEvent)} />
        </Suspense>
      )}

      {/* Featured — the identical component and card the events page uses, so
          a film and an event are visually the same object to a customer. */}
      <FeaturedEventsSection events={featured.map((m) => movieToFeaturedCard(m))} />

      {/* Cinemas, presented like the home page's categories. */}
      <section
        id="cinemas"
        className="scroll-mt-24"
      >
        <div className="container mx-auto max-w-6xl px-4">
       
          
          <CinemaCircles cinemas={cinemas} />
        </div>
      </section>

      <TrendingEventsSection events={trending.map(movieToTrendingCard)} />

      {/* Nothing curated AND no cinemas — distinct from a quiet week, which
          simply renders fewer sections rather than claiming the page is empty. */}
      {nothingCurated && cinemas.length === 0 && (
        <div className="container mx-auto max-w-2xl px-4 py-20 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-950/40">
            <Ticket className="h-7 w-7 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">No cinemas yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Cinema booking is rolling out on Pazimo.{" "}
            <Link href="/" className="text-primary hover:underline">
              Browse events instead
            </Link>
            .
          </p>
        </div>
      )}

      {/* A page with cinemas but nothing promoted still needs a heading, or it
          opens on a bare row of circles with no explanation. */}
      {nothingCurated && cinemas.length > 0 && (
        <div className="container mx-auto max-w-6xl px-4 py-10 text-center">
          <Film className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Nothing is being promoted right now — pick a cinema above to see
            what&apos;s on.
          </p>
        </div>
      )}
    </>
  );
}
