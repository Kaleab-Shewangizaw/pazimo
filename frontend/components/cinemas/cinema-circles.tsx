"use client";

import Link from "next/link";
import { Film } from "lucide-react";
import { posterUrl } from "./cinema-format";
import type { PublicCinema } from "./public-cinema-types";

/**
 * The cinemas, presented the way categories are on the home page: a row of
 * round tiles with the name underneath.
 *
 * Category tiles are a swipeable carousel with index maths because there can be
 * dozens of categories. Cinemas number in the tens at most, so this wraps
 * instead — same visual language, none of the carousel machinery to keep in
 * step. If the list ever grows enough to need paging, lift the carousel out of
 * category-icons rather than duplicating it here.
 */
export function CinemaCircles({ cinemas }: { cinemas: PublicCinema[] }) {
  if (cinemas.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
        No cinemas are listed yet. Check back soon.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap justify-center gap-x-6 gap-y-8 sm:gap-x-10">
      {cinemas.map((cinema) => {
        const src = posterUrl(cinema.image);
        return (
          <Link
            key={cinema._id}
            href={`/cinemas/${cinema._id}`}
            className="group flex w-24 flex-col items-center sm:w-28"
          >
            <div className="relative">
              <div className="absolute inset-0 scale-110 rounded-full bg-indigo-500 opacity-0 blur-md transition-all duration-300 group-hover:opacity-20" />
              <div className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-indigo-600 to-indigo-400 shadow-lg transition-all duration-300 group-hover:shadow-xl sm:h-24 sm:w-24">
                {src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={src}
                    alt={cinema.name}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Film className="h-8 w-8 text-white" />
                )}
              </div>
              <div className="absolute inset-0 scale-110 rounded-full border-2 border-border opacity-0 transition-all duration-300 group-hover:scale-115 group-hover:opacity-100" />
            </div>

            <span className="mt-2 line-clamp-2 text-center text-xs font-medium text-gray-800 dark:text-gray-200 sm:text-sm">
              {cinema.name}
            </span>
          
            <span className="mt-1 h-0.5 w-full scale-x-0 rounded-full bg-indigo-500 transition-transform duration-300 group-hover:scale-x-100" />
          </Link>
        );
      })}
    </div>
  );
}
