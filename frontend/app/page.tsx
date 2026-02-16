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

type PublicEventResponse = {
  events: any[];
  meta?: { hasMore?: boolean };
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

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
    const prices = event.ticketTypes
      .map((t: any) => t.price)
      .filter((p: any) => typeof p === "number");
    if (prices.length) {
      const minPrice = Math.min(...prices);
      return minPrice > 0 ? `From ${minPrice} ETB` : "Free";
    }
  }
  return "Free";
};

const isEventSoldOut = (event: any) => {
  if (event?.isSoldOut) return true;
  if (event?.status && event.status !== "published") return true;

  if (Array.isArray(event?.ticketTypes) && event.ticketTypes.length > 0) {
    const now = new Date();
    const available = event.ticketTypes.some((t: any) => {
      if (t.available === false) return false;
      if (typeof t.quantity === "number" && t.quantity <= 0) return false;
      if (t.startDate && t.endDate) {
        const start = new Date(t.startDate);
        const end = new Date(t.endDate);
        end.setHours(23, 59, 59, 999);
        if (now < start || now > end) return false;
      }
      return true;
    });
    if (!available) return true;
  }

  return false;
};

const toFeaturedCard = (event: any): FeaturedCardEvent => ({
  id: event._id,
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

  const featuredEvents = (featuredRes.events || []).map(toFeaturedCard);
  const trendingEvents = (trendingRes.events || []).map(toTrendingCard);

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
