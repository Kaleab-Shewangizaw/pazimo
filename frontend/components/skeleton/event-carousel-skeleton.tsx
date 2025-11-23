
import EventCardSkeleton from "@/components/skeleton/event-card-skeleton"
export default function EventCarouselSkeleton() {
  return (
    <div className="px-4 sm:px-8 md:px-16 py-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array(4)
          .fill(0)
          .map((_, index) => (
            <EventCardSkeleton key={index} />
          ))}
      </div>
    </div>
  )
}
