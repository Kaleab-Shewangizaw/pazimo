"use client"

import { ChevronRight } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { Suspense, lazy, useEffect, useState } from "react"

// Lazy load components
const EventCarousel = lazy(() => import("@/components/event-carousel"))
const CategoryIcons = lazy(() => import("@/components/category-icons"))
const UpcomingEvents = lazy(() => import("@/components/upcoming-events"))
const TrendingEvents = lazy(() => import("@/components/trending-events"))

// Import skeletons
import EventCarouselSkeleton from "@/components/skeleton/event-carousel-skeleton"
import CategoryIconsSkeleton from "@/components/skeleton/category-icons-skeleton"
import UpcomingEventsSkeleton from "@/components/skeleton/upcoming-events-skeleton"
import TrendingEventsSkeleton from "@/components/skeleton/trending-events-skeleton"

export default function Page() {
  const [isClient, setIsClient] = useState(false)

  // This ensures hydration issues are avoided
  useEffect(() => {
    setIsClient(true)
  }, [])

  return (
    <>
    

      {/* Trending Events with Skeleton */}
      {isClient ? (
        <Suspense fallback={<TrendingEventsSkeleton />}>
          <TrendingEvents />
        </Suspense>
      ) : (
        <TrendingEventsSkeleton />
      )}

      {/* Featured Events Section Header */}
      <div className="px-4 sm:px-8 md:px-16 py-4 flex justify-between items-center border-b">
      <h3 className="text-lg text-[#1a2d5a]">Featured Events</h3>


        <Link href="/event_explore" className="flex items-center text-xs sm:text-sm text-[#1a2d5a]">
          View All
          <ChevronRight className="h-4 w-4 ml-1" />
        </Link>
      </div>

      {/* Events Carousel with Skeleton */}
      {isClient ? (
        <Suspense fallback={<EventCarouselSkeleton />}>
          <EventCarousel />
        </Suspense>
      ) : (
        <EventCarouselSkeleton />
      )}

      {/* Category Icons with Skeleton */}
      {isClient ? (
        <Suspense fallback={<CategoryIconsSkeleton />}>
          <CategoryIcons />
        </Suspense>
      ) : (
        <CategoryIconsSkeleton />
      )}

      {/* Upcoming Events Section Header */}
      <div className="px-4 sm:px-8 md:px-16 py-4 flex justify-between items-center border-b">
        <h3 className="text-sm sm:text-base flex items-center">
          <span>
            Upcoming <span className="text-[#1a2d5a] font-semibold">Events</span> to look forward to
          </span>
        </h3>
        {/* <Link href="/events/upcoming" className="flex items-center text-xs sm:text-sm text-[#1a2d5a]">
          View Calendar
          <ChevronRight className="h-4 w-4 ml-1" />
        </Link> */}
      </div>

      {/* Upcoming Events with Skeleton */}
      {isClient ? (
        <Suspense fallback={<UpcomingEventsSkeleton />}>
          <UpcomingEvents />
        </Suspense>
      ) : (
        <UpcomingEventsSkeleton />
      )}

      {/* Newsletter Section */}
      <section className="py-8 px-4 sm:px-8 md:px-16 bg-gray-50 mt-8">
      
      </section>
    </>
  )
}
