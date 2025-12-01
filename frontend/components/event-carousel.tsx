"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { Heart, Eye, EyeOff, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { toast } from "sonner";

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
  }>;
  status: string;
  isPublic?: boolean;
};

export default function EventCarousel() {
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isWishlistLoading, setIsWishlistLoading] = useState(false);
  const [showSoldOut, setShowSoldOut] = useState<boolean>(true);
  const [sortBy, setSortBy] = useState<string>("newest");
  const carouselRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  // Normalize time to 24h (handles "18:00", "6:00 PM", "6 PM"). Defaults to 23:59
  const normalizeTimeTo24h = (raw?: string): string => {
    if (!raw || typeof raw !== "string") return "23:59";
    const t = raw.trim().toUpperCase();
    const ampm = t.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/);
    if (ampm) {
      let hour = parseInt(ampm[1], 10);
      const minute = ampm[2] ? parseInt(ampm[2], 10) : 0;
      const isPM = ampm[3] === "PM";
      if (hour === 12) hour = isPM ? 12 : 0;
      else if (isPM) hour += 12;
      const hh = hour.toString().padStart(2, "0");
      const mm = minute.toString().padStart(2, "0");
      return `${hh}:${mm}`;
    }
    const hm = t.match(/^(\d{1,2}):(\d{2})$/);
    if (hm) {
      const hh = Math.min(23, Math.max(0, parseInt(hm[1], 10)))
        .toString()
        .padStart(2, "0");
      const mm = Math.min(59, Math.max(0, parseInt(hm[2], 10)))
        .toString()
        .padStart(2, "0");
      return `${hh}:${mm}`;
    }
    const h = t.match(/^(\d{1,2})$/);
    if (h) {
      const hh = Math.min(23, Math.max(0, parseInt(h[1], 10)))
        .toString()
        .padStart(2, "0");
      return `${hh}:00`;
    }
    return "23:59";
  };

  // Build end datetime with safe fallbacks
  const buildEventEndDate = (event: Event): Date | null => {
    const dateStr = event?.endDate || event?.startDate;
    if (!dateStr) return null;
    const time24 = normalizeTimeTo24h(event?.endTime);
    const isoCandidate = `${dateStr}T${time24}:00`;
    const d = new Date(isoCandidate);
    if (!isNaN(d.getTime())) return d;
    const d2 = new Date(dateStr);
    if (!isNaN(d2.getTime())) {
      d2.setHours(23, 59, 0, 0);
      return d2;
    }
    return null;
  };

  // Function to check if a ticket type is currently available
  const isTicketTypeAvailable = (ticket: any) => {
    const now = new Date();

    // Check if ticket is marked as available
    if (ticket.available === false) return false;

    // Check if ticket has quantity
    if (ticket.quantity <= 0) return false;

    // Check ticket-specific date range if exists
    if (ticket.startDate && ticket.endDate) {
      const ticketStart = new Date(ticket.startDate);
      const ticketEnd = new Date(ticket.endDate);
      if (now < ticketStart || now > ticketEnd) return false;
    }

    return true;
  };

  // Function to check if event is sold out
  const isEventSoldOut = (event: Event) => {
    const now = new Date();

    // Check if event end date has passed
    const eventEndDate = buildEventEndDate(event);
    if (eventEndDate && eventEndDate.getTime() <= now.getTime()) return true;

    // Check if all tickets are unavailable (sold out, unavailable, or out of date range)
    return event.ticketTypes.every((ticket) => !isTicketTypeAvailable(ticket));
  };

  useEffect(() => {
    fetchEvents();
    fetchWishlist();
  }, []);

  useEffect(() => {
    filterAndSortEvents();
  }, [events, showSoldOut, sortBy]);

  // Auto-scroll functionality
  useEffect(() => {
    if (!carouselRef.current || filteredEvents.length === 0 || isHovered)
      return;

    const scrollContainer = carouselRef.current;
    const scrollWidth = scrollContainer.scrollWidth;
    const clientWidth = scrollContainer.clientWidth;
    const maxScroll = scrollWidth - clientWidth;

    if (maxScroll <= 0) return; // No need to scroll if content fits

    const interval = setInterval(() => {
      if (scrollContainer.scrollLeft >= maxScroll) {
        // Reset to beginning when reaching the end
        scrollContainer.scrollTo({ left: 0, behavior: "smooth" });
      } else {
        // Scroll by one card width (320px + 16px gap = 336px)
        scrollContainer.scrollBy({ left: 336, behavior: "smooth" });
      }
    }, 10000); // Auto-scroll every 10 seconds

    return () => clearInterval(interval);
  }, [filteredEvents.length, isHovered]);

  const fetchEvents = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/events/public-events`
      );
      if (!response.ok) {
        throw new Error("Failed to fetch events");
      }
      const data = await response.json();

      // The API now returns only published and public events
      // Sort by createdAt descending (newest first) for "Upcoming"
      const sortedEvents = (data.data || data.events || [])
        .sort((a: any, b: any) => {
          const dateA = a.createdAt
            ? new Date(a.createdAt).getTime()
            : new Date(a.startDate).getTime();
          const dateB = b.createdAt
            ? new Date(b.createdAt).getTime()
            : new Date(b.startDate).getTime();
          return dateB - dateA;
        })
        .slice(0, 7); // Take top 7

      setEvents(sortedEvents);
    } catch (error) {
      console.error("Error fetching events:", error);
      toast.error("Failed to fetch events");
    } finally {
      setIsLoading(false);
    }
  };

  const filterAndSortEvents = () => {
    let filtered = [...events];

    // Filter out sold out events if showSoldOut is false
    if (!showSoldOut) {
      filtered = filtered.filter((event) => !isEventSoldOut(event));
    }

    filtered.sort((a, b) => {
      const availableTicketsA = a.ticketTypes.filter((t) =>
        isTicketTypeAvailable(t)
      );
      const availableTicketsB = b.ticketTypes.filter((t) =>
        isTicketTypeAvailable(t)
      );

      const priceA =
        availableTicketsA.length > 0
          ? Math.min(...availableTicketsA.map((t) => t.price))
          : Math.min(...a.ticketTypes.map((t) => t.price));
      const priceB =
        availableTicketsB.length > 0
          ? Math.min(...availableTicketsB.map((t) => t.price))
          : Math.min(...b.ticketTypes.map((t) => t.price));

      switch (sortBy) {
        case "price-low":
          return priceA - priceB;
        case "price-high":
          return priceB - priceA;
        case "newest":
          return (
            new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
          );
        case "availability":
          const aSoldOut = isEventSoldOut(a);
          const bSoldOut = isEventSoldOut(b);
          if (aSoldOut && !bSoldOut) return 1;
          if (!aSoldOut && bSoldOut) return -1;
          return (
            new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
          );
        case "popular":
          return 0;
        default:
          return 0;
      }
    });

    setFilteredEvents(filtered);
  };

  const fetchWishlist = async () => {
    try {
      const storedAuth = localStorage.getItem("auth-storage");
      if (!storedAuth) {
        const localWishlist = localStorage.getItem("event-wishlist");
        if (localWishlist) {
          setWishlist(JSON.parse(localWishlist));
        }
        return;
      }

      const parsedAuth = JSON.parse(storedAuth);
      const userId = parsedAuth.state?.user?._id;

      if (!userId) {
        const localWishlist = localStorage.getItem("event-wishlist");
        if (localWishlist) {
          setWishlist(JSON.parse(localWishlist));
        }
        return;
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/events/${userId}/wishlist`
      );
      if (!response.ok) {
        throw new Error("Failed to fetch wishlist");
      }

      const data = await response.json();
      if (data.data && Array.isArray(data.data)) {
        const wishlistIds = data.data.map(
          (item: any) => item.eventId || item._id
        );
        setWishlist(wishlistIds);
      }
    } catch (error) {
      console.error("Error fetching wishlist:", error);
      const localWishlist = localStorage.getItem("event-wishlist");
      if (localWishlist) {
        setWishlist(JSON.parse(localWishlist));
      }
    }
  };

  const formatTimeWithAmPm = (time24?: string): string => {
    if (!time24) return "";

    const [hourStr, minuteStr] = time24.split(":");
    if (hourStr === undefined || minuteStr === undefined) return time24;

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

  const toggleWishlist = async (eventId: string) => {
    try {
      setIsWishlistLoading(true);
      const storedAuth = localStorage.getItem("auth-storage");
      let userId;

      if (storedAuth) {
        const parsedAuth = JSON.parse(storedAuth);
        userId = parsedAuth.state?.user?._id;
      }

      const newWishlist = wishlist.includes(eventId)
        ? wishlist.filter((id) => id !== eventId)
        : [...wishlist, eventId];
      setWishlist(newWishlist);
      localStorage.setItem("event-wishlist", JSON.stringify(newWishlist));

      if (userId) {
        const action = wishlist.includes(eventId) ? "remove" : "add";
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/events/${userId}/wishlist`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              eventId,
              action,
            }),
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to ${action} event to wishlist`);
        }

        toast.success(
          wishlist.includes(eventId)
            ? "Removed from wishlist"
            : "Added to wishlist"
        );
      } else {
        toast.success(
          wishlist.includes(eventId)
            ? "Removed from wishlist"
            : "Added to wishlist"
        );
      }
    } catch (error) {
      console.error("Error updating wishlist:", error);
      toast.error("Failed to update wishlist");
      await fetchWishlist();
    } finally {
      setIsWishlistLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1a2d5a] mx-auto"></div>
          <p className="mt-2 text-[#1a2d5a]">Loading events...</p>
        </div>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-[#1a2d5a]">No events available</p>
        </div>
      </div>
    );
  }

  if (filteredEvents.length === 0 && !showSoldOut) {
    return (
      <div className="relative px-4 sm:px-8 md:px-16 py-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-[#1a2d5a]">
            Upcoming Events
          </h3>
          <div className="flex items-center gap-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="show-sold-out-carousel"
                checked={showSoldOut}
                onCheckedChange={(checked) => setShowSoldOut(checked === true)}
              />
              <label
                htmlFor="show-sold-out-carousel"
                className="text-sm font-medium"
              >
                Show sold out
              </label>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-center min-h-[300px] bg-gray-50 rounded-xl">
          <div className="text-center p-8">
            <EyeOff className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">
              No Available Events
            </h3>
            <p className="text-gray-500 mb-4">
              All events are currently sold out.
            </p>
            <Button
              variant="outline"
              onClick={() => setShowSoldOut(true)}
              className="border-[#1a2d5a] text-[#1a2d5a] hover:bg-[#1a2d5a] hover:text-white"
            >
              <Eye className="h-4 w-4 mr-2" />
              Show sold out events
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative px-4 sm:px-8 md:px-16 py-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-[#1a2d5a]">
          Upcoming Events
        </h3>
      </div>

      <div
        className="overflow-x-auto scrollbar-hide"
        ref={carouselRef}
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="flex gap-4 pb-4">
          {filteredEvents.map((event) => (
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
                  <div className="relative aspect-[4/5] overflow-hidden bg-gray-100">
                    <Image
                      src={
                        event.coverImages && event.coverImages.length > 0
                          ? event.coverImages[0].startsWith("http")
                            ? event.coverImages[0]
                            : `${process.env.NEXT_PUBLIC_API_URL}${
                                event.coverImages[0].startsWith("/")
                                  ? event.coverImages[0]
                                  : `/${event.coverImages[0]}`
                              }`
                          : "/placeholder.svg?height=400&width=320&text=Event+Poster"
                      }
                      alt={event.title}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-110"
                      sizes="320px"
                      quality={90}
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src =
                          "/placeholder.svg?height=400&width=320&text=Event+Poster";
                      }}
                    />

                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  </div>

                  {/* Wishlist Button */}
                  <button
                    className={cn(
                      "absolute bottom-3 right-3 p-2.5 rounded-full bg-white/90 backdrop-blur-sm transition-all duration-300 shadow-lg hover:shadow-xl",
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
                      {event.location.city}, {event.location.country}
                    </p>
                    <h3 className="font-bold text-lg text-gray-900 line-clamp-2 leading-tight group-hover:text-[#1a2d5a] transition-colors">
                      {event.title}
                    </h3>
                  </div>

                  <div className="flex items-center justify-between mb-4">
                    <div className="bg-gradient-to-r from-[#1a2d5a]/10 to-[#1a2d5a]/5 rounded-lg px-3 py-2">
                      <p className="text-[#1a2d5a] font-bold text-sm">
                        {(() => {
                          const availableTickets = event.ticketTypes.filter(
                            (ticket) => isTicketTypeAvailable(ticket)
                          );

                          if (availableTickets.length === 0) {
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
                    <Link href={`event_detail?id=${event._id}`} passHref>
                      <Button className="w-full bg-[#1a2d5a] hover:bg-[#1a2d5a]/90 text-white font-semibold py-2.5 rounded-lg transition-all duration-200 hover:shadow-lg transform hover:scale-[1.02]">
                        Get Tickets
                      </Button>
                    </Link>
                  ) : (
                    <Button
                      disabled
                      className="w-full bg-gray-300 text-gray-500 font-semibold py-2.5 rounded-lg cursor-not-allowed"
                    >
                      Sold Out
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* View All Button */}
      <div className="w-full flex justify-center mt-6">
        <Link href="/event_explore">
          <Button
            variant="outline"
            className="
              border-[#1a2d5a] 
              text-[#1a2d5a] 
              hover:bg-[#1a2d5a] 
              hover:text-white
              transition 
              px-6 
              py-2 
              rounded-lg 
              text-sm 
              sm:text-base 
              flex 
              items-center 
              gap-1
              backdrop-blur-md bg-white/30
            "
          >
            View All Events
            <ChevronRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
