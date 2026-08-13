"use client";

import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { Loader2, Download } from "lucide-react";
import Image from "next/image";
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
        } else {
          setError(data.error || "Failed to load ticket");
        }
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

  if (error || !ticket) {
    return (
      <div className="flex h-full items-center justify-center flex-col gap-4 bg-gray-50 dark:bg-background">
        <p className="text-red-500 dark:text-red-400 font-medium">
          {error || "Ticket not found"}
        </p>
      </div>
    );
  }

  const handleDownload = () => {
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
  const isActive = ticket.status === "active" && ticket.ticketCount > 0;
  const eventImageUrl = buildEventImageUrl(ticket.event.coverImages);

  // Shared "fixed" background so the notch cutouts below can peek through to the
  // exact same image/overlay as the full-screen backdrop, wherever they land on screen.
  const backdropStyle: CSSProperties | undefined = eventImageUrl
    ? {
        backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.7), rgba(0,0,0,0.35) 50%, rgba(0,0,0,0.8)), linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.45)), url(${eventImageUrl})`,
        backgroundSize: "cover, cover, cover",
        backgroundPosition: "center, center, center",
        backgroundAttachment: "fixed, fixed, fixed",
        backgroundRepeat: "no-repeat, no-repeat, no-repeat",
      }
    : undefined;

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Full-screen event backdrop */}
      <div
        className="fixed inset-0 -z-10 bg-gray-50 dark:bg-background"
        style={backdropStyle}
      />

      <div className="relative h-full w-full overflow-y-auto px-4 py-6 sm:px-6 flex justify-center items-start pt-20 border-0">
      <div className="max-w-sm w-full pb-15 bg-gradient-to-br from-[#06283D] to-[#1A5D8C] dark:bg-card rounded-3xl border-0 shadow-2xl ring-1 ring-white/10 overflow-hidden">
        {/* Blue header block */}
        <div className="relative overflow-hidden bg-gradient-to-br from-[#06283D] to-[#1A5D8C] px-7 py-10">
          <span className="pointer-events-none absolute -bottom-4 right-5 select-none text-6xl font-black tracking-tight text-white/10 whitespace-nowrap">
            {watermark}
          </span>

          <div className="relative flex items-start justify-between gap-3">
            <h1 className="text-xl font-extrabold leading-tight text-white">
              {ticket.event.title}
            </h1>
            <span className="shrink-0 whitespace-nowrap rounded-full border border-white/50 px-3 py-1 text-[10px] font-bold tracking-wider text-white">
              OFFICIAL PASS
            </span>
          </div>

          <div className="relative mt-5 grid grid-cols-2 gap-y-4 gap-x-3">
            <div>
              <p className="text-[10px] tracking-wider text-white/65">DATE &amp; TIME</p>
              <p className="text-sm font-bold text-white">{dateLine}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] tracking-wider text-white/65">VENUE</p>
              <p className="text-sm font-bold text-white">{venue}</p>
            </div>
            <div>
              <p className="text-[10px] tracking-wider text-white/65">TICKET TYPE</p>
              <p className="text-sm font-bold text-white">{ticket.ticketType}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] tracking-wider text-white/65">QUANTITY</p>
              <p className="text-sm font-bold text-white">
                {ticket.ticketCount.toString().padStart(2, "0")}{" "}
                {ticket.ticketCount > 1 ? "PASSES" : "PASS"}
              </p>
            </div>
            <div>
              <p className="text-[10px] tracking-wider text-white/65">ORDER ID</p>
              <p className="text-sm font-bold text-white">{orderId}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] tracking-wider text-white/65">ATTENDEE</p>
              <p className="text-sm font-bold text-white">{attendee}</p>
            </div>
          </div>
        </div>

        {/* Perforation with die-cut notches */}
        <div className="relative">
          <div
            className="absolute -top-2.5 -left-2.5 h-5 w-5 rounded-full bg-gray-50 dark:bg-background border-0"
            style={backdropStyle}
          />
          <div
            className="absolute -top-2.5 -right-2.5 h-5 w-5 rounded-full bg-gray-50 dark:bg-background"
            style={backdropStyle}
          />
          <div className="mx-5 border-t-2 border-dashed border-gray-300 dark:border-border" />
        </div>

        {/* QR Code Section */}
        <div className="flex flex-col  items-center justify-center gap-3 px-7 pt-15 pb-0">
          <Image
            width={256}
            height={256}
            priority
            src={ticketQrUrl(ticket.ticketId)}
            unoptimized
            alt="Ticket QR Code"
            className="w-34 h-34"
          />
          <p className="text-[11px] font-bold tracking-[0.2em] text-gray-400 dark:text-gray-500">
            &mdash;&mdash; SCAN FOR ENTRY &mdash;&mdash;
          </p>

          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#06283D] rounded-full hover:bg-[#0a3a57] transition-colors"
            >
              <Download className="w-4 h-4" />
              Download QR
            </button>
          </div>
        </div>


      </div>
      </div>
    </div>
  );
}
