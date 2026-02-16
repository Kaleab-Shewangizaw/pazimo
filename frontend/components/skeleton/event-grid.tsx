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

"use client";
import FeaturedEventCard from "@/components/featured-event-card";

type Event = {
  _id: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  location: {
    address: string;
    city: string;
    country: string;
  };
  category: {
    _id: string;
    name: string;
    description: string;
  };
  coverImages: string[];
  ticketTypes: Array<{
    name: string;
    price: number;
    quantity: number;
    available?: boolean;
    description?: string;
    startDate?: string;
    endDate?: string;
  }>;
  status: string;
  ageLimit?: string;
  capacity?: number;
};

interface EventGridProps {
  events: Event[];
  wishlist: string[];
  onToggleWishlist: (eventId: string) => void;
  isWishlistLoading: boolean;
  isEventSoldOut: (event: Event) => boolean;
}

export default function EventGrid({
  events,
  wishlist,
  onToggleWishlist,
  isWishlistLoading,
  isEventSoldOut,
}: EventGridProps) {
  if (events.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="max-w-md mx-auto">
          <div className="w-24 h-24 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
            <svg
              className="w-12 h-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">
            No Events Found
          </h3>
          <p className="text-gray-500">
            Try adjusting your filters to find more events
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6">
      {events.map((event) => {
        const isSoldOut = isEventSoldOut(event);
        const now = new Date();
        const hasWave = (t: Event["ticketTypes"][number]) =>
          !!(t.startDate && t.endDate) ||
          (t.description || "").toLowerCase().includes("wave");

        const anyWave = (event.ticketTypes || []).some(hasWave);
        let currentTicketPrice = event.ticketTypes[0]?.price || 0;
        if (anyWave) {
          const activeWaveTickets = (event.ticketTypes || []).filter((t) => {
            if (!hasWave(t)) return false;
            if (t.available === false) return false;
            if (t.startDate && t.endDate) {
              const s = new Date(t.startDate);
              const e = new Date(t.endDate);
              return now >= s && now <= e;
            }
            return false;
          });
          if (activeWaveTickets.length > 0) {
            activeWaveTickets.sort(
              (a, b) =>
                new Date(b.startDate as string).getTime() -
                new Date(a.startDate as string).getTime(),
            );
            currentTicketPrice = activeWaveTickets[0].price;
          }
        }

        const image = event.coverImages?.[0]
          ? event.coverImages[0].startsWith("http")
            ? event.coverImages[0]
            : `${process.env.NEXT_PUBLIC_API_URL}${
                event.coverImages[0].startsWith("/")
                  ? event.coverImages[0]
                  : `/${event.coverImages[0]}`
              }`
          : undefined;

        return (
          <FeaturedEventCard
            key={event._id}
            data={{
              id: event._id,
              href: `/event_detail?id=${event._id}`,
              title: event.title,
              tag: event.category?.name || "",
              dateLabel: new Date(event.startDate).toLocaleDateString(
                "en-US",
                {
                  month: "short",
                  day: "numeric",
                },
              ),
              locationLabel: `${event.location.city}, ${event.location.country}`,
              priceLabel: currentTicketPrice ? `${currentTicketPrice} ETB` : "Free",
              image,
              soldOut: isSoldOut,
            }}
            wishlist={wishlist}
            onToggleWishlist={onToggleWishlist}
            isWishlistLoading={isWishlistLoading}
            showCTA={false}
          />
        );
      })}
    </div>
  );
}
