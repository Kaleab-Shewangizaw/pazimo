"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import TicketPassCard, { buildPassBackdropStyle } from "@/components/tickets/ticket-pass-card";
import {
  buildCinemaPassFields,
  cinemaPassPosterUrl,
  cinemaPassTitle,
  cinemaPassWatermark,
  cinemaPassWhen,
} from "@/lib/cinemaTicketPass";
import { cinemaTicketQrUrl, downloadCinemaTicketQr } from "@/lib/cinemaTicketQr";
import { toast } from "sonner";

/**
 * One cinema ticket, as the customer sees it — the same branded "pass" look
 * as an event ticket (frontend/components/tickets/ticket-pass-card.tsx).
 *
 * Shared by /ticket/{id} — the link that goes out in the confirmation SMS and
 * email — and by the account ticket list, so a ticket looks the same wherever
 * it is opened.
 *
 * The QR is an <img> pointing at the API rather than a blob rendered here. It
 * is derived entirely from the ticket's own id, so it can be cached hard and
 * never has to be stored: that is the same decision that keeps 517 MB of
 * base64 out of the tickets collection.
 */

export interface CinemaTicketData {
  ticketId: string;
  movieTitle: string;
  hallName?: string;
  showtimeStartsAt: string;
  ticketType: string;
  quantity: number;
  totalAmount: number;
  currency: string;
  status: string;
  paymentStatus: string;
  checkedIn?: boolean;
  checkedAt?: string | null;
  customerName?: string;
  seat?: {
    row?: string;
    number?: string;
    seatKey?: string;
    categoryLabel?: string;
  } | null;
  cinema?: { name?: string; address?: string; city?: string } | null;
  movie?: { title?: string; poster?: string | null } | null;
}

export default function CinemaTicketView({ ticket }: { ticket: CinemaTicketData }) {
  // A refunded or cancelled ticket still renders — the customer needs to see
  // what happened to it — but it must never look scannable.
  const dead = ["refunded", "cancelled"].includes(ticket.status);
  const used = ticket.checkedIn;

  const handleDownload = () => {
    downloadCinemaTicketQr(ticket.ticketId, `ticket-${ticket.ticketId}.png`).catch(() =>
      toast.error("Could not download the QR code")
    );
  };

  const posterUrl = cinemaPassPosterUrl(ticket.movie?.poster);
  const backdropStyle = buildPassBackdropStyle(posterUrl);

  let badgeText = "OFFICIAL PASS";
  let badgeClassName = "border-white/50 text-white";
  if (dead) {
    badgeText = ticket.status.toUpperCase();
    badgeClassName = "border-red-300/70 bg-red-500/10 text-red-100";
  } else if (used) {
    badgeText = "ADMITTED";
    badgeClassName = "border-emerald-300/70 bg-emerald-500/10 text-emerald-100";
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Full-screen movie backdrop, same treatment as an event ticket */}
      <div className="fixed inset-0 -z-10 bg-gray-50 dark:bg-background" style={backdropStyle} />

      <div className="relative flex h-full w-full flex-col items-center gap-6 overflow-y-auto border-0 px-4 py-6 pt-20 sm:px-6">
        <TicketPassCard
          title={cinemaPassTitle(ticket)}
          watermark={cinemaPassWatermark(ticket)}
          badgeText={badgeText}
          badgeClassName={badgeClassName}
          backdropImageUrl={posterUrl}
          fields={buildCinemaPassFields(ticket)}
          qrSrc={dead ? undefined : cinemaTicketQrUrl(ticket.ticketId)}
          qrAlt={`QR code for ticket ${ticket.ticketId}`}
          deadMessage={
            dead ? `This ticket was ${ticket.status} and will not be admitted.` : undefined
          }
          note={
            used
              ? `Already admitted${
                  ticket.checkedAt ? ` at ${cinemaPassWhen(ticket.checkedAt)}` : ""
                } — this code will not scan again.`
              : undefined
          }
          onDownload={dead ? undefined : handleDownload}
        />

        <Button asChild variant="outline" className="mb-6 w-full max-w-sm">
          <Link href="/cinemas">Browse more films</Link>
        </Button>
      </div>
    </div>
  );
}
