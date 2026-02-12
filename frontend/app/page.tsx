import { Suspense } from "react";
import CategoryIcons, { Category } from "@/components/category-icons";
import UpcomingEvents, { Event } from "@/components/upcoming-events";
import TrendingEvents, { FeaturedEvent } from "@/components/trending-events";

// Skeletons
import EventCarouselSkeleton from "@/components/skeleton/event-carousel-skeleton";
import CategoryIconsSkeleton from "@/components/skeleton/category-icons-skeleton";
import TrendingEventsSkeleton from "@/components/skeleton/trending-events-skeleton";

// Data fetching and transformation functions
async function getCategories(): Promise<Category[]> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/categories`,
      { cache: "no-store" }
    );
    if (!response.ok) return [];
    const data = await response.json();
    return data.data.filter((category: Category) => category.isPublished);
  } catch (error) {
    console.error("Error fetching categories:", error);
    return [];
  }
}

async function getUpcomingEvents(): Promise<Event[]> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/events/public-events`,
      { cache: "no-store" }
    );

    if (!response.ok) return [];
    const data = await response.json();
    const allEvents = data.data || data.events || [];

    const sortedByNewest = [...allEvents].sort((a: any, b: any) => {
      const dateA = a.createdAt
        ? new Date(a.createdAt).getTime()
        : new Date(a.startDate).getTime();
      const dateB = b.createdAt
        ? new Date(b.createdAt).getTime()
        : new Date(b.startDate).getTime();
      return dateB - dateA;
    });

    return sortedByNewest.filter(
      (event: Event) => event.status === "published" && event.isPublic
    );
  } catch (error) {
    console.error("Error fetching upcoming events:", error);
    return [];
  }
}

async function getTrendingEvents(): Promise<FeaturedEvent[]> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/events?status=published&bannerStatus=true&sort=-createdAt&limit=10`,
      { cache: "no-store", headers: { Accept: "application/json" } }
    );

    if (!response.ok) return [];
    const data = await response.json();

    // Transformation logic from component
    return data.data
      .filter(
        (event: any) => event.bannerStatus === true && event.isPublic === true
      )
      .map((event: any) => {
        const imageUrl =
          event.coverImages && event.coverImages.length > 0
            ? event.coverImages[0].startsWith("http")
              ? event.coverImages[0]
              : `${process.env.NEXT_PUBLIC_API_URL}${
                  event.coverImages[0].startsWith("/")
                    ? event.coverImages[0]
                    : `/${event.coverImages[0]}`
                }`
            : "/placeholder.svg?height=600&width=400&text=Event+Poster";

        const now = new Date();
        const hasWave = (t: any) =>
          !!(t?.startDate && t?.endDate) ||
          String(t?.description || "")
            .toLowerCase()
            .includes("wave");
        const anyWave =
          Array.isArray(event.ticketTypes) && event.ticketTypes.some(hasWave);
        let priceLabel = "Free";
        if (anyWave) {
          const activeWaveTickets = (event.ticketTypes || []).filter(
            (t: any) => {
              if (!hasWave(t)) return false;
              if (t?.available === false) return false;
              if (t?.startDate && t?.endDate) {
                const s = new Date(t.startDate);
                const e = new Date(t.endDate);
                return now >= s && now <= e;
              }
              return false;
            }
          );
          if (activeWaveTickets.length > 0) {
            activeWaveTickets.sort(
              (a: any, b: any) =>
                new Date(b.startDate).getTime() -
                new Date(a.startDate).getTime()
            );
            priceLabel =
              activeWaveTickets[0].price > 0
                ? `From ${activeWaveTickets[0].price} ETB`
                : "Free";
          } else if (event.ticketTypes && event.ticketTypes.length > 0) {
            priceLabel =
              event.ticketTypes[0].price > 0
                ? `From ${event.ticketTypes[0].price} ETB`
                : "Free";
          }
        } else if (event.ticketTypes && event.ticketTypes.length > 0) {
          priceLabel = `From ${Math.min(
            ...event.ticketTypes.map((t: any) => t.price)
          )} ETB`;
        }

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
          location: event.location.city,
          venue: event.location.address,
          image: imageUrl,
          price: priceLabel,
          rating: 4.5,
          attendees: event.capacity,
          categories: [event.category?.name || "Uncategorized"],
          organization:
            event.organizer?.organizerProfile?.organization ||
            event.organizer?.organization ||
            event.title ||
            "Event Organizer",
          originalEvent: event,
        };
      });
  } catch (error) {
    console.error("Error fetching trending events:", error);
    return [];
  }
}

export default async function Page() {
  const [categories, upcomingEventsRaw, trendingEvents] = await Promise.all([
    getCategories(),
    getUpcomingEvents(),
    getTrendingEvents(),
  ]);

  // Apply slicing for different views of UpcomingEvents
  // First instance was count={0}, meaning slice(0, 11)
  const upcomingEvents0 = upcomingEventsRaw.slice(0, 11);
  // Second instance was count={2}, meaning slice(2, 11)
  const upcomingEvents2 = upcomingEventsRaw.slice(2, 11);

  return (
    <>
    
      {/* Trending Events */}
      <Suspense fallback={<TrendingEventsSkeleton />}>
        <TrendingEvents initialEvents={trendingEvents} />
      </Suspense>

      {/* Upcoming Events (Carousel) */}
      <Suspense fallback={<EventCarouselSkeleton />}>
        <UpcomingEvents count={0} initialEvents={upcomingEvents0} />
      </Suspense>

      {/* Category Icons */}
      <Suspense fallback={<CategoryIconsSkeleton />}>
        <CategoryIcons initialCategories={categories} />
      </Suspense>

      {/* Featured Events (List Layout) */}
      <Suspense
        fallback={
          <div className="h-96 bg-gray-100 animate-pulse rounded-lg mx-4 sm:mx-8 md:mx-16  my-8 mt-4" />
        }
      >
        <UpcomingEvents count={2} initialEvents={upcomingEvents2} />
      </Suspense>

      {/* Newsletter */}
      <section className="py-8 px-4 sm:px-8 md:px-16 bg-gray-50 mt-8"></section>
    </>
  );
}
