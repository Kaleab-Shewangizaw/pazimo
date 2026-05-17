import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import EventDetailClient from "@/app/event_detail/EventDetailClient";
import {
  buildCanonicalEventUrl,
  extractShortIdFromEventSlug,
} from "@/lib/event-url";

type Props = {
  params: Promise<{ eventSlug?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const resolvedParams = await params;
  const shortId = extractShortIdFromEventSlug(resolvedParams.eventSlug);

  if (!shortId) {
    return {
      title: "Event Not Found",
      description: "The requested event could not be found.",
      robots: { index: false, follow: false },
    };
  }

  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/events/short/${shortId}`,
      { next: { revalidate: 60 } }
    );

    if (!response.ok) throw new Error("Event not found");

    const { data: event } = await response.json();
    const title = `${event.title} | Buy Tickets Online`;
    const description =
      event.description?.slice(0, 160) ||
      `Join ${event.title} on ${new Date(event.startDate).toLocaleDateString()}. Get your tickets now!`;
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
    const canonicalPath = buildCanonicalEventUrl(event.slug, event.shortId);
    const url = `${process.env.NEXT_PUBLIC_FRONTEND_URL || "https://pazimo.com"}${canonicalPath}`;

    return {
      title,
      description,
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

export default async function EventSlugPage({ params }: Props) {
  const resolvedParams = await params;
  const shortId = extractShortIdFromEventSlug(resolvedParams.eventSlug);

  if (!shortId) {
    notFound();
  }

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen bg-white dark:bg-[#0A0A0A] text-gray-900 dark:text-gray-100">
          Loading event...
        </div>
      }
    >
      <EventDetailClient />
    </Suspense>
  );
}