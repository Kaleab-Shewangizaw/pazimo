"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Calendar, MapPin, Flame, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";

export type TrendingCardEvent = {
  id: string;
  title: string;
  dateLabel: string;
  locationLabel: string;
  attendeesLabel: string;
  priceLabel: string;
  image?: string;
  soldOut?: boolean;
};

function TrendingCard({ event, index }: { event: TrendingCardEvent; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [animClass, setAnimClass] = useState("card-hidden");
  const isSoldOut = !!event.soldOut;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const delay = index * 80;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          const isMobile = window.matchMedia("(max-width: 639px)").matches;
          const cls = isMobile
            ? index % 2 === 0 ? "card-animate-left" : "card-animate-right"
            : "card-animate-up";
          setTimeout(() => setAnimClass(cls), delay);
          observer.disconnect();
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [index]);

  return (
    <div ref={ref} className={animClass}>
      <Link href={`/event_detail?id=${event.id}`}>
        <div className="group rounded-2xl overflow-hidden flex flex-col md:flex-row cursor-pointer transition-all duration-300   dark:border-white/10 bg-card dark:bg-white/[0.07] hover:bg-white/[0.05]">
          <div className="relative md:w-80 md:h-60 shrink-0 overflow-hidden bg-muted">
            {isSoldOut && (
              <span className="absolute top-3 right-3 bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg z-20 shadow-md">
                SOLD OUT
              </span>
            )}
            {event.image ? (
              <Image
                src={event.image}
                alt={event.title}
                width={400}
                height={240}
                className="w-full h-48 md:h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            ) : (
              <div className="w-full h-48 md:h-full flex items-center justify-center bg-muted text-muted-foreground">
                <ImageIcon className="h-12 w-12" />
              </div>
            )}
          </div>
          <div className="flex-1 p-6 md:p-8 flex flex-col justify-between bg-transparent">
            <div>
              <h3 className="font-display text-xl font-semibold mb-3 text-[#06283D] transition-colors dark:text-white">
                {event.title}
              </h3>
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" /> {event.dateLabel}
                </span>
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" /> {event.locationLabel}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between mt-6">
              <span className="text-lg font-display font-bold text-blue-700 dark:text-yellow-400">
                {event.priceLabel}
              </span>
              <Button
                className={`dark:text-black dark:bg-yellow-400 text-primary-foreground hover:opacity-90 transition-opacity cursor-pointer text-sm px-6`}
                variant={isSoldOut ? "outline" : "default"}
              >
                {isSoldOut ? "Sold Out" : "Get Tickets"} <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
}

export default function TrendingEventsSection({
  events,
}: {
  events: TrendingCardEvent[];
}) {
  if (!events || events.length === 0) return null;

  return (
    <section
      id="trending"
      className="py-16 px-4 sm:px-8 md:px-16 scroll-mt-24"
    >
      <div className="container mx-auto">
        <div className="flex items-end justify-between mb-10">
          <div>
            <p className="text-orange-500 text-sm font-semibold tracking-[0.2em] uppercase mb-2 flex items-center gap-2">
              <Flame className="h-4 w-4" /> Trending Now
            </p>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground">
              Selling Fast
            </h2>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          {events.map((event, i) => (
            <TrendingCard key={event.id} event={event} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
