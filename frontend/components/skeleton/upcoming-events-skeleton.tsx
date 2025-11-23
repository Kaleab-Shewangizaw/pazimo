

import { Skeleton } from "@/components/ui/skeleton"

export default function UpcomingEventsSkeleton() {
  return (
    <div className="relative px-4 sm:px-8 md:px-16 py-6 border-t">
      <div className="flex items-center justify-between mb-6">
        <Skeleton className="h-7 w-48" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-9 rounded-full" />
          <Skeleton className="h-9 w-9 rounded-full" />
        </div>
      </div>

      <div className="overflow-hidden">
        <div className="flex flex-wrap">
          {Array(4)
            .fill(0)
            .map((_, index) => (
              <div key={index} className="w-full sm:w-1/2 md:w-1/3 xl:w-1/4 flex-shrink-0 px-2 mb-4">
                <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                  <div className="relative">
                    <Skeleton className="w-full h-48 rounded-t-xl" />
                    <div className="absolute top-0 left-0 z-10">
                      <Skeleton className="h-6 w-24 rounded-br-lg" />
                    </div>
                    <div className="absolute top-3 right-3">
                      <Skeleton className="h-9 w-9 rounded-full" />
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <Skeleton className="h-5 w-24" />
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="flex justify-between items-start">
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-6 w-40" />
                      </div>
                      <Skeleton className="h-8 w-20 rounded-lg" />
                    </div>
                    <Skeleton className="h-10 w-full mt-4 rounded-md" />
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Carousel Indicators */}
      <div className="flex justify-center mt-6 gap-1.5">
        {Array(3)
          .fill(0)
          .map((_, index) => (
            <Skeleton key={index} className={`h-2 rounded-full ${index === 0 ? "w-6" : "w-2"}`} />
          ))}
      </div>
    </div>
  )
}
