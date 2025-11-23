// import { Skeleton } from "@/components/ui/skeleton"
import { Skeleton } from "../ui/skeleton"

export default function EventCardSkeleton() {
  return (
    <div className="rounded-lg overflow-hidden border border-gray-200 shadow-sm">
      <Skeleton className="w-full h-40" />
      <div className="p-4 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-6 w-5/6" />
        <div className="flex items-center justify-between mt-2">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-8 w-20 rounded-full" />
        </div>
      </div>
    </div>
  )
}
