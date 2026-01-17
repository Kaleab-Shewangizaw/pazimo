"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWishlist } from "@/hooks/useWishlist"; // Import hook

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
    wave?: string;
  }>;
  status: string;
  isPublic?: boolean;
  isSoldOut?: boolean;
};

export default function UpcomingEvents({ count }: { count?: number }) {
  const {
    wishlist,
    toggleWishlist,
    isLoading: isWishlistLoading,
  } = useWishlist();
  const [events, setEvents] = useState<Event[]>([]);

  const [isLoading, setIsLoading] = useState(true);

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  const isEventSoldOut = (event: Event) => {
    // Check manual sold out flag
    if (event.isSoldOut) return true;

    // Check status
    if (event.status && event.status !== "published") return true;

    const now = new Date();
    const end = buildEventEndDate(event);

    // If event has ended, it's sold out/unavailable
    if (end && end.getTime() <= now.getTime()) return true;

    // If no tickets are available, it's sold out
    const hasAvailableTickets = event.ticketTypes.some(isTicketTypeAvailable);
    return !hasAvailableTickets;
  };

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/events/public-events`,
        );

        if (!response.ok) throw new Error("Failed to fetch events");
        const data = await response.json();

        const allEvents = data.data || data.events || [];

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sortedByNewest = [...allEvents].sort((a: any, b: any) => {
          const dateA = a.createdAt
            ? new Date(a.createdAt).getTime()
            : new Date(a.startDate).getTime();
          const dateB = b.createdAt
            ? new Date(b.createdAt).getTime()
            : new Date(b.startDate).getTime();
          return dateB - dateA;
        });

        const featuredEvents = sortedByNewest.slice(count, 11);
        const publicEvents = featuredEvents.filter(
          (event: Event) => event.isPublic,
        );
        setEvents(publicEvents);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (err) {
        toast.error("Failed to load featured events");
      } finally {
        setIsLoading(false);
      }
    };

    fetchEvents();
  }, [count]);

  useEffect(() => {
    if (!carouselRef.current || events.length === 0 || isHovered) return;

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
  }, [events.length, isHovered]);

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

  // ----------------------- Wishlist toggle (Managed by Hook) -----------------------

  // ----------------------- Render logic -----------------------
  if (isLoading) {
    return (
      <div className="px-4 sm:px-8 md:px-16 py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1a2d5a] mx-auto"></div>
      </div>
    );
  }

  // No upcoming events at all → hide the whole section
  if (events.length === 0) {
    return null;
  }

  // There are events but after filtering none remain

  // Normal render when we have something to show
  return (
    <section className="px-4 sm:px-8 md:px-16  pt-4 pb-8">
      {/* Header */}
      <div className="flex items-center justify-start mb-6">
        <h3 className="text-lg font-semibold text-[#1a2d5a]">
          Featured <span className="font-bold">Events</span>
        </h3>
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
          {events.map((event) => (
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
      <div className="w-full flex justify-center mt-8">
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
    </section>
  );
}
