import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import FeaturedEventCard from "@/components/featured-event-card";
import { movieToFeaturedCard } from "./cinema-format";
import type { FeaturedMovie } from "./public-cinema-types";

/**
 * The home page's Movies row.
 *
 * Uses FeaturedEventCard — the same component the Featured events row uses —
 * rather than a cinema-specific card, so a film and an event are the same
 * object to a customer and the two can never drift apart visually.
 *
 * The film is mapped onto the card's vocabulary in movieToFeaturedCard rather
 * than the card learning about films; its `tag` slot carries the cinema name,
 * which is what makes each card read as "<Title> @ <Cinema>".
 */
export default function MoviesSection({ movies }: { movies: FeaturedMovie[] }) {
  // Renders nothing when the admin has promoted no films, matching how
  // FeaturedEventsSection behaves on a quiet week — an empty heading is worse
  // than no section.
  if (!movies || movies.length === 0) return null;

  return (
    <section id="movies" className="scroll-mt-24 px-4 py-8 sm:px-8 md:px-16">
      <div className="container mx-auto">
        <div className="mb-10 flex items-end justify-between">
          <div>
            <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-primary dark:text-yellow-400">
              At the cinema
            </p>
            <h2 className="font-display text-3xl font-bold text-foreground md:text-4xl">
              Now Showing
            </h2>
          </div>
          <Link href="/cinemas">
            <Button
              variant="ghost"
              className="hidden items-center gap-2 text-muted-foreground hover:text-foreground md:flex"
            >
              All Cinemas <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {movies.slice(0, 8).map((movie, i) => (
            <FeaturedEventCard
              key={movie._id}
              data={movieToFeaturedCard(movie)}
              index={i}
            />
          ))}
        </div>

        <div className="mt-8 text-center md:hidden">
          <Link href="/cinemas">
            <Button variant="ghost" className="text-muted-foreground hover:text-foreground">
              All Cinemas <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
