import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Calendar, MapPin, Users, Flame, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export type TrendingCardEvent = {
  id: string;
  title: string;
  dateLabel: string;
  locationLabel: string;
  attendeesLabel: string;
  priceLabel: string;
  image?: string;
};

export default function TrendingEventsSection({
  events,
}: {
  events: TrendingCardEvent[];
}) {
  if (!events || events.length === 0) return null;

  return (
    <section id="trending" className="py-16 px-4 sm:px-8 md:px-16">
      <div className="container mx-auto">
        <div className="flex items-end justify-between mb-10">
          <div>
            <p className="text-[#d9534f] text-sm font-semibold tracking-[0.2em] uppercase mb-2 flex items-center gap-2">
              <Flame className="h-4 w-4" /> Trending Now
            </p>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-gray-900">
              Selling Fast
            </h2>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          {events.map((event) => (
            <Link href={`/event_detail?id=${event.id}`} key={event.id}>
              <div className="group glass rounded-2xl overflow-hidden flex flex-col md:flex-row cursor-pointer hover:border-[#1a2d5a]/30 transition-all duration-300 border border-gray-100 shadow-sm">
                <div className="relative md:w-80 md:h-60 shrink-0 overflow-hidden bg-gray-50">
                  {event.image ? (
                    <Image
                      src={event.image}
                      alt={event.title}
                      width={400}
                      height={240}
                      className="w-full h-48 md:h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-48 md:h-full flex items-center justify-center bg-gray-100 text-gray-400">
                      <ImageIcon className="h-12 w-12" />
                    </div>
                  )}
                </div>
                <div className="flex-1 p-6 md:p-8 flex flex-col justify-between bg-white">
                  <div>
                    <h3 className="font-display text-xl font-semibold mb-3 group-hover:text-[#1a2d5a] transition-colors">
                      {event.title}
                    </h3>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="h-4 w-4" /> {event.dateLabel}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <MapPin className="h-4 w-4" /> {event.locationLabel}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Users className="h-4 w-4" /> {event.attendeesLabel}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-6">
                    <span className="text-lg font-display font-bold text-[#1a2d5a]">
                      {event.priceLabel}
                    </span>
                    <Button className="bg-gradient-to-r from-[#1a2d5a] to-[#2a4d7a] text-white text-sm px-6 hover:opacity-90 transition-opacity">
                      Get Tickets <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
