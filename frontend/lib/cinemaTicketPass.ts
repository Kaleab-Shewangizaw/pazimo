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
