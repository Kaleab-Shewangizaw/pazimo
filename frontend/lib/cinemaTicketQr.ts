// Cinema ticket QR images are rendered on demand by the API, mirroring the
// event ticket treatment — see frontend/lib/ticketQr.ts and
// backend/src/controllers/cinemaTicketController.js.

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

/** URL of a cinema ticket's QR image. SVG (round dots) for display, PNG for download. */
export const cinemaTicketQrUrl = (
  ticketId: string,
  ext: "svg" | "png" = "svg",
  width?: number
) => {
  const query = ext === "png" && width ? `?w=${width}` : "";
  return `${API}/api/cinemas/public/tickets/${encodeURIComponent(ticketId)}/qr.${ext}${query}`;
};

/** Download a cinema ticket's QR as a PNG. */
export const downloadCinemaTicketQr = async (
  ticketId: string,
  filename = `ticket-${ticketId}.png`,
  width = 1024
) => {
  const response = await fetch(cinemaTicketQrUrl(ticketId, "png", width));
  if (!response.ok) throw new Error("Could not download the QR code");

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(objectUrl);
};

/**
 * URL of a whole ORDER's QR image — every seat bought in one checkout shares
 * this one code, instead of each seat carrying its own.
 */
export const cinemaOrderQrUrl = (
  reference: string,
  ext: "svg" | "png" = "svg",
  width?: number
) => {
  const query = ext === "png" && width ? `?w=${width}` : "";
  return `${API}/api/cinemas/public/orders/${encodeURIComponent(reference)}/qr.${ext}${query}`;
};

/** Download an order's QR as a PNG. */
export const downloadCinemaOrderQr = async (
  reference: string,
  filename = `order-${reference}.png`,
  width = 1024
) => {
  const response = await fetch(cinemaOrderQrUrl(reference, "png", width));
  if (!response.ok) throw new Error("Could not download the QR code");

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(objectUrl);
};
