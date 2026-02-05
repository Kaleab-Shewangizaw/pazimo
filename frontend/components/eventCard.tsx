import { HeartIcon, ImageIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

type Event = {
  _id: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
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
    wave?: string;
  }>;
  status: string;
  isPublic?: boolean;
  isSoldOut?: boolean;
};

interface EventCardProps {
  event: Event;
  isEventSoldOut: (event: Event) => boolean;
  wishlist: string[];
  formatTimeRange: (start: string, end: string) => string;
  isWishlistLoading: boolean;
  toggleWishlist: (eventId: string) => void;
  isTicketTypeAvailable: (ticket: any) => boolean;
}

export default function EventCard({
  event,
  isEventSoldOut,
  wishlist,
  formatTimeRange,
  isWishlistLoading,
  toggleWishlist,
  isTicketTypeAvailable,
}: EventCardProps) {
  return (
    <div key={event._id} className="w-80 flex-shrink-0">
      <div className="bg-white rounded-xl shadow-lg overflow-hidden transform transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 group">
        <div className="relative">
          {/* Category Badge */}
          <div className="absolute top-3 left-3 bg-[#ffc107] text-white text-xs font-bold px-3 py-1.5 rounded-lg z-10 shadow-md">
            {event.category?.name || "Uncategorized"}
          </div>

          {/* Sold Out Badge */}
          {isEventSoldOut(event) && (
            <div className="absolute top-3 right-3 bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg z-20 shadow-md">
              SOLD OUT
            </div>
          )}

          {/* Enhanced Image Container */}
          <div className="relative aspect-[4/5] overflow-hidden bg-gray-100 flex items-center justify-center">
            {/* Fallback Icon */}
            <ImageIcon className="w-16 h-16 text-gray-300 absolute z-0" />

            {event.coverImages && event.coverImages.length > 0 && (
              <Link href={`event_detail?id=${event._id}`} className="block w-full h-full relative">
                <Image
                  src={
                    event.coverImages[0].startsWith("http")
                      ? event.coverImages[0]
                      : `${process.env.NEXT_PUBLIC_API_URL}${
                          event.coverImages[0].startsWith("/")
                            ? event.coverImages[0]
                            : `/${event.coverImages[0]}`
                        }`
                  }
                  alt={event.title}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-110"
                  sizes="(max-width: 640px) 320px, 320px"
                  quality={85}
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                />
              </Link>
            )}

            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10 pointer-events-none" />
          </div>

          {/* Wishlist Button */}
          <button
            className={cn(
              "absolute bottom-3 right-3 p-2.5 rounded-full bg-white/90 backdrop-blur-sm transition-all duration-300 shadow-lg hover:shadow-xl z-20",
              wishlist.includes(event._id)
                ? "text-red-500 bg-red-50"
                : "text-gray-600 hover:text-red-500",
              isWishlistLoading
                ? "opacity-50 cursor-not-allowed"
                : "hover:scale-110"
            )}
            onClick={() => toggleWishlist(event._id)}
            disabled={isWishlistLoading}
            aria-label={
              wishlist.includes(event._id)
                ? "Remove from wishlist"
                : "Add to wishlist"
            }
          >
            <HeartIcon
              className={cn(
                "h-5 w-5",
                isWishlistLoading ? "animate-pulse" : ""
              )}
              fill={wishlist.includes(event._id) ? "currentColor" : "none"}
            />
          </button>

          {/* Date Badge */}
          <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-sm text-[#1a2d5a] text-xs font-semibold px-3 py-1.5 rounded-lg shadow-md z-20">
            {new Date(event.startDate).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </div>
        </div>

        {/* Card Content */}
        <div className="p-5">
          <div className="mb-3">
            <p className="text-gray-500 text-sm font-medium mb-1">
              {event.location.city}, {event.location.country}
            </p>
            <Link href={`event_detail?id=${event._id}`}>
              <h3 className="font-bold text-lg text-gray-900 line-clamp-2 leading-tight group-hover:text-[#1a2d5a] transition-colors">
                {event.title}
              </h3>
            </Link>
          </div>

          <div className="flex items-center justify-between mb-4">
            <div className="bg-gradient-to-r from-[#1a2d5a]/10 to-[#1a2d5a]/5 rounded-lg px-3 py-2">
              <p className="text-[#1a2d5a] font-bold text-sm">
                {(() => {
                  const availableTickets = event.ticketTypes.filter(
                    isTicketTypeAvailable
                  );

                  if (availableTickets.length === 0) {
                    const lowestPrice = Math.min(
                      ...event.ticketTypes.map((t) => t.price)
                    );
                    return lowestPrice > 0 ? `${lowestPrice} ETB` : "Free";
                  }

                  const lowestAvailablePrice = Math.min(
                    ...availableTickets.map((t) => t.price)
                  );
                  return lowestAvailablePrice > 0
                    ? `${lowestAvailablePrice} ETB`
                    : "Free";
                })()}
              </p>
            </div>

            <div className="text-xs text-gray-500">
              {formatTimeRange(event.startTime, event.endTime)}
            </div>
          </div>

          {/* Action Button */}
          {!isEventSoldOut(event) ? (
            <Link href={`event_detail?id=${event._id}`} passHref>
              <Button className="w-full bg-[#1a2d5a] hover:bg-[#1a2d5a]/90 text-white font-semibold py-2.5 rounded-lg transition-all duration-200 hover:shadow-lg transform hover:scale-[1.02]">
                Get Tickets
              </Button>
            </Link>
          ) : (
            <Link href={`event_detail?id=${event._id}`} passHref>
              <Button
                variant="outline"
                className="w-full border-red-500 text-red-500 hover:bg-red-50 font-semibold py-2.5 rounded-lg"
              >
                Sold Out
              </Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
