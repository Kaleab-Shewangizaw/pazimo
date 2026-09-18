"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Clapperboard, MapPin, MoveRight } from "lucide-react";
import { posterUrl } from "./cinema-format";
import type { PublicCinema } from "./public-cinema-types";

/**
 * One cinema: a photo, its name, and its city. Nothing else — address, phone
 * and description stay on the cinema's own page, where they would just be
 * noise between a visitor and the one decision this page asks for.
 */
function CinemaCard({ cinema, index }: { cinema: PublicCinema; index: number }) {
  const src = posterUrl(cinema.image);
  const location = [cinema.city, cinema.address].filter(Boolean).join(", ");

  const ref = useRef<HTMLDivElement>(null);
  const [animClass, setAnimClass] = useState("card-hidden");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const delay = (index % 6) * 80;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          const isMobile = window.matchMedia("(max-width: 639px)").matches;
          const cls = isMobile
            ? index % 2 === 0
              ? "card-animate-left"
              : "card-animate-right"
            : "card-animate-up";
          setTimeout(() => setAnimClass(cls), delay);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [index]);

  return (
    <div ref={ref} className={animClass}>
      <Link
        href={`/cinemas/${cinema._id}`}
        className="group block overflow-hidden rounded-[1.75rem] bg-card shadow-md dark:shadow-none"
      >
        {/* The photo — a wide, cinematic crop, never a portrait poster. */}
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-gradient-to-br from-zinc-800 to-zinc-950">
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={cinema.name}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
            />
          ) : (
            <div className="relative flex h-full w-full items-center justify-center overflow-hidden">
              <span
                aria-hidden
                className="select-none font-sans text-[7rem] font-bold leading-none text-white/[0.07]"
              >
                {cinema.name.trim().charAt(0).toUpperCase()}
              </span>
              <Clapperboard className="absolute h-9 w-9 text-white/25" strokeWidth={1.5} />
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" />
        </div>

        {/* The label. */}
        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <div className="min-w-0">
            <h3 className="truncate text-lg font-bold text-foreground sm:text-xl">
              {cinema.name}
            </h3>
            {location && (
              <p
                className="mt-1 flex items-center gap-1.5 truncate text-sm text-muted-foreground"
                style={{ fontFamily: "var(--font-inter)" }}
              >
                <MapPin className="h-3.5 w-3.5 flex-shrink-0 text-amber-500" />
                <span className="truncate">{location}</span>
              </p>
            )}
          </div>
          <MoveRight className="h-5 w-5 flex-shrink-0 text-muted-foreground/50 transition-transform duration-300 group-hover:translate-x-1" />
        </div>
      </Link>
    </div>
  );
}

export function CinemaPicker({ cinemas }: { cinemas: PublicCinema[] }) {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-7 lg:grid-cols-3 lg:gap-8">
      {cinemas.map((cinema, index) => (
        <CinemaCard key={cinema._id} cinema={cinema} index={index} />
      ))}
    </div>
  );
}
