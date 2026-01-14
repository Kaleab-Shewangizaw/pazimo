"use client";

import { useRef, useState, useEffect } from "react";
import { useWishlist } from "@/hooks/useWishlist";
import { ChevronRight, ImageIcon } from "lucide-react";
import Image from "next/image";
import { Heart, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { toast } from "sonner";
import EventCard from "./eventCard";

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
  isSoldOut?: boolean;
};

export default function EventCarousel() {
  const {
    wishlist,
    toggleWishlist,
    isLoading: isWishlistLoading,
  } = useWishlist();
  const [events, setEvents] = useState<Event[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // const [isWishlistLoading, setIsWishlistLoading] = useState(false);
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
    // Check manual sold out flag
    if (event.isSoldOut) return true;

    // Check if event status is not published
    if (event.status && event.status !== "published") return true;

    const now = new Date();

    // Check if event end date has passed
    const eventEndDate = buildEventEndDate(event);
    if (eventEndDate && eventEndDate.getTime() <= now.getTime()) return true;

    // Check if all tickets are unavailable (sold out, unavailable, or out of date range)
    return event.ticketTypes.every((ticket) => !isTicketTypeAvailable(ticket));
  };

  useEffect(() => {
    fetchEvents();
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

  // Wishlist fetching handled by useWishlist hook

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

  // Wishlist toggle handled by useWishlist hook

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1a2d5a] mx-auto"></div>
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
            <EventCard
              key={event._id}
              event={event}
              isEventSoldOut={isEventSoldOut}
              wishlist={wishlist}
              formatTimeRange={formatTimeRange}
              isWishlistLoading={isWishlistLoading}
              toggleWishlist={toggleWishlist}
              isTicketTypeAvailable={isTicketTypeAvailable}
            />
          ))}
        </div>
      </div>

      {/* View All Button */}
      <div className="w-full flex justify-center mt-6">
        <Link href="/event_explore">
          <Button
            variant="outline"
            className="
              border-[#0d47a1] 
              text-[#0d47a1]
              hover:bg-[#0d47a1]/90
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
