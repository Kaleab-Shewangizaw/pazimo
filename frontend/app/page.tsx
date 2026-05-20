import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
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

type PublicRsvpForm = {
  _id: string;
  publicId: string;
  title: string;
  description?: string;
  coverImage?: string;
  date?: string;
  location?: string;
  venue?: string;
  hostedBy?: string;
  responseCount?: number;
  publishedAt?: string;
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

const buildRsvpImageUrl = (image?: string) => {
  if (!image) return "";
  if (image.startsWith("http")) return image;
  return `${API_URL}${image.startsWith("/") ? image : `/${image}`}`;
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

async function getPublishedRsvpForms(): Promise<PublicRsvpForm[]> {
  try {
    const response = await fetch(withBase("/api/rsvp/public/forms?type=rsvp&limit=6"), {
      cache: "no-store",
    });
    if (!response.ok) return [];
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error("Error fetching published RSVP forms:", error);
    return [];
  }
}

export default async function Page() {
  const [categories, featuredRes, trendingRes, otherRes, bannerEvents, publishedRsvpForms] =
    await Promise.all([
    getCategories(),
    getPublicEvents({ isFeatured: true, limit: 8, sort: "-startDate" }),
    getPublicEvents({ isTrending: true, limit: 6, sort: "-startDate" }),
    getPublicEvents({ limit: 12, skip: 0, sort: "-startDate" }),
      getBannerEvents(),
      getPublishedRsvpForms(),
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

      {/* {publishedRsvpForms.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">RSVP Forms</p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Published RSVP forms</h2>
              <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
                Open RSVP forms that the admin has published and made available on the home page.
              </p>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {publishedRsvpForms.map((form) => {
              const imageUrl = buildRsvpImageUrl(form.coverImage);
              return (
                <article
                  key={form._id}
                  className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition-transform duration-300 hover:-translate-y-1 hover:shadow-xl dark:border-white/10 dark:bg-slate-900"
                >
                  <div className="relative h-52 bg-slate-100 dark:bg-white/5">
                    {imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={imageUrl} alt={form.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-blue-50 via-slate-100 to-indigo-100 text-blue-600 dark:from-slate-800 dark:via-slate-900 dark:to-slate-800">
                        <span className="text-sm font-semibold uppercase tracking-[0.3em]">RSVP</span>
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-5 text-white">
                      <p className="text-xs uppercase tracking-[0.3em] text-blue-200">Published</p>
                      <h3 className="mt-2 text-2xl font-semibold leading-tight">{form.title}</h3>
                    </div>
                  </div>

                  <div className="space-y-4 p-5">
                    <p className="line-clamp-2 text-sm text-slate-600 dark:text-slate-400">
                      {form.description || "No description provided yet."}
                    </p>

                    <div className="flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span>{form.date || "Date TBA"}</span>
                      <span>•</span>
                      <span>{form.location || form.venue || "Location TBA"}</span>
                      {form.hostedBy ? (
                        <>
                          <span>•</span>
                          <span>{form.hostedBy}</span>
                        </>
                      ) : null}
                    </div>

                    <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-400">
                      <span>{form.responseCount || 0} responses</span>
                      <span>{form.publishedAt ? new Date(form.publishedAt).toLocaleDateString() : "Live now"}</span>
                    </div>

                    <div>
                      <Link
                        href={`/rsvp-form/${form.publicId}`}
                        className="inline-flex items-center justify-center rounded-full bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
                      >
                        Open RSVP
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )} */}

      <AllEventsInfinite
        initialEvents={initialOtherEvents}
        initialHasMore={hasMore}
        pageSize={12}
      />
    </>
  );
}
