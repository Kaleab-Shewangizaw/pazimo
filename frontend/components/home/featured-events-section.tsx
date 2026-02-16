import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import FeaturedEventCard, {
  type FeaturedEventCardData,
} from "@/components/featured-event-card";

export type FeaturedCardEvent = FeaturedEventCardData;

export default function FeaturedEventsSection({
  events,
}: {
  events: FeaturedCardEvent[];
}) {
  if (!events || events.length === 0) return null;

  return (
    <section
      id="featured"
      className="py-16 px-4 sm:px-8 md:px-16 scroll-mt-24"
    >
      <div className="container mx-auto">
        <div className="flex items-end justify-between mb-10">
          <div>
            <p className="text-[#1a2d5a] text-sm font-semibold tracking-[0.2em] uppercase mb-2">
              Featured
            </p>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-gray-900">
              Don&apos;t Miss Out
            </h2>
          </div>
          <Link href="/event_explore">
            <Button
              variant="ghost"
              className="hidden md:flex items-center gap-2 text-gray-600 hover:text-gray-900"
            >
              View All <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {events.map((event) => (
            <FeaturedEventCard key={event.id} data={event} />
          ))}
        </div>

        <div className="md:hidden mt-8 text-center">
          <Link href="/event_explore">
            <Button variant="ghost" className="text-gray-600 hover:text-gray-900">
              View All Events <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
