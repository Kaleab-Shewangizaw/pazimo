"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { Heart, Eye, EyeOff } from "lucide-react";
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

  const buildEventEndDate = (event: Event): Date | null => {
    const dateStr = event?.endDate || event?.startDate;
    if (!dateStr) return null;
    const time24 = normalizeTimeTo24h(event?.endTime);
    const d = new Date(`${dateStr}T${time24}:00`);
    return isNaN(d.getTime()) ? null : d;
  };

  const isTicketTypeAvailable = (ticket: any) => {
    const now = new Date();
    if (ticket.available === false || ticket.quantity <= 0) return false;
    if (ticket.startDate && ticket.endDate) {
      const start = new Date(ticket.startDate);
      const end = new Date(ticket.endDate);
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
    if (end && end.getTime() <= now.getTime()) return true;
    return !event.ticketTypes.some(isTicketTypeAvailable);
  };

  // ----------------------- Data fetching -----------------------
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setIsLoading(true);
        const now = new Date();
        const oneWeekFromNow = new Date(
          now.getTime() + 7 * 24 * 60 * 60 * 1000
        );
        const response = await fetch(
          `${
            process.env.NEXT_PUBLIC_API_URL
          }/api/events?status=published&isPublic=true&startDate=${oneWeekFromNow.toISOString()}&sort=startDate&limit=10`
        );

        if (!response.ok) throw new Error("Failed to fetch events");
        const { data } = await response.json();
        setEvents(data || []);
      } catch (err) {
        toast.error("Failed to load upcoming events");
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
    if (!showSoldOut) {
      list = list.filter((e) => !isEventSoldOut(e));
    }

    list.sort((a, b) => {
      const priceA = getCurrentTicket(a)?.price ?? Infinity;
      const priceB = getCurrentTicket(b)?.price ?? Infinity;

      switch (true) {
        case sortBy === "price-low":
          return priceA - priceB;
        case sortBy === "price-high":
          return priceB - priceA;
        case sortBy === "newest":
        default:
          return (
            new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
          );
      }
    });

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
          Upcoming <span className="font-bold">Events</span> to look forward to
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
              {/* Your beautiful card – unchanged */}
              {/* (copy-paste the whole card JSX you already have) */}
              {/* ... */}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
