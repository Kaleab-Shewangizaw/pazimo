"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import FeaturedEventCard, {
  type FeaturedEventCardData,
} from "@/components/featured-event-card";
import { useWishlist } from "@/hooks/useWishlist";

export type PublicEvent = {
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
  isFeatured?: boolean;
  isTrending?: boolean;
};

const DEFAULT_PAGE_SIZE = 12;

export default function AllEventsInfinite({
  initialEvents,
  initialHasMore,
  pageSize = DEFAULT_PAGE_SIZE,
}: {
  initialEvents: PublicEvent[];
  initialHasMore: boolean;
  pageSize?: number;
}) {
  const { wishlist, toggleWishlist, isLoading: isWishlistLoading } =
    useWishlist();

  const [events, setEvents] = useState<PublicEvent[]>(initialEvents || []);
  const [page, setPage] = useState(1); // page 0 already loaded
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const observerRef = useRef<HTMLDivElement | null>(null);

  // Helpers duplicated from upcoming-events for consistent behavior
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

  const buildEventEndDate = (event: PublicEvent): Date | null => {
    const dateStr = event?.endDate || event?.startDate;
    if (!dateStr) return null;
    const time24 = normalizeTimeTo24h(event?.endTime);
    const isoCandidate = `${dateStr}T${time24}:00`;
    const d = new Date(isoCandidate);
    if (!isNaN(d.getTime())) return d;
    const d2 = new Date(dateStr);
    if (!isNaN(d2.getTime())) {
      const [h, m] = time24.split(":").map(Number);
      d2.setHours(h || 23, m || 59, 0, 0);
      return d2;
    }
    return null;
  };

  const isTicketTypeAvailable = (ticket: any) => {
    const now = new Date();
    if (ticket.available === false || ticket.quantity <= 0) return false;
    if (ticket.startDate && ticket.endDate) {
      const start = new Date(ticket.startDate);
      const end = new Date(ticket.endDate);
      end.setHours(23, 59, 59, 999);
      if (now < start || now > end) return false;
    }
    return true;
  };

  const isEventSoldOut = (event: PublicEvent) => {
    if (event.isSoldOut) return true;
    if (event.status && event.status !== "published") return true;
    const now = new Date();
    const end = buildEventEndDate(event);
    if (end && end.getTime() <= now.getTime()) return true;
    const hasAvailableTickets = event.ticketTypes.some(isTicketTypeAvailable);
    return !hasAvailableTickets;
  };

  const priceLabelForEvent = (event: PublicEvent) => {
    if (!event.ticketTypes || event.ticketTypes.length === 0)
      return "Free";

    const availableTickets = event.ticketTypes.filter(isTicketTypeAvailable);
    if (availableTickets.length > 0) {
      const lowestAvailable = Math.min(
        ...availableTickets.map((t) => t.price),
      );
      return lowestAvailable > 0 ? `${lowestAvailable} ETB` : "Free";
    }
    const lowestPrice = Math.min(...event.ticketTypes.map((t) => t.price));
    return lowestPrice > 0 ? `${lowestPrice} ETB` : "Free";
  };

  const buildCardData = (event: PublicEvent): FeaturedEventCardData => {
    const image = event.coverImages?.[0]
      ? event.coverImages[0].startsWith("http")
        ? event.coverImages[0]
        : `${process.env.NEXT_PUBLIC_API_URL}${
            event.coverImages[0].startsWith("/")
              ? event.coverImages[0]
              : `/${event.coverImages[0]}`
          }`
      : undefined;

    return {
      id: event._id,
      title: event.title,
      href: `event_detail?id=${event._id}`,
      image,
      dateLabel: new Date(event.startDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      locationLabel: `${event.location.city}, ${event.location.country}`,
      priceLabel: priceLabelForEvent(event),
      tag: event.category?.name || "",
      soldOut: isEventSoldOut(event),
    };
  };

  const loadMore = useCallback(async () => {
    if (!hasMore || isLoadingMore) return;
    try {
      setIsLoadingMore(true);
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "";
      const skip = page * pageSize;
      const url = baseUrl
        ? `${baseUrl}/api/events/public-events?limit=${pageSize}&skip=${skip}`
        : `/api/events/public-events?limit=${pageSize}&skip=${skip}`;

      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to load more events");
      const payload = await response.json();
      const fetched = (payload.data || []) as PublicEvent[];
      setEvents((prev) => {
        const existingIds = new Set(prev.map((e) => e._id));
        const unique = fetched.filter((e) => !existingIds.has(e._id));
        return [...prev, ...unique];
      });
      const nextHasMore = payload?.meta?.hasMore ?? fetched.length === pageSize;
      setHasMore(nextHasMore);
      setPage((p) => p + 1);
    } catch (error) {
      console.error(error);
      toast.error("Could not load more events");
    } finally {
      setIsLoadingMore(false);
    }
  }, [hasMore, isLoadingMore, page, pageSize]);

  useEffect(() => {
    const target = observerRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { threshold: 0.4 },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [loadMore]);

  return (
    <section className="px-4 sm:px-8 md:px-16 py-14 bg-gray-50">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-[#1a2d5a]">All Events</h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6">
        {events.map((event) => (
          <FeaturedEventCard
            key={event._id}
            data={buildCardData(event)}
            wishlist={wishlist}
            onToggleWishlist={toggleWishlist}
            isWishlistLoading={isWishlistLoading}
          />
        ))}
      </div>

      <div ref={observerRef} className="h-12 flex items-center justify-center">
        {isLoadingMore && (
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#1a2d5a]" />
        )}
        {!hasMore && !isLoadingMore && (
          <p className="text-sm text-gray-500">You&apos;re all caught up</p>
        )}
      </div>
    </section>
  );
}
