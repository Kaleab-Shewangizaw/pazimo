// "use client"

// import { useEffect, useState } from "react"
// import Image from "next/image"
// import Link from "next/link"
// import { Button } from "@/components/ui/button"
// import { Heart } from "lucide-react"
// import { cn } from "@/lib/utils"
// import { toast } from "sonner"

// type Event = {
//   _id: string
//   title: string
//   description: string
//   startDate: string
//   endDate: string
//   location: {
//     address: string
//     city: string
//     country: string
//   }
//   category: {
//     _id: string
//     name: string
//     description: string
//   }
//   coverImages: string[]
//   ticketTypes: Array<{
//     name: string
//     price: number
//     quantity: number
//   }>
//   status: string
// }

// interface EventGridProps {
//   events: Event[]
// }

// export default function EventGrid({ events }: EventGridProps) {
//   const [wishlist, setWishlist] = useState<string[]>([])

//   const toggleWishlist = (id: string) => {
//     if (wishlist.includes(id)) {
//       setWishlist(wishlist.filter((itemId) => itemId !== id))
//     } else {
//       setWishlist([...wishlist, id])
//     }
//   }

//   if (events.length === 0) {
//     return (
//       <div className="text-center py-12">
//         <p className="text-gray-500">No events available</p>
//       </div>
//     )
//   }

//   return (
//     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
//       {events.map((event) => (
//         <Link 
//           href={`/event_detail?id=${event._id}`} 
//           key={event._id} 
//           className="bg-white rounded-xl shadow-lg overflow-hidden transform transition-all duration-300 hover:shadow-xl hover:-translate-y-1 group"
//         >
//           <div className="relative">
//             <div className="absolute top-0 left-0 bg-[#ffc107] text-white text-xs font-bold px-3 py-1 rounded-br-lg z-10">
//               {event.category?.name || 'Uncategorized'}
//             </div>
//             <Image
//               src={event.coverImages && event.coverImages.length > 0 ? 
//                 (event.coverImages[0].startsWith('http') ? event.coverImages[0] : `${process.env.NEXT_PUBLIC_API_URL}${event.coverImages[0].startsWith('/') ? event.coverImages[0] : `/${event.coverImages[0]}`}`) 
//                 : "/events/eventimg.png"}
//               alt={event.title}
//               width={400}
//               height={300}
//               className="w-full h-48 object-cover transition-transform duration-300 group-hover:scale-105"
//             />
//             <button
//               className={cn(
//                 "absolute top-3 right-3 p-2 rounded-full bg-white/80 backdrop-blur-sm transition-all duration-300",
//                 wishlist.includes(event._id) ? "text-red-500" : "text-gray-500 hover:text-red-500",
//               )}
//               onClick={(e) => {
//                 e.preventDefault(); // Prevent navigation when clicking wishlist
//                 toggleWishlist(event._id);
//               }}
//               aria-label="Add to wishlist"
//             >
//               <Heart className="h-5 w-5" fill={wishlist.includes(event._id) ? "currentColor" : "none"} />
//             </button>
//             <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3 text-white">
//               <p className="text-sm font-medium">{new Date(event.startDate).toLocaleDateString()}</p>
//             </div>
//           </div>
//           <div className="p-4">
//             <div className="flex justify-between items-start">
//               <div>
//                 <p className="text-gray-500 text-sm">{event.location.city}, {event.location.country}</p>
//                 <h3 className="font-medium text-lg">{event.title}</h3>
//               </div>
//               <div className="bg-[#1a2d5a]/10 rounded-lg px-3 py-1">
//                 <p className="text-[#1a2d5a] font-bold">
//                   {event.ticketTypes[0]?.price ? `${event.ticketTypes[0].price} ETB` : 'Free'}
//                 </p>
//               </div>
//             </div>
//             <Button className="w-full mt-4 bg-[#1a2d5a] hover:bg-[#1a2d5a]/90 text-white">
//               Get Tickets
//             </Button>
//           </div>
//         </Link>
//       ))}
//     </div>
//   )
// }

"use client"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Heart, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useState } from "react"

type Event = {
  _id: string
  title: string
  description: string
  startDate: string
  endDate: string
  location: {
    address: string
    city: string
    country: string
  }
  category: {
    _id: string
    name: string
    description: string
  }
  coverImages: string[]
  ticketTypes: Array<{
    name: string
    price: number
    quantity: number
    available?: boolean
    description?: string
    startDate?: string
    endDate?: string
  }>
  status: string
  ageLimit?: string
  capacity?: number
}

interface EventGridProps {
  events: Event[]
  wishlist: string[]
  onToggleWishlist: (eventId: string) => void
  isWishlistLoading: boolean
  isEventSoldOut: (event: Event) => boolean
}

export default function EventGrid({
  events,
  wishlist,
  onToggleWishlist,
  isWishlistLoading,
  isEventSoldOut,
}: EventGridProps) {
  const [loadingEventId, setLoadingEventId] = useState<string | null>(null)

  const handleEventClick = (eventId: string) => {
    setLoadingEventId(eventId)
  }
  if (events.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="max-w-md mx-auto">
          <div className="w-24 h-24 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
            <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No Events Found</h3>
          <p className="text-gray-500">Try adjusting your filters to find more events</p>
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
      {events.map((event) => {
        const isSoldOut = isEventSoldOut(event)
        const now = new Date()
        const hasWave = (t: Event["ticketTypes"][number]) =>
          !!(t.startDate && t.endDate) || (t.description || "").toLowerCase().includes("wave")

        // If any ticket is a wave ticket, show only current active wave's price; otherwise keep original
        const anyWave = (event.ticketTypes || []).some(hasWave)
        let currentTicketPrice = event.ticketTypes[0]?.price || 0
        if (anyWave) {
          const activeWaveTickets = (event.ticketTypes || []).filter((t) => {
            if (!hasWave(t)) return false
            if (t.available === false) return false
            if (t.startDate && t.endDate) {
              const s = new Date(t.startDate)
              const e = new Date(t.endDate)
              return now >= s && now <= e
            }
            return false
          })
          if (activeWaveTickets.length > 0) {
            // If multiple are active, pick the one with latest startDate (most recent wave)
            activeWaveTickets.sort((a, b) => new Date(b.startDate as string).getTime() - new Date(a.startDate as string).getTime())
            currentTicketPrice = activeWaveTickets[0].price
          }
        }

        const cardContent = (
          <div
            key={event._id}
            className="bg-white rounded-xl shadow-lg overflow-hidden transform transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 group border border-gray-100"
          >
            <div className="relative">
              {/* Category Badge */}
              <div className="absolute top-3 left-3 bg-[#ffc107] text-white text-xs font-bold px-3 py-1.5 rounded-lg z-10 shadow-md">
                {event.category?.name || "Uncategorized"}
              </div>

              {/* Sold Out Badge */}
              {isSoldOut && (
                <div className="absolute top-3 right-3 bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg z-20 shadow-md animate-pulse">
                  SOLD OUT
                </div>
              )}

              {/* Enhanced Image Container */}
              <div className="relative aspect-[4/5] overflow-hidden bg-gray-100">
                <Image
                  src={
                    event.coverImages && event.coverImages.length > 0
                      ? event.coverImages[0].startsWith("http")
                        ? event.coverImages[0]
                        : `${process.env.NEXT_PUBLIC_API_URL}${event.coverImages[0].startsWith("/") ? event.coverImages[0] : `/${event.coverImages[0]}`}`
                      : "/placeholder.svg?height=400&width=320&text=Event+Poster"
                  }
                  alt={event.title}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-110"
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  quality={90}
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    target.src = "/placeholder.svg?height=400&width=320&text=Event+Poster"
                  }}
                />

                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </div>

              {/* Wishlist Button */}
              <button
                className={cn(
                  "absolute bottom-3 right-3 p-2.5 rounded-full bg-white/90 backdrop-blur-sm transition-all duration-300 shadow-lg hover:shadow-xl",
                  wishlist.includes(event._id) ? "text-red-500 bg-red-50" : "text-gray-600 hover:text-red-500",
                  isWishlistLoading ? "opacity-50 cursor-not-allowed" : "hover:scale-110",
                  isSoldOut ? "opacity-60" : "",
                )}
                onClick={(e) => {
                  e.preventDefault() // Prevent navigation when clicking wishlist
                  onToggleWishlist(event._id)
                }}
                disabled={isWishlistLoading}
                aria-label={wishlist.includes(event._id) ? "Remove from wishlist" : "Add to wishlist"}
              >
                <Heart
                  className={cn("h-5 w-5", isWishlistLoading ? "animate-pulse" : "")}
                  fill={wishlist.includes(event._id) ? "currentColor" : "none"}
                />
              </button>

              {/* Date Badge */}
              <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-sm text-[#1a2d5a] text-xs font-semibold px-3 py-1.5 rounded-lg shadow-md">
                {new Date(event.startDate).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </div>
            </div>

            {/* Enhanced Card Content */}
            <div className="p-5">
              <div className="mb-3">
                <p className="text-gray-500 text-sm font-medium mb-1">
                  {event.location.city}, {event.location.country}
                </p>
                <h3 className="font-bold text-lg text-gray-900 line-clamp-2 leading-tight group-hover:text-[#1a2d5a] transition-colors">
                  {event.title}
                </h3>
              </div>

              <div className="flex items-center justify-between mb-4">
                <div className="bg-gradient-to-r from-[#1a2d5a]/10 to-[#1a2d5a]/5 rounded-lg px-3 py-2">
                  <p className="text-[#1a2d5a] font-bold text-sm">
                    {currentTicketPrice ? `${currentTicketPrice} ETB` : "Free"}
                  </p>
                </div>
                <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-md">
                  {new Date(event.startDate).toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>

              {/* Action Button */}
              {!isSoldOut ? (
                <Button className="w-full bg-[#1a2d5a] hover:bg-[#1a2d5a]/90 text-white font-semibold py-2.5 rounded-lg transition-all duration-200 hover:shadow-lg transform hover:scale-[1.02]">
                  Get Tickets
                </Button>
              ) : (
                <Button
                  disabled
                  className="w-full bg-gray-300 text-gray-500 font-semibold py-2.5 rounded-lg"
                >
                  Event Sold Out
                </Button>
              )}
            </div>
          </div>
        )

        return isSoldOut ? cardContent : (
          <Link href={`/event_detail?id=${event._id}`} onClick={() => handleEventClick(event._id)}>
            <div className="relative">
              {cardContent}
              {loadingEventId === event._id && (
                <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center rounded-xl">
                  <div className="text-center">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-[#1a2d5a]" />
                    <p className="text-sm text-gray-600">Loading...</p>
                  </div>
                </div>
              )}
            </div>
          </Link>
        )
      })}
    </div>
  )
}
