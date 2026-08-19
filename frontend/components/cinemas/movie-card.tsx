"use client";

import Link from "next/link";
import { Clock, Film, MapPin } from "lucide-react";
import { posterUrl, runtimeLabel, showtimeLabel } from "./cinema-format";

/**
 * One film, as a poster card.
 *
 * Posters are 2:3, so the image area is fixed to that ratio and the card lets
 * the title wrap underneath. Everything below the poster is optional metadata —
 * a film with no runtime, rating or screening still renders a complete card
 * rather than collapsing.
 */
export function MovieCard({
  href,
  title,
  poster,
  durationMinutes,
  ageRating,
  genre,
  cinemaName,
  showtime,
  upcomingCount,
  fromPrice,
}: {
  href: string;
  title: string;
  poster?: string | null;
  durationMinutes?: number;
  ageRating?: string;
  genre?: string[];
  cinemaName?: string;
  showtime?: string | null;
  upcomingCount?: number;
  fromPrice?: number | null;
}) {
  const src = posterUrl(poster);
  const runtime = runtimeLabel(durationMinutes);

  return (
    <Link
      href={href}
      className="group flex w-full flex-col overflow-hidden rounded-xl border border-gray-200 bg-white transition-all hover:-translate-y-0.5 hover:shadow-lg dark:border-gray-800 dark:bg-gray-950/60"
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-gray-100 dark:bg-gray-900">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Film className="h-10 w-10 text-gray-300 dark:text-gray-700" />
          </div>
        )}

        {ageRating && (
          <span className="absolute right-2 top-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] font-semibold text-white backdrop-blur">
            {ageRating}
          </span>
        )}

        {typeof fromPrice === "number" && (
          <span className="absolute bottom-2 left-2 rounded-md bg-indigo-600/95 px-2 py-0.5 text-[11px] font-semibold text-white">
            from {fromPrice.toLocaleString()} ETB
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-gray-900 dark:text-gray-100">
          {title}
        </h3>

        {cinemaName && (
          <p className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
            <MapPin className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{cinemaName}</span>
          </p>
        )}

        {(runtime || genre?.length) && (
          <p className="truncate text-xs text-gray-500 dark:text-gray-400">
            {[runtime, genre?.slice(0, 2).join(", ")].filter(Boolean).join(" · ")}
          </p>
        )}

        <p className="mt-auto flex items-center gap-1 pt-1 text-xs font-medium text-indigo-600 dark:text-indigo-400">
          <Clock className="h-3 w-3 flex-shrink-0" />
          <span className="truncate">{showtimeLabel(showtime)}</span>
          {upcomingCount ? (
            <span className="ml-auto flex-shrink-0 text-gray-400 dark:text-gray-500">
              {upcomingCount} {upcomingCount === 1 ? "show" : "shows"}
            </span>
          ) : null}
        </p>
      </div>
    </Link>
  );
}
