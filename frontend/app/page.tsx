"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { Suspense, lazy, useEffect, useState } from "react";

// Lazy load components
const EventCarousel = lazy(() => import("@/components/event-carousel"));
const CategoryIcons = lazy(() => import("@/components/category-icons"));
// const UpcomingEvents = lazy(() => import("@/components/upcoming-events"));
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

      {/* Featured Events Header */}
      <div className="px-4 sm:px-8 md:px-16 py-4 flex justify-between items-center border-b">
        <h3 className="text-lg text-[#1a2d5a] font-semibold">
          Featured Events
        </h3>
      </div>

      {/* Carousel */}
      {isClient ? (
        <Suspense fallback={<EventCarouselSkeleton />}>
          <EventCarousel />
        </Suspense>
      ) : (
        <EventCarouselSkeleton />
      )}

      {/* View All Button Under Carousel */}
      <div className="w-full flex justify-center mt-3 mb-6">
        <Link href="/event_explore">
          <Button
            variant="outline"
            className="
              border-blue-700 
              text-blue-700 
              hover:bg-blue-700 
              hover:text-white
              transition 
              px-6 
              py-2 
              rounded-lg 
              text-sm 
              sm:text-base 
              flex 
              items-center 
              gap-1
            "
          >
            View All Events
            <ChevronRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>

      {/* Category Icons */}
      {isClient ? (
        <Suspense fallback={<CategoryIconsSkeleton />}>
          <CategoryIcons />
        </Suspense>
      ) : (
        <CategoryIconsSkeleton />
      )}

      {/* Upcoming Events */}

      {/* {isClient ? (
        <Suspense fallback={<UpcomingEventsSkeleton />}>
          <UpcomingEvents />
        </Suspense>
      ) : (
        <UpcomingEventsSkeleton />
      )} */}

      {/* Newsletter */}
      <section className="py-8 px-4 sm:px-8 md:px-16 bg-gray-50 mt-8"></section>
    </>
  );
}
