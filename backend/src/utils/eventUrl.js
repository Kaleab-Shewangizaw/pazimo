const SHORT_ID_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";
const SHORT_ID_LENGTH = 4;

const slugify = (title = "") => {
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

const generateShortId = async () => {
  const { customAlphabet } = await import("nanoid");
  return customAlphabet(SHORT_ID_ALPHABET, SHORT_ID_LENGTH)();
};

const extractShortIdFromEventSlug = (eventSlug = "") => {
  const parts = String(eventSlug).split("-");
  const shortId = parts[parts.length - 1] || "";
  if (!/^[a-z0-9]{4}$/i.test(shortId)) return null;
  return shortId.toLowerCase();
};

const buildEventUrl = (event = {}) => {
  if (!event.slug || !event.shortId) return null;
  return `/events/${event.slug}-${event.shortId}`;
};

module.exports = {
  buildEventUrl,
  extractShortIdFromEventSlug,
  generateShortId,
  slugify,
};