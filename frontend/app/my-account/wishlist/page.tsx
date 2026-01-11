"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, Heart, Calendar, MapPin, Ticket, Loader2 } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { useWishlist } from "@/hooks/useWishlist";
import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";

type Event = {
  _id: string;
  title: string;
  description?: string;
  startDate: string;
  endDate?: string;
  location?: {
    address?: string;
    city?: string;
    country?: string;
  };
  category?: string | { name: string };
  coverImages?: string[];
  coverImage?: string;
  ticketTypes?: Array<{
    name: string;
    price: number;
    quantity: number;
  }>;
  status?: string;
  organizer?: {
    name?: string;
    email?: string;
  };
};

export default function WishlistPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [wishlistItems, setWishlistItems] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { token } = useAuthStore();

  // Use global wishlist hook
  const {
    wishlist,
    toggleWishlist,
    isLoading: isWishlistLoading,
  } = useWishlist();

  // Helper functions used in cards
  const isTicketTypeAvailable = (ticketType: any) => {
    if (!ticketType) return false;
    // Basic check: quantity > 0 (assuming you have a 'quantity' or 'sold' field logic)
    // Adjust based on your actual Ticket model/Type
    return ticketType.quantity > 0;
  };

  const isEventSoldOut = (event: Event) => {
    if (event.status === "cancelled" || event.status === "postponed")
      return true;
    if (!event.ticketTypes || event.ticketTypes.length === 0) return false;
    return event.ticketTypes.every((ticket) => !isTicketTypeAvailable(ticket));
  };

  const formatTimeWithAmPm = (time24?: string): string => {
    if (!time24) return "";
    const [hourStr, minuteStr] = time24.split(":");
    if (!hourStr || !minuteStr) return time24;
    let hour = parseInt(hourStr, 10);
    const minute = parseInt(minuteStr, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    hour = hour % 12;
    if (hour === 0) hour = 12;
    const minuteFormatted = minute < 10 ? `0${minute}` : minute;
    return `${hour}:${minuteFormatted} ${ampm}`;
  };

  const formatTimeRange = (startTime?: string, endTime?: string) => {
    const start = formatTimeWithAmPm(startTime);
    const end = formatTimeWithAmPm(endTime);
    if (!start && !end) return "Time TBA";
    if (!start) return end;
    if (!end) return start;
    return `${start} - ${end}`;
  };

  useEffect(() => {
    fetchWishlistItems();
  }, []);

  const fetchWishlistItems = async () => {
    try {
      setIsLoading(true);

      const storedAuth = localStorage.getItem("auth-storage");
      let userId;

      if (storedAuth) {
        const parsedAuth = JSON.parse(storedAuth);
        // Handle both id and _id formats which might vary across auth versions
        userId = parsedAuth.state?.user?._id || parsedAuth.state?.user?.id;
      }

      let wishlistEventIds: string[] = [];

      if (userId && token) {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/events/${userId}/wishlist`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          console.error(
            `Failed to fetch wishlist from API: ${response.status} ${response.statusText}`
          );
          const text = await response.text();
          console.error("Response body:", text);
        } else {
          const data = await response.json();
          if (data.data && Array.isArray(data.data)) {
            // New backend returns populated event objects directly!
            // We can use them directly.

            // Filter out any nulls just in case population failed for deleted events
            const events = data.data.filter((item: any) => item && item._id);
            setWishlistItems(events);
            setIsLoading(false);
            return; // Exit early as we have the data
          }
        }
      }

      // Fallback for non-logged in or if API failed/returned empty but we want to check local logic?
      // Actually strictly speaking, if userId exists we trust the API.
      // If we fall through here, it means we are checking local storage (guest mode).

      if (!userId) {
        const localWishlist = localStorage.getItem("event-wishlist");
        if (localWishlist) {
          try {
            wishlistEventIds = JSON.parse(localWishlist);
          } catch (e) {
            console.error("Error parsing local wishlist", e);
            wishlistEventIds = [];
          }
        }
      }

      if (wishlistEventIds.length > 0) {
        const eventDetails: Event[] = [];
        // We fetch details individually to ensure we get the full Event object structure
        // required by the UI (description, organizer, etc.), which might be missing
        // from the populated wishlist response depending on backend projection.
        const eventPromises = wishlistEventIds.map((eventId) =>
          fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/api/events/details/${eventId}`
          )
            .then((res) => (res.ok ? res.json() : null))
            .catch((err) => {
              console.error(
                `Error fetching details for event ${eventId}:`,
                err
              );
              return null;
            })
        );

        const results = await Promise.all(eventPromises);

        results.forEach((eventData) => {
          if (eventData && eventData.data) {
            eventDetails.push(eventData.data); // data.data is the convention based on other files
          } else if (eventData && eventData.event) {
            eventDetails.push(eventData.event); // fallback
          }
        });

        setWishlistItems(eventDetails);
      } else {
        setWishlistItems([]);
      }
    } catch (error) {
      console.error("Error fetching wishlist items:", error);
      toast.error("Failed to load wishlist");
    } finally {
      setIsLoading(false);
    }
  };

  const filteredItems = wishlistItems
    .filter((item) => wishlist.includes(item._id)) // Only show items currently in wishlist hook state
    .filter(
      (item) =>
        item.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.location?.city
          ?.toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        item.location?.country
          ?.toLowerCase()
          .includes(searchQuery.toLowerCase())
    );

  const formatDate = (dateString: string) =>
    dateString
      ? new Date(dateString).toLocaleDateString("en-US", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : "N/A";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-[#1a2d5a]" />
          <p className="mt-2 text-[#1a2d5a]">Loading wishlist...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0 mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-bold">Wishlist</h1>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
          <Input
            placeholder="Search events..."
            className="pl-10 h-10 w-full"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {wishlistItems.length === 0 ? (
        <div className="text-center py-12">
          <Heart className="h-12 w-12 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900">
            Your wishlist is empty
          </h3>
          <p className="text-gray-500 mt-2 mb-6">
            Explore events and add them to your wishlist!
          </p>
          <Link href="/event_explore">
            <Button>Explore Events</Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredItems.map((event) => (
            <div
              key={event._id}
              className="bg-white rounded-xl shadow-lg overflow-hidden transform transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 group"
            >
              <div className="relative">
                {/* Category Badge */}
                <div className="absolute top-3 left-3 bg-[#ffc107] text-white text-xs font-bold px-3 py-1.5 rounded-lg z-10 shadow-md">
                  {typeof event.category === "object" && event.category?.name
                    ? event.category.name
                    : event.category || "Uncategorized"}
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
                  <ImageIcon className="w-16 h-16 text-gray-300" />

                  {event.coverImages && event.coverImages.length > 0 && (
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
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      quality={90}
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  )}

                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>

                {/* Wishlist Button */}
                <button
                  className={cn(
                    "absolute bottom-3 right-3 p-2.5 rounded-full bg-white/90 backdrop-blur-sm transition-all duration-300 shadow-lg hover:shadow-xl",
                    wishlist.includes(event._id)
                      ? "text-red-500 bg-red-50"
                      : "text-gray-600 hover:text-red-50",
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
                  <Heart
                    className={cn(
                      "h-5 w-5",
                      isWishlistLoading ? "animate-pulse" : ""
                    )}
                    fill={
                      wishlist.includes(event._id) ? "currentColor" : "none"
                    }
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
                    {event.location?.city || "TBA"},{" "}
                    {event.location?.country || ""}
                  </p>
                  <h3 className="font-bold text-lg text-gray-900 line-clamp-2 leading-tight group-hover:text-[#1a2d5a] transition-colors">
                    {event.title}
                  </h3>
                </div>

                <div className="flex items-center justify-between mb-4">
                  <div className="bg-gradient-to-r from-[#1a2d5a]/10 to-[#1a2d5a]/5 rounded-lg px-3 py-2">
                    <p className="text-[#1a2d5a] font-bold text-sm">
                      {(() => {
                        if (!event.ticketTypes) return "Free";
                        const availableTickets = event.ticketTypes.filter(
                          (ticket) => isTicketTypeAvailable(ticket)
                        );

                        if (availableTickets.length === 0) {
                          if (!event.ticketTypes.length) return "Free";
                          const lowestPrice = Math.min(
                            ...event.ticketTypes.map((t) => t.price)
                          );
                          return lowestPrice > 0
                            ? `${lowestPrice} ETB`
                            : "Free";
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
                  <Link href={`/event_detail?id=${event._id}`} passHref>
                    <Button className="w-full bg-[#1a2d5a] hover:bg-[#1a2d5a]/90 text-white font-semibold py-2.5 rounded-lg transition-all duration-200 hover:shadow-lg transform hover:scale-[1.02]">
                      Get Tickets
                    </Button>
                  </Link>
                ) : (
                  <Link href={`/event_detail?id=${event._id}`} passHref>
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
          ))}
        </div>
      )}
    </div>
  );
}
