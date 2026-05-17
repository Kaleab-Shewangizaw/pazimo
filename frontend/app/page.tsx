import type { Metadata } from "next";
import { Suspense } from "react";
import CategoryIcons, { Category } from "@/components/category-icons";
import FeaturedEventsSection, {
  FeaturedCardEvent,
} from "@/components/home/featured-events-section";
import TrendingEventsSection, {
  TrendingCardEvent,
} from "@/components/home/trending-events-section";
import AllEventsInfinite from "@/components/home/all-events-infinite";
import TrendingEvents, {
  FeaturedEvent as BannerCarouselEvent,
} from "@/components/trending-events";
import TrendingEventsSkeleton from "@/components/skeleton/trending-events-skeleton";
import type { Event as CardEvent } from "@/components/upcoming-events";
import { buildEventUrl } from "@/lib/event-url";

type PublicEventResponse = {
  events: any[];
  meta?: { hasMore?: boolean };
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export const metadata: Metadata = {
  title: "Pazimo | Discover Events, Tickets and RSVPs",
  description: "Browse events, buy tickets, RSVP, and discover what's happening on Pazimo.",
  robots: {
    index: false,
    follow: true,
  },
};

const withBase = (path: string) => (API_URL ? `${API_URL}${path}` : path);

const buildImageUrl = (coverImages?: string[]) => {
  if (coverImages && coverImages.length > 0) {
    const img = coverImages[0];
    if (img.startsWith("http")) return img;
    return `${API_URL}${img.startsWith("/") ? img : `/${img}`}`;
  }
  return ""; // use icon placeholder instead of fetching a fallback image
};

const buildPriceLabel = (event: any) => {
  if (Array.isArray(event.ticketTypes) && event.ticketTypes.length > 0) {
    // Calculate minimum prices for each currency
    let minETB = Infinity, minUSD = Infinity;
    let hasETB = false, hasUSD = false;
    
    event.ticketTypes.forEach((ticket: any) => {
      if (ticket.priceETB && ticket.priceETB > 0) {
        minETB = Math.min(minETB, ticket.priceETB);
        hasETB = true;
      } else if (ticket.price && ticket.price > 0) {
        minETB = Math.min(minETB, ticket.price);
        hasETB = true;
      }
      if (ticket.priceUSD && ticket.priceUSD > 0) {
        minUSD = Math.min(minUSD, ticket.priceUSD);
        hasUSD = true;
      }
    });
    
    // Format price label based on available currencies
    if (hasUSD && hasETB) {
      return `From ${minUSD}$/${minETB} ETB`;
    } else if (hasUSD) {
      return `From ${minUSD}$`;
    } else if (hasETB && minETB !== Infinity && minETB > 0) {
      return `From ${minETB} ETB`;
    }
  }
  return "Free";
};

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

const buildEventEndDate = (event: any): Date | null => {
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
  if (ticket.available === false) return false;
  if (typeof ticket.quantity === "number" && ticket.quantity <= 0)
    return false;
  if (ticket.startDate && ticket.endDate) {
    const start = new Date(ticket.startDate);
    const end = new Date(ticket.endDate);
    end.setHours(23, 59, 59, 999);
    if (now < start || now > end) return false;
  }
  return true;
};

const isEventSoldOut = (event: any) => {
  const status = (event?.status || "").toString().toLowerCase();
  const explicitSoldOut =
    event?.isSoldOut === true ||
    event?.soldOut === true ||
    status === "soldout" ||
    status === "sold_out" ||
    status === "sold out";
  if (explicitSoldOut) return true;

  if (event?.status && status !== "published") return true;

  const now = new Date();
  const end = buildEventEndDate(event);
  if (end && end.getTime() <= now.getTime()) return true;

  if (Array.isArray(event?.ticketTypes) && event.ticketTypes.length > 0) {
    const hasAvailableTickets = event.ticketTypes.some(isTicketTypeAvailable);
    if (!hasAvailableTickets) return true;
  }

  if (typeof event?.capacity === "number" && event.capacity <= 0) return true;

  return false;
};

const toFeaturedCard = (event: any): FeaturedCardEvent => ({
  id: event._id,
  href: buildEventUrl(event),
  title: event.title,
  tag: event.category?.name || "Featured",
  dateLabel: new Date(event.startDate).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }),
  locationLabel:
    [event.location?.city, event.location?.country].filter(Boolean).join(", ") ||
    "Location TBA",
  priceLabel: buildPriceLabel(event),
  image: buildImageUrl(event.coverImages),
  soldOut: isEventSoldOut(event),
});

const toTrendingCard = (event: any): TrendingCardEvent => ({
  id: event._id,
  href: buildEventUrl(event),
  title: event.title,
  dateLabel: new Date(event.startDate).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }),
  locationLabel:
    [event.location?.city, event.location?.country].filter(Boolean).join(", ") ||
    "Location TBA",
  attendeesLabel: event.capacity
    ? `${event.capacity.toLocaleString()} going`
    : "Trending",
  priceLabel: buildPriceLabel(event),
  image: buildImageUrl(event.coverImages),
  soldOut: isEventSoldOut(event),
});

const toBannerCarouselEvent = (event: any): BannerCarouselEvent => {
  const price = buildPriceLabel(event);
  return {
    id: event._id,
    title: event.title,
    description: event.description,
    date: new Date(event.startDate).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
    startTime:
      event.startTime ||
      new Date(event.startDate).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    endTime: event.endTime || "",
    location: event.location?.city || "TBD",
    venue: event.location?.address || "",
    image: buildImageUrl(event.coverImages),
    price,
    rating: 4.5,
    attendees: event.capacity || 0,
    categories: [event.category?.name || "Uncategorized"],
    organization:
      event.organizer?.organizerProfile?.organization ||
      event.organizer?.organization ||
      event.title ||
      "Event Organizer",
    originalEvent: event,
  };
};

const sanitizeEventForCard = (event: any): CardEvent => ({
  _id: event._id,
  title: event.title,
  description: event.description || "",
  startDate: event.startDate,
  endDate: event.endDate || event.startDate,
  startTime: event.startTime || "",
  endTime: event.endTime || "",
  location: {
    address: event.location?.address || "",
    city: event.location?.city || "TBD",
    country: event.location?.country || "",
  },
  category: {
    _id: event.category?._id || "uncategorized",
    name: event.category?.name || "Uncategorized",
    description: event.category?.description || "",
  },
  coverImages:
    event.coverImages && event.coverImages.length > 0
      ? event.coverImages
      : ["/placeholder.svg?height=600&width=400&text=Event+Poster"],
  ticketTypes: Array.isArray(event.ticketTypes) ? event.ticketTypes : [],
  status: event.status || "published",
  isPublic: event.isPublic !== false,
  isSoldOut: event.isSoldOut || false,
});

async function getCategories(): Promise<Category[]> {
  try {
    const response = await fetch(withBase("/api/categories"), {
      cache: "no-store",
    });
    if (!response.ok) return [];
    const data = await response.json();
    return data.data.filter((category: Category) => category.isPublished);
  } catch (error) {
    console.error("Error fetching categories:", error);
    return [];
  }
}

async function getPublicEvents(params: Record<string, string | number | boolean>): Promise<PublicEventResponse> {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.append(key, String(value));
    }
  });

  const query = searchParams.toString();
  try {
    const response = await fetch(
      withBase(`/api/events/public-events${query ? `?${query}` : ""}`),
      { cache: "no-store" },
    );
    if (!response.ok) return { events: [], meta: { hasMore: false } };
    const data = await response.json();
    return { events: data.data || [], meta: data.meta };
  } catch (error) {
    console.error("Error fetching events:", error);
    return { events: [], meta: { hasMore: false } };
  }
}

async function getBannerEvents(): Promise<BannerCarouselEvent[]> {
  try {
    const response = await fetch(
      withBase(
        "/api/events?status=published&bannerStatus=true&sort=-createdAt&limit=10",
      ),
      { cache: "no-store", headers: { Accept: "application/json" } },
    );
    if (!response.ok) return [];
    const data = await response.json();
    return (data.data || [])
      .filter((event: any) => event.bannerStatus === true)
      .map(toBannerCarouselEvent);
  } catch (error) {
    console.error("Error fetching banner events:", error);
    return [];
  }
}

export default async function Page() {
  const [categories, featuredRes, trendingRes, otherRes, bannerEvents] =
    await Promise.all([
    getCategories(),
    getPublicEvents({ isFeatured: true, limit: 8, sort: "-startDate" }),
    getPublicEvents({ isTrending: true, limit: 6, sort: "-startDate" }),
    getPublicEvents({ limit: 12, skip: 0, sort: "-startDate" }),
      getBannerEvents(),
    ]);

  const featuredEvents = (featuredRes.events || [])
    .filter((event) => event?.isFeatured === true)
    .map(toFeaturedCard);
  const trendingEvents = (trendingRes.events || [])
    .filter((event) => event?.isTrending === true)
    .map(toTrendingCard);

  const initialOtherEvents = (otherRes.events || []).map(sanitizeEventForCard);
  const hasMore = otherRes.meta?.hasMore ?? false;

  return (
    <>
      <Suspense fallback={<TrendingEventsSkeleton />}>
        <TrendingEvents initialEvents={bannerEvents} />
      </Suspense>

      <FeaturedEventsSection events={featuredEvents} />

      <section id="categories" className="scroll-mt-24">
        <CategoryIcons initialCategories={categories} />
      </section>

      <TrendingEventsSection events={trendingEvents} />

      <AllEventsInfinite
        initialEvents={initialOtherEvents}
        initialHasMore={hasMore}
        pageSize={12}
      />
    </>
  );
}
