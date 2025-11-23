import EventCardSkeleton from "./event-card-skeleton"

export default function TrendingEventsSkeleton() {
  return (
    <section className="relative overflow-hidden bg-gray-100 mx-4 sm:mx-8 md:mx-12 my-6 rounded-xl">
      <div className="absolute inset-0 bg-gradient-to-r from-gray-200/90 to-transparent z-10" />
      
      {/* Background Image Skeleton */}
      <div className="absolute inset-0 bg-gray-300 animate-pulse" />

      <div className="relative z-20 container mx-auto px-8 sm:px-16 md:px-24 py-8 md:py-16">
        <div className="flex flex-col md:flex-row items-center">
          {/* Content Skeleton */}
          <div className="w-full md:w-1/2">
            {/* Categories */}
            <div className="flex flex-wrap gap-2 mb-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-6 w-20 bg-gray-200 rounded-full animate-pulse" />
              ))}
            </div>

            {/* Title */}
            <div className="h-8 w-3/4 bg-gray-200 rounded mb-3 animate-pulse" />
            
            {/* Description */}
            <div className="space-y-2 mb-4">
              <div className="h-4 w-full bg-gray-200 rounded animate-pulse" />
              <div className="h-4 w-5/6 bg-gray-200 rounded animate-pulse" />
            </div>

            {/* Event Details */}
            <div className="space-y-3 mb-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="h-5 w-5 bg-gray-200 rounded-full animate-pulse" />
                  <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
                </div>
              ))}
            </div>

            {/* Rating */}
            <div className="flex items-center gap-2 mb-6">
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-4 w-4 bg-gray-200 rounded-full animate-pulse" />
                ))}
              </div>
              <div className="h-4 w-8 bg-gray-200 rounded animate-pulse" />
            </div>

            {/* Buttons */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="h-10 w-32 bg-gray-200 rounded animate-pulse" />
              <div className="h-10 w-32 bg-gray-200 rounded animate-pulse" />
            </div>
          </div>

          {/* Image Skeleton */}
          <div className="w-full md:w-1/2 mt-8 md:mt-0">
            <div className="relative h-[320px] w-full rounded-xl overflow-hidden bg-gray-200 animate-pulse" />
          </div>
        </div>

        {/* Navigation Controls Skeleton */}
        <div className="flex justify-between items-center mt-8">
          <div className="flex gap-2">
            <div className="h-12 w-12 bg-gray-200 rounded-full animate-pulse" />
            <div className="h-12 w-12 bg-gray-200 rounded-full animate-pulse" />
          </div>

          {/* Slide Indicators */}
          <div className="flex gap-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-3 w-3 bg-gray-200 rounded-full animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
