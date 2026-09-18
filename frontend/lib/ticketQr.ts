// Ticket QR images are rendered on demand by the API rather than stored on the
// ticket document, so the frontend points at a URL instead of reading a base64
// data URI off the ticket. See backend/src/utils/qrRenderer.js.

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

/** URL of a ticket's QR image. SVG for display, PNG for download. */
export const ticketQrUrl = (
  ticketId: string,
  ext: "svg" | "png" = "svg",
  width?: number
) => {
  const query = ext === "png" && width ? `?w=${width}` : "";
  return `${API}/api/tickets/${encodeURIComponent(ticketId)}/qr.${ext}${query}`;
};

/**
 * Download a ticket's QR as a PNG.
 *
 * The old implementation drew the stored data URI onto a canvas and called
 * toDataURL. That upscaled a 400px image to 2048px (bigger file, no more
 * detail) and, now that the image comes from the API's origin, would taint the
 * canvas and throw. The server renders at whatever size we ask for instead, so
 * this just fetches the bytes.
 */
export const downloadTicketQr = async (
  ticketId: string,
  filename = `ticket-${ticketId}.png`,
  width = 1024
) => {
  const response = await fetch(ticketQrUrl(ticketId, "png", width));
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
