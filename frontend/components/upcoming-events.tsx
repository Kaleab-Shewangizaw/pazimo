"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { ChevronRight, Heart, Eye, EyeOff } from "lucide-react";
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
    wave?: string;
  }>;
  status: string;
  isPublic?: boolean;
};

export default function UpcomingEvents() {
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isWishlistLoading, setIsWishlistLoading] = useState(false);
  const [showSoldOut, setShowSoldOut] = useState<boolean>(true);
  const [sortBy, setSortBy] = useState<string>("newest");
  const [isHovered, setIsHovered] = useState(false);
  const carouselRef = useRef<HTMLDivElement>(null);

  // ----------------------- Helpers -----------------------
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
      return `${hour.toString().padStart(2, "0")}:${minute
        .toString()
        .padStart(2, "0")}`;
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
    return "23:59";
  };

  // Build end datetime with safe fallbacks
  const buildEventEndDate = (event: Event): Date | null => {
    const dateStr = event?.endDate || event?.startDate;
    if (!dateStr) return null;
    const time24 = normalizeTimeTo24h(event?.endTime);

    // Try constructing ISO string first (works if dateStr is YYYY-MM-DD)
    const isoCandidate = `${dateStr}T${time24}:00`;
    const d = new Date(isoCandidate);
    if (!isNaN(d.getTime())) return d;

    // Fallback: if dateStr is already a full ISO string or other format
    const d2 = new Date(dateStr);
    if (!isNaN(d2.getTime())) {
      // If we have a valid date but couldn't append time, just use the date
      // and set time to the parsed time or end of day
      const [h, m] = time24.split(":").map(Number);
      d2.setHours(h || 23, m || 59, 0, 0);
      return d2;
    }
    return null;
  };

  const isTicketTypeAvailable = (ticket: any) => {
    const now = new Date();
    // Check if ticket is explicitly unavailable or quantity is 0
    if (ticket.available === false || ticket.quantity <= 0) return false;

    // Check date ranges if they exist
    if (ticket.startDate && ticket.endDate) {
      const start = new Date(ticket.startDate);
      const end = new Date(ticket.endDate);
      // Set end date to end of day to be inclusive
      end.setHours(23, 59, 59, 999);

      if (now < start || now > end) return false;
    }
    return true;
  };

  const getAvailableTickets = (event: Event) =>
    event.ticketTypes.filter(isTicketTypeAvailable);

  const getCurrentTicket = (event: Event) => {
    const available = getAvailableTickets(event);
    if (available.length === 0) return null;
    return available.reduce((a, b) => (a.price < b.price ? a : b));
  };

  const isEventSoldOut = (event: Event) => {
    const now = new Date();
    const end = buildEventEndDate(event);

    // If event has ended, it's sold out/unavailable
    if (end && end.getTime() <= now.getTime()) return true;

    // If no tickets are available, it's sold out
    const hasAvailableTickets = event.ticketTypes.some(isTicketTypeAvailable);
    return !hasAvailableTickets;
  };

  // ----------------------- Data fetching -----------------------
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/events/public-events`
        );

        if (!response.ok) throw new Error("Failed to fetch events");
        const data = await response.json();

        // Sort by published date (createdAt) descending (newest first)
        // Note: The API might not return createdAt if not selected, but usually it does.
        // If createdAt is missing, fallback to startDate or _id (which contains timestamp)
        const allEvents = data.data || data.events || [];

        // Sort by creation date (newest first) to find "Featured" candidates
        // We assume "Featured" here means "Recently Published" but skipping the very newest ones
        // which are shown in the top carousel.
        // If createdAt is not available, we'll use _id timestamp or startDate as proxy
        const sortedByNewest = [...allEvents].sort((a: any, b: any) => {
          const dateA = a.createdAt
            ? new Date(a.createdAt).getTime()
            : new Date(a.startDate).getTime();
          const dateB = b.createdAt
            ? new Date(b.createdAt).getTime()
            : new Date(b.startDate).getTime();
          return dateB - dateA;
        });

        // Take indices [2, 10] (3rd to 11th events)
        // Slice is 0-indexed, so 3rd event is index 2.
        // slice(2, 11) returns elements at indices 2, 3, 4, 5, 6, 7, 8, 9, 10 (9 events total)
        const featuredEvents = sortedByNewest.slice(2, 11);
        setEvents(featuredEvents);
      } catch (err) {
        toast.error("Failed to load featured events");
      } finally {
        setIsLoading(false);
      }
    };

    const fetchWishlist = async () => {
      // ... (unchanged – kept exactly as you had it)
      // (omitted for brevity – copy-paste your original fetchWishlist code here)
    };

    fetchEvents();
    fetchWishlist();
  }, []);

  // ----------------------- Filtering & Sorting -----------------------
  useEffect(() => {
    let list = [...events];
    // Note: We already sliced the list in fetchEvents, so 'events' contains only the featured ones.
    // We just need to apply the sold-out filter if needed.

    if (!showSoldOut) {
      list = list.filter((e) => !isEventSoldOut(e));
    }

    // We don't re-sort by price/date here because the "Featured" order (by publication date)
    // is the primary sort. However, if the user explicitly changes the sort dropdown (if we had one),
    // we would re-sort. The current UI doesn't seem to have a sort dropdown visible in the code provided,
    // but 'sortBy' state exists. We'll keep the sort logic but default to preserving the "Featured" order
    // unless 'sortBy' is changed from default.

    if (sortBy !== "newest") {
      list.sort((a, b) => {
        const priceA = getCurrentTicket(a)?.price ?? Infinity;
        const priceB = getCurrentTicket(b)?.price ?? Infinity;

        switch (true) {
          case sortBy === "price-low":
            return priceA - priceB;
          case sortBy === "price-high":
            return priceB - priceA;
          default:
            return 0;
        }
      });
    }

    setFilteredEvents(list);
  }, [events, showSoldOut, sortBy]);

  // ----------------------- Auto-scroll -----------------------
  useEffect(() => {
    if (!carouselRef.current || filteredEvents.length === 0 || isHovered)
      return;

    const container = carouselRef.current;
    const interval = setInterval(() => {
      const max = container.scrollWidth - container.clientWidth;
      if (container.scrollLeft >= max) {
        container.scrollTo({ left: 0, behavior: "smooth" });
      } else {
        container.scrollBy({ left: 336, behavior: "smooth" });
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [filteredEvents.length, isHovered]);

  // ----------------------- Formatting helpers -----------------------
  const formatTimeWithAmPm = (time24?: string) => {
    if (!time24) return "";
    const [h, m] = time24.split(":");
    let hour = parseInt(h, 10);
    const minute = m.padStart(2, "0");
    const ampm = hour >= 12 ? "PM" : "AM";
    hour = hour % 12 || 12;
    return `${hour}:${minute} ${ampm}`;
  };

  const formatTimeRange = (start?: string, end?: string) => {
    const s = formatTimeWithAmPm(start);
    const e = formatTimeWithAmPm(end);
    if (!s && !e) return "Time TBA";
    if (!s) return e;
    if (!e) return s;
    return `${s} - ${e}`;
  };

  // ----------------------- Wishlist toggle (unchanged) -----------------------
  const toggleWishlist = async (eventId: string) => {
    // ... (your original toggleWishlist implementation – copy it unchanged)
  };

  // ----------------------- Render logic -----------------------
  if (isLoading) {
    return (
      <div className="px-4 sm:px-8 md:px-16 py-12">
        <div className="animate-pulseite-spin rounded-full h-10 w-10 border-b-2 border-[#1a2d5a] mx-auto"></div>
        <p className="text-center mt-4 text-[#1a2d5a]">
          Loading upcoming events...
        </p>
      </div>
    );
  }

  // No upcoming events at all → hide the whole section
  if (events.length === 0) {
    return null;
  }

  // There are events but after filtering none remain
  if (filteredEvents.length === 0 && !showSoldOut) {
    return (
      <section className="px-4 sm:px-8 md:px-16 py-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-[#1a2d5a]">
            Upcoming <span className="font-bold">Events</span> to look forward
            to
          </h3>
          <div className="flex items-center gap-3">
            <Checkbox
              id="show-sold-out"
              checked={showSoldOut}
              onCheckedChange={(c) => setShowSoldOut(c === true)}
            />
            <label htmlFor="show-sold-out" className="text-sm">
              Show sold out
            </label>
          </div>
        </div>

        <div className="bg-gray-50 rounded-xl p-12 text-center">
          <EyeOff className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h4 className="text-lg font-semibold text-gray-700 mb-2">
            No available tickets right now
          </h4>
          <p className="text-gray-500 mb-6">
            All upcoming events are currently sold out.
          </p>
          <Button
            variant="outline"
            onClick={() => setShowSoldOut(true)}
            className="border-[#1a2d5a] text-[#1a2d5a] hover:bg-[#1a2d5a] hover:text-white"
          >
            <Eye className="h-4 w-4 mr-2" />
            Show sold-out events
          </Button>
        </div>
      </section>
    );
  }

  // Normal render when we have something to show
  return (
    <section className="px-4 sm:px-8 md:px-16 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-[#1a2d5a]">
          Featured <span className="font-bold">Events</span>
        </h3>
        <div className="flex items-center gap-3">
          <Checkbox
            id="show-sold-out"
            checked={showSoldOut}
            onCheckedChange={(c) => setShowSoldOut(c === true)}
          />
          <label htmlFor="show-sold-out" className="text-sm">
            Show sold out
          </label>
        </div>
      </div>

      {/* Carousel */}
      <div
        className="overflow-x-auto scrollbar-hide"
        ref={carouselRef}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
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
      <div className="w-full flex justify-center mt-8">
        <Link href="/event_explore">
          <Button
            variant="outline"
            className="
              border-blue-700 
              text-blue-700 
              hover:bg-blue-700 
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
    </section>
  );
}
