"use client";

import { useEffect, useState } from "react";
import { Loader2, Download } from "lucide-react";
import Image from "next/image";
import { downloadHighQualityQR } from "@/lib/downloadQR";

interface TicketDetails {
  _id: string;
  ticketId: string;
  event: {
    title: string;
    startDate: string;
    endDate: string;
    location: string | { address?: string; city?: string; country?: string };
    coverImages: string[];
  };
  user: {
    fullName: string;
    email: string;
  };
  ticketType: string;
  price: number;
  status: string;
  qrCode: string;
  ticketCount: number;
}

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
      <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-500" />
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="flex h-screen items-center justify-center flex-col gap-4 bg-gray-50 dark:bg-background">
        <p className="text-red-500 dark:text-red-400 font-medium">
          {error || "Ticket not found"}
        </p>
      </div>
    );
  }

  const getCoverImageUrl = () => {
    if (!ticket.event.coverImages?.[0]) return "/events/eventimg.png";
    const img = ticket.event.coverImages[0];
    return img.startsWith("http")
      ? img
      : `${process.env.NEXT_PUBLIC_API_URL}${
          img.startsWith("/") ? img : `/${img}`
        }`;
  };

  const handleDownload = () => {
    if (!ticket?.qrCode) return;
    downloadHighQualityQR(ticket.qrCode, `ticket-${ticket.ticketId}.png`);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background py-12 px-4 sm:px-6 lg:px-8 flex justify-center">
      <div className="max-w-md w-full bg-white dark:bg-card rounded-2xl shadow-xl dark:shadow-none border dark:border-border overflow-hidden">
        {/* Event Image Header */}
        <div className="relative w-full bg-gray-200 dark:bg-muted">
          <Image
            src={getCoverImageUrl()}
            alt={ticket.event.title}
            width={0}
            height={0}
            sizes="100vw"
            className="w-full h-auto"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-4 left-4 text-white">
            <h1 className="text-xl font-bold leading-tight">
              {ticket.event.title}
            </h1>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* QR Code Section */}
          <div className="flex flex-col items-center justify-center space-y-2 bg-gray-50 dark:bg-muted/50 p-6 rounded-xl border border-dashed border-gray-300 dark:border-border">
            <div className="bg-white p-2 rounded-xl">
              <Image
                width={256}
                height={256}
                priority
                src={ticket.qrCode}
                alt="Ticket QR Code"
                className="w-48 h-48"
              />
            </div>

            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-4 py-2 mt-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 rounded-full hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
            >
              <Download className="w-4 h-4" />
              Download QR
            </button>

            <span
              className={`px-3 py-1 mt-1 rounded-full text-xs font-medium ${
                ticket.status === "active" && ticket.ticketCount > 0
                  ? "bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-400"
                  : "bg-gray-100 text-gray-800 dark:bg-white/10 dark:text-gray-300"
              }`}
            >
              {ticket.status === "active" && ticket.ticketCount > 0
                ? "ACTIVE"
                : "USED"}
            </span>
          </div>

          {/* Ticket Details */}
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b dark:border-border pb-3">
              <span className="text-gray-500 dark:text-gray-400 text-sm">Attendee</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {ticket.user?.fullName || "Guest"}
              </span>
            </div>

            <div className="flex justify-between items-center border-b dark:border-border pb-3">
              <span className="text-gray-500 dark:text-gray-400 text-sm">Ticket Type</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {ticket.ticketType}
              </span>
            </div>

            <div className="flex justify-between items-center border-b dark:border-border pb-3">
              <span className="text-gray-500 dark:text-gray-400 text-sm">Admit Count</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {ticket.ticketCount} Person(s)
              </span>
            </div>

            <div className="flex justify-between items-center border-b dark:border-border pb-3">
              <span className="text-gray-500 dark:text-gray-400 text-sm">Date</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {new Date(ticket.event.startDate).toLocaleDateString()}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-gray-500 dark:text-gray-400 text-sm">Location</span>
              <span className="font-medium text-gray-900 dark:text-white text-right max-w-[60%]">
                {typeof ticket.event.location === "string"
                  ? ticket.event.location
                  : ticket.event.location?.address || "See map"}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-muted/50 px-6 py-4 text-center text-xs text-gray-500 dark:text-gray-400">
          Powered by Pazimo
        </div>
      </div>
    </div>
  );
}
