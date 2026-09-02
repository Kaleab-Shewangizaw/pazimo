import type { TicketPassField } from "@/components/tickets/ticket-pass-card";

// Turns a cinema ticket's raw fields into the same "pass" shape the event
// ticket uses (frontend/components/tickets/ticket-pass-card.tsx), so the
// order confirmation page and the /ticket/{id} view build their cards from
// one formatting source instead of drifting apart.

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export interface CinemaPassSource {
  ticketId: string;
  ticketType: string;
  quantity: number;
  hallName?: string;
  showtimeStartsAt: string;
  seat?: { row?: string; number?: string; seatKey?: string } | null;
  cinema?: { name?: string; city?: string } | null;
  movie?: { title?: string; poster?: string | null } | null;
  movieTitle: string;
}

export const cinemaPassPosterUrl = (poster?: string | null) => {
  if (!poster) return "";
  if (poster.startsWith("http")) return poster;
  return `${API_URL}${poster.startsWith("/") ? poster : `/${poster}`}`;
};

export const cinemaPassWhen = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

export const cinemaPassTitle = (ticket: Pick<CinemaPassSource, "movie" | "movieTitle">) =>
  ticket.movie?.title || ticket.movieTitle;

export const cinemaPassWatermark = (ticket: Pick<CinemaPassSource, "movie" | "movieTitle">) =>
  cinemaPassTitle(ticket).split(" ")[0]?.toUpperCase() || "";

export const buildCinemaPassFields = (ticket: CinemaPassSource): TicketPassField[] => {
  const hasSeat = Boolean(ticket.seat?.seatKey);
  const cinemaLine = [ticket.cinema?.name, ticket.cinema?.city].filter(Boolean).join(", ");

  return [
    { label: "DATE & TIME", value: cinemaPassWhen(ticket.showtimeStartsAt).toUpperCase() },
    { label: "CINEMA", value: (cinemaLine || "—").toUpperCase() },
    { label: "HALL", value: (ticket.hallName || "—").toUpperCase() },
    {
      label: "SEAT",
      value: hasSeat
        ? `ROW ${ticket.seat!.row} · SEAT ${ticket.seat!.number}`
        : "GENERAL ADMISSION",
    },
    {
      label: "TICKET TYPE",
      value: hasSeat
        ? ticket.ticketType.toUpperCase()
        : `${ticket.ticketType} × ${ticket.quantity}`.toUpperCase(),
    },
    { label: "ORDER ID", value: ticket.ticketId.slice(-6).toUpperCase() },
  ];
};

/**
 * One order's pass fields — every seat bought in one checkout, collapsed
 * onto a single card instead of one card per seat. `tickets` all belong to
 * the same order (one showtime), so DATE & TIME / CINEMA / HALL are read off
 * the first row and only SEATS / TICKET TYPE fold in the rest.
 */
export const buildCinemaOrderPassFields = (
  tickets: CinemaPassSource[],
  transactionId: string
): TicketPassField[] => {
  const first = tickets[0];
  const seated = tickets.filter((t) => t.seat?.seatKey);
  const cinemaLine = [first.cinema?.name, first.cinema?.city].filter(Boolean).join(", ");
  const admits = tickets.reduce((sum, t) => sum + (t.quantity || 1), 0);

  const seatsValue = seated.length
    ? seated.map((t) => `${t.seat!.row}${t.seat!.number}`).join(", ")
    : `GENERAL ADMISSION × ${admits}`;

  const typeCounts = new Map<string, number>();
  for (const t of tickets) {
    typeCounts.set(t.ticketType, (typeCounts.get(t.ticketType) || 0) + (t.quantity || 1));
  }
  const typeValue =
    typeCounts.size === 1
      ? [...typeCounts.keys()][0]
      : [...typeCounts.entries()].map(([type, count]) => `${type} ×${count}`).join(", ");

  return [
    { label: "DATE & TIME", value: cinemaPassWhen(first.showtimeStartsAt).toUpperCase() },
    { label: "CINEMA", value: (cinemaLine || "—").toUpperCase() },
    { label: "HALL", value: (first.hallName || "—").toUpperCase() },
    { label: "SEATS", value: seatsValue.toUpperCase() },
    { label: "TICKET TYPE", value: typeValue.toUpperCase() },
    { label: "ORDER ID", value: transactionId.slice(-6).toUpperCase() },
  ];
};
