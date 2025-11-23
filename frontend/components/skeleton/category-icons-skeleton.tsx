// import { Skeleton } from "@/components/ui/skeleton"
import { Skeleton } from "../ui/skeleton"
export default function CategoryIconsSkeleton() {
  return (
    <div className="px-4 sm:px-8 md:px-16 py-4">
      <div className="flex justify-between overflow-x-auto pb-2 gap-4">
        {Array(6)
          .fill(0)
          .map((_, index) => (
            <div key={index} className="flex flex-col items-center space-y-2 min-w-[80px]">
              <Skeleton className="h-16 w-16 rounded-full" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
      </div>
    </div>
  )
}
