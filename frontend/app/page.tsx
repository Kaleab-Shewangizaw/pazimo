"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { Suspense, lazy, useEffect, useState } from "react";

// Lazy load components
const EventCarousel = lazy(() => import("@/components/event-carousel"));
const CategoryIcons = lazy(() => import("@/components/category-icons"));
const UpcomingEvents = lazy(() => import("@/components/upcoming-events"));
const TrendingEvents = lazy(() => import("@/components/trending-events"));

// Skeletons
import EventCarouselSkeleton from "@/components/skeleton/event-carousel-skeleton";
import CategoryIconsSkeleton from "@/components/skeleton/category-icons-skeleton";
// import UpcomingEventsSkeleton from "@/components/skeleton/upcoming-events-skeleton";
import TrendingEventsSkeleton from "@/components/skeleton/trending-events-skeleton";
import { Button } from "@/components/ui/button";

export default function Page() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  return (
    <>
      {/* Trending Events */}
      {isClient ? (
        <Suspense fallback={<TrendingEventsSkeleton />}>
          <TrendingEvents />
        </Suspense>
      ) : (
        <TrendingEventsSkeleton />
      )}

      {/* Upcoming Events (Carousel) */}
      {isClient ? (
        <Suspense fallback={<EventCarouselSkeleton />}>
          <EventCarousel />
        </Suspense>
      ) : (
        <EventCarouselSkeleton />
      )}

      {/* Category Icons */}
      {isClient ? (
        <Suspense fallback={<CategoryIconsSkeleton />}>
          <CategoryIcons />
        </Suspense>
      ) : (
        <CategoryIconsSkeleton />
      )}

      {/* Featured Events (List Layout) */}
      {isClient ? (
        <Suspense
          fallback={
            <div className="h-96 bg-gray-100 animate-pulse rounded-lg mx-4 sm:mx-8 md:mx-16  my-8 mt-4" />
          }
        >
          <UpcomingEvents />
        </Suspense>
      ) : (
        <div className="h-96 bg-gray-100 animate-pulse rounded-lg mx-4 sm:mx-8 md:mx-16 my-8" />
      )}

      {/* Newsletter */}
      <section className="py-8 px-4 sm:px-8 md:px-16 bg-gray-50 mt-8"></section>
    </>
  );
}
