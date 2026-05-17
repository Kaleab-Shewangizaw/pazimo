import { resolveRsvpImageUrl, rsvpApi } from "@/lib/rsvp-api";
import { Metadata } from "next";

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  try {
    const event = await rsvpApi.getPublicForm(params.id);
    if (!event) return { title: "Review | Pazimo" };

    const title = `${event.name} - Review | Pazimo`;
    const description = event.description || "Leave your feedback for this event on Pazimo";
    const image = resolveRsvpImageUrl(event.coverImage);

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        images: image ? [{ url: image }] : [],
        type: "website",
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: image ? [image] : [],
      },
    };
  } catch (error) {
    return { title: "Review | Pazimo" };
  }
}

export default function ReviewLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
