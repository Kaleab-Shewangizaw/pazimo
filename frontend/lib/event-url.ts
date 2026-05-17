const SHORT_ID_PATTERN = /^[a-z0-9]{4}$/i;

export const slugify = (title = "") => {
  return String(title)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]+/gu, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
};

export const extractShortIdFromEventSlug = (eventSlug?: string | null) => {
  if (!eventSlug) return null;

  const shortId = String(eventSlug).split("-").pop() || "";
  if (!SHORT_ID_PATTERN.test(shortId)) return null;
  return shortId.toLowerCase();
};

export const buildEventUrl = (event: {
  slug?: string | null;
  shortId?: string | null;
  _id?: string | null;
  id?: string | null;
}) => {
  if (event.slug && event.shortId) {
    return `/events/${event.slug}-${event.shortId}`;
  }

  return "/event_explore";
};

export const buildCanonicalEventUrl = (slug: string, shortId: string) =>
  `/events/${slug}-${shortId}`;