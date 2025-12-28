import { Metadata } from "next";
import { Suspense } from "react";
import EventDetailClient from "./EventDetailClient";

type Props = {
  searchParams: { id?: string };
};

export async function generateMetadata({
  searchParams,
}: Props): Promise<Metadata> {
  const eventId = searchParams.id;

  if (!eventId) {
    return {
      title: "Event Not Found",
      description: "The requested event could not be found.",
    };
  }

  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/events/details/${eventId}`,
      { next: { revalidate: 60 } }
    );

    if (!res.ok) throw new Error("Event not found");

    const { data: event } = await res.json();

    const title = `${event.title} | Buy Tickets Online`;
    const description =
      event.description?.slice(0, 160) ||
      `Join ${event.title} on ${new Date(
        event.startDate
      ).toLocaleDateString()}. Get your tickets now!`;

    const coverImage = event.coverImages?.[0]
      ? event.coverImages[0].startsWith("http")
        ? event.coverImages[0]
        : `${process.env.NEXT_PUBLIC_API_URL}${
            event.coverImages[0].startsWith("/")
              ? event.coverImages[0]
              : `/${event.coverImages[0]}`
          }`
      : null;

    const ogImage = coverImage || "/og-fallback.png";

    const url = `${
      process.env.NEXT_PUBLIC_FRONTEND_URL || "https://pazimo.com"
    }/event_detail?id=${eventId}`;

    return {
      title,
      description,
      keywords: [
        event.title,
        event.title.split(" ")[0],
        event.title.split(" ")[1],
        event.title.split(" ")[2],
        event.title.split(" ")[3],
        event.category?.name,
        "event tickets",
        "Ethiopia events",
        "buy tickets online",
        event.location.city,
        "ethiopia",
        "dance",
        "music",
        "festival",
        "festival in Ethiopia",
        "concert",
        "theater",
        "workshop",
        "networking",
        "sports event",
        "art exhibition",
        "cultural event",
        "sport in ethiopia",
      ].filter(Boolean),
      openGraph: {
        title,
        description,
        url,
        siteName: "Pazimo",
        images: [{ url: ogImage, width: 1200, height: 630, alt: event.title }],
        locale: "en_US",
        type: "website",
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [ogImage],
      },
      robots: { index: true, follow: true },
      alternates: { canonical: url },
    };
  } catch {
    return {
      title: "Event Not Found",
      description: "The event you're looking for is no longer available.",
      robots: { index: false, follow: false },
    };
  }
}

export default function EventDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          Loading event...
        </div>
      }
    >
      <EventDetailClient />
    </Suspense>
  );
}
