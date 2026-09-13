"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import CinemaTicketView, {
  type CinemaTicketData,
} from "@/components/cinemas/cinema-ticket-view";
import { Loader2, Martini } from "lucide-react";
import TicketPassCard, {
  buildPassBackdropStyle,
} from "@/components/tickets/ticket-pass-card";
import { ticketQrUrl, downloadTicketQr } from "@/lib/ticketQr";
import { toast } from "sonner";

interface TicketDetails {
  _id: string;
  ticketId: string;
  event: {
    title: string;
    startDate: string;
    endDate?: string;
    startTime?: string;
    endTime?: string;
    location: string | { address?: string; city?: string; country?: string };
    coverImages: string[];
  };
  user: {
    firstName?: string;
    lastName?: string;
    email: string;
  } | null;
  guestName?: string;
  ticketType: string;
  price: number;
  status: string;
  qrCode: string;
  ticketCount: number;
  // True when this ticket's event has at least one drink currently on sale.
  // Drives the "get the app to order" prompt below — drinks are bought
  // through the mobile app only, never on the web.
  hasBeverages?: boolean;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

const buildEventImageUrl = (coverImages?: string[]) => {
  if (!coverImages || coverImages.length === 0) return "";
  const img = coverImages[0];
  if (!img) return "";
  if (img.startsWith("http")) return img;
  return `${API_URL}${img.startsWith("/") ? img : `/${img}`}`;
};

const formatEventDate = (isoDate: string) => {
  const date = new Date(isoDate);
  const weekday = date
    .toLocaleDateString("en-US", { weekday: "short" })
    .toUpperCase();
  const day = date.getDate().toString().padStart(2, "0");
  const month = date
    .toLocaleDateString("en-US", { month: "short" })
    .toUpperCase();
  const year = date.getFullYear();
  return `${weekday}, ${day} ${month} ${year}`;
};

export default function TicketDetailClient({ ticketId }: { ticketId: string }) {
  const [ticket, setTicket] = useState<TicketDetails | null>(null);
  // A cinema ticket is a different shape entirely — a seat and a screening
  // rather than an event and a wave — so it renders through its own component
  // instead of being bent into the event shape below.
  const [cinemaTicket, setCinemaTicket] = useState<CinemaTicketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchTicket = async () => {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/tickets/public/details/${ticketId}`
        );
        const data = await res.json();
        if (data.success) {
          // Handle array response from backend
          const ticketData = Array.isArray(data.data)
            ? data.data[0]
            : data.data;
          setTicket(ticketData);
          return;
        }

        // Not an event ticket — try the cinema ledger before giving up.
        //
        // /ticket/{id} is the link that goes out in every confirmation SMS and
        // email, and a customer has no idea which collection their ticket lives
        // in. One URL has to resolve either, or half the links we send lead to
        // "Ticket not found".
        const cinemaRes = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/cinemas/public/tickets/${ticketId}`
        );
        const cinemaData = await cinemaRes.json();
        if (cinemaRes.ok && cinemaData.success) {
          setCinemaTicket(cinemaData.data);
          return;
        }

        setError(data.error || "Failed to load ticket");
      } catch (err) {
        setError("Something went wrong");
      } finally {
        setLoading(false);
      }
    };

    if (ticketId) {
      fetchTicket();
    }
  }, [ticketId]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-50 dark:bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-500" />
      </div>
    );
  }

  if (cinemaTicket) {
    return <CinemaTicketView ticket={cinemaTicket} />;
  }

  if (error || !ticket) {
    return (
      <div className="flex h-full items-center justify-center flex-col gap-4 bg-gray-50 dark:bg-background">
        <p className="text-red-500 dark:text-red-400 font-medium">
          {error || "Ticket not found"}
        </p>
      </div>
    );
  }

  const handleCaptureFailed = () => {
    if (!ticket?.ticketId) return;
    downloadTicketQr(ticket.ticketId, `ticket-${ticket.ticketId}.png`).catch(() =>
      toast.error("Could not download the QR code")
    );
  };

  const dateLine = `${formatEventDate(ticket.event.startDate)}${
    ticket.event.startTime ? `, ${ticket.event.startTime}` : ""
  }`;

  const venue = (
    typeof ticket.event.location === "string"
      ? ticket.event.location
      : ticket.event.location?.address ||
        ticket.event.location?.city ||
        "See map"
  ).toUpperCase();

  const attendee = (
    ticket.user
      ? `${ticket.user.firstName || ""} ${ticket.user.lastName || ""}`.trim()
      : ticket.guestName || "Guest"
  ).toUpperCase();

  const orderId = ticket.ticketId.slice(-6).toUpperCase();
  const watermark = ticket.event.title.split(" ")[0]?.toUpperCase() || "";
  const eventImageUrl = buildEventImageUrl(ticket.event.coverImages);
  const backdropStyle = buildPassBackdropStyle(eventImageUrl);

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Full-screen event backdrop */}
      <div
        className="fixed inset-0 -z-10 bg-gray-50 dark:bg-background"
        style={backdropStyle}
      />

      <div className="relative h-full w-full overflow-y-auto px-4 py-6 sm:px-6 flex flex-col items-center gap-4 pt-20 border-0">
        <TicketPassCard
          title={ticket.event.title}
          watermark={watermark}
          backdropImageUrl={eventImageUrl}
          fields={[
            { label: "DATE & TIME", value: dateLine },
            { label: "VENUE", value: venue },
            { label: "TICKET TYPE", value: ticket.ticketType },
            {
              label: "QUANTITY",
              value: `${ticket.ticketCount.toString().padStart(2, "0")} ${
                ticket.ticketCount > 1 ? "PASSES" : "PASS"
              }`,
            },
            { label: "ORDER ID", value: orderId },
            { label: "ATTENDEE", value: attendee },
          ]}
          qrSrc={ticketQrUrl(ticket.ticketId)}
          downloadFileName={`ticket-${ticket.ticketId}`}
          shareTitle={`${ticket.event.title} — Ticket`}
          onCaptureFailed={handleCaptureFailed}
        />

        {ticket.hasBeverages && (
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-black/40 p-5 text-center text-white backdrop-blur-md">
            <Martini className="mx-auto mb-2 h-6 w-6 text-[#ffd900]" />
            <p className="mb-1 font-semibold">Drinks are on sale at this event</p>
            <p className="mb-4 text-sm text-gray-300">
              Get the Pazimo app to order and show this ticket at the counter
              to collect.
            </p>
            <div className="flex justify-center gap-3">
              <Link href="#" className="inline-block transition-transform hover:scale-105">
                <Image
                  src="/footer/applestore.png"
                  alt="Download on the App Store"
                  width={120}
                  height={36}
                />
              </Link>
              <Link href="#" className="inline-block transition-transform hover:scale-105">
                <Image
                  src="/footer/googlestore.png"
                  alt="Get it on Google Play"
                  width={120}
                  height={36}
                />
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
