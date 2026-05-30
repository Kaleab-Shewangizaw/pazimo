import { resolveRsvpImageUrl, rsvpApi } from "@/lib/rsvp-api";
import { Metadata } from "next";

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  try {
    const event = await rsvpApi.getPublicForm(params.id);
    if (!event) return { title: "RSVP" };

    const title = event.name || "RSVP";
    const description = event.description || "RSVP for this event on Pazimo";
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
  } catch {
    return { title: "RSVP" };
  }
}

export default function RsvpLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
