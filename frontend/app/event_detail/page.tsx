import { redirect } from "next/navigation";

type Props = {
  searchParams: Promise<{ id?: string }>;
};

export default async function EventDetailPage({ searchParams }: Props) {
  const resolvedSearchParams = await searchParams;
  const eventId = resolvedSearchParams.id;

  if (!eventId) {
    redirect("/event_explore");
  }

  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/events/details/${eventId}`,
      { cache: "no-store" }
    );

    if (!response.ok) {
      redirect("/event_explore");
    }

    const { data: event } = await response.json();
    if (!event?.slug || !event?.shortId) {
      redirect("/event_explore");
    }

    redirect(`/events/${event.slug}-${event.shortId}`);
  } catch {
    redirect("/event_explore");
  }
}
