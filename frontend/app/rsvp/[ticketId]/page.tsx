"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import QRCode from "qrcode";
import {
  Calendar,
  Clock,
  MapPin,
  CheckCircle,
  Loader2,
  Ticket as TicketIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface TicketDetails {
  ticketId: string;
  guestName: string;
  status: string;
  ticketCount: number;
  qrCode?: string;
  event: {
    _id: string;
    id?: string;
    title: string;
    startDate: string;
    startTime?: string;
    location: string | { address: string };
    organizer: {
      name: string;
    };
  };
}

export default function RSVPPage() {
  const params = useParams();
  const ticketId = params.ticketId as string;

  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [ticket, setTicket] = useState<TicketDetails | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTicket = async () => {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/tickets/invitation/${ticketId}`
        );
        const data = await response.json();

        if (data.success) {
          setTicket(data.data);
          // If already confirmed, generate QR immediately
          if (data.data.status === "confirmed") {
            generateQR(data.data);
          }
        } else {
          setError(data.message || "Failed to load invitation");
        }
      } catch (err) {
        setError("Something went wrong. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    if (ticketId) {
      fetchTicket();
    }
  }, [ticketId]);

  const generateQR = async (ticketData: TicketDetails) => {
    try {
      if (ticketData.qrCode) {
        setQrCodeUrl(ticketData.qrCode);
      } else {
        // Fallback: generate it client side if not present
        const qrData = JSON.stringify({
          ticketId: ticketData.ticketId,
          eventId: ticketData.event._id || ticketData.event.id,
        });
        const url = await QRCode.toDataURL(qrData, {
          width: 300,
          margin: 2,
          color: { dark: "#000000", light: "#ffffff" },
        });
        setQrCodeUrl(url);
      }
    } catch (err) {
      console.error("QR Generation error", err);
    }
  };

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/tickets/rsvp/${ticketId}/confirm`,
        {
          method: "POST",
        }
      );
      const data = await response.json();

      if (data.success) {
        toast.success("Attendance confirmed! Your ticket is ready.");
        setTicket(data.data);
        generateQR(data.data);
      } else {
        toast.error(data.message || "Failed to confirm attendance");
      }
    } catch (err) {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setConfirming(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle className="text-red-500">Error</CardTitle>
            <CardDescription>{error || "Invitation not found"}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const isConfirmed = ticket.status === "confirmed";
  const eventDate = new Date(ticket.event.startDate).toLocaleDateString(
    "en-US",
    {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }
  );

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
      <Card className="w-full max-w-lg shadow-xl border-0 overflow-hidden">
        <div className="h-2 bg-gradient-to-r from-blue-600 to-purple-600" />

        <CardHeader className="text-center pb-2">
          <div className="mx-auto bg-blue-100 p-3 rounded-full w-fit mb-4">
            {isConfirmed ? (
              <CheckCircle className="h-8 w-8 text-green-600" />
            ) : (
              <TicketIcon className="h-8 w-8 text-blue-600" />
            )}
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">
            {isConfirmed ? "You're Going!" : "You're Invited!"}
          </CardTitle>
          <CardDescription className="text-lg mt-2">
            {ticket.event.title}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6 pt-6">
          {/* Event Details */}
          <div className="bg-gray-50 rounded-xl p-6 space-y-4 border border-gray-100">
            <div className="flex items-start space-x-3">
              <Calendar className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <p className="font-medium text-gray-900">Date</p>
                <p className="text-gray-600">{eventDate}</p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <Clock className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <p className="font-medium text-gray-900">Time</p>
                <p className="text-gray-600">
                  {ticket.event.startTime || "TBD"}
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <MapPin className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <p className="font-medium text-gray-900">Location</p>
                <p className="text-gray-600">
                  {typeof ticket.event.location === "string"
                    ? ticket.event.location
                    : (ticket.event.location as any)?.address || "See map"}
                </p>
              </div>
            </div>
          </div>

          {/* Guest Info */}
          <div className="text-center border-t border-gray-100 pt-4">
            <p className="text-sm text-gray-500">Guest</p>
            <p className="font-medium text-gray-900 text-lg">
              {ticket.guestName}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {ticket.ticketCount} Ticket{ticket.ticketCount > 1 ? "s" : ""}{" "}
              Reserved
            </p>
          </div>

          {/* QR Code Section */}
          {isConfirmed && qrCodeUrl && (
            <div className="flex flex-col items-center justify-center space-y-4 animate-in fade-in zoom-in duration-500">
              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                <img
                  src={qrCodeUrl}
                  alt="Ticket QR Code"
                  className="w-48 h-48 object-contain"
                />
              </div>
              <p className="text-sm text-center text-gray-500 max-w-xs">
                Present this QR code at the entrance. We've also sent a copy to
                your email.
              </p>
            </div>
          )}
        </CardContent>

        <CardFooter className="pb-8 pt-2 flex justify-center">
          {!isConfirmed ? (
            <Button
              size="lg"
              className="w-full max-w-xs text-lg font-semibold shadow-lg hover:shadow-xl transition-all bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              onClick={handleConfirm}
              disabled={confirming}
            >
              {confirming ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Confirming...
                </>
              ) : (
                "Confirm Attendance"
              )}
            </Button>
          ) : (
            <Button
              variant="outline"
              className="w-full max-w-xs"
              onClick={() => window.print()}
            >
              Download / Print Ticket
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
