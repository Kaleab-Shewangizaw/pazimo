"use client";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Calendar,
  Clock,
  MapPin,
  User,
  Mail,
  Phone,
  QrCode,
  Download,
} from "lucide-react";

interface EventData {
  title: string;
  startDate: string;
  startTime: string;
  location: string | { address: string };
  description: string;
  organizerName?: string;
}

interface InvitationData {
  invitationId: string;
  guestName: string;
  guestEmail?: string;
  guestPhone?: string;
  amount: number;
  status: string;
  qrCodeData?: string;
  event: EventData;
}

function GuestInvitationContent() {
  const searchParams = useSearchParams();
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const invId = searchParams.get("inv");
    if (invId) {
      fetchInvitation(invId);
    } else {
      setError("No invitation ID found");
      setIsLoading(false);
    }
  }, [searchParams]);

  const fetchInvitation = async (id: string) => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/invitations/${id}`
      );
      const result = await response.json();

      if (response.ok && result.success) {
        setInvitation(result.data);
        if (
          ["confirmed", "accepted", "sent", "delivered"].includes(
            result.data.status
          )
        ) {
          if (result.data.qrCodeData) {
            setIsConfirmed(true);
          }
        }
      } else {
        setError(result.message || "Failed to load invitation");
      }
    } catch (err) {
      console.error("Fetch error:", err);
      setError("An error occurred while loading the invitation");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadTicket = () => {
    if (!invitation || !invitation.qrCodeData) return;
    const link = document.createElement("a");
    link.href = invitation.qrCodeData;
    link.download = `ticket-${invitation.event.title.replace(
      /\s+/g,
      "-"
    )}-${invitation.guestName.replace(/\s+/g, "-")}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatLocation = (loc: string | { address: string }) => {
    if (typeof loc === "string") return loc;
    return loc?.address || "Location details unavailable";
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString(undefined, {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-red-500 mb-4">
            <svg
              className="w-16 h-16 mx-auto"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            Invitation Not Found
          </h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!invitation) return null;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-8 text-white text-center">
            <h1 className="text-3xl font-bold mb-2">
              {isConfirmed ? "🎉 You're Going!" : "🎉 You're Invited!"}
            </h1>
            <p className="text-blue-100">
              {isConfirmed
                ? "Here is your ticket for the event"
                : "Please check your event details"}
            </p>
          </div>

          <div className="p-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {invitation.event.title}
              </h2>
              <span className="inline-block px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                {invitation.amount > 1
                  ? `${invitation.amount} Tickets`
                  : "1 Ticket"}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-600" />
                  Event Details
                </h3>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    <span className="text-gray-700">
                      {formatDate(invitation.event.startDate)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Clock className="w-4 h-4 text-gray-500" />
                    <span className="text-gray-700">
                      {invitation.event.startTime || "Time TBD"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <MapPin className="w-4 h-4 text-gray-500" />
                    <span className="text-gray-700">
                      {formatLocation(invitation.event.location)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <User className="w-5 h-5 text-blue-600" />
                  Guest Information
                </h3>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-3">
                    <User className="w-4 h-4 text-gray-500" />
                    <span className="text-gray-700">
                      {invitation.guestName}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    {invitation.guestEmail ? (
                      <Mail className="w-4 h-4 text-gray-500" />
                    ) : (
                      <Phone className="w-4 h-4 text-gray-500" />
                    )}
                    <span className="text-gray-700">
                      {invitation.guestEmail || invitation.guestPhone}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {invitation.qrCodeData && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-6 text-center">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center justify-center gap-2">
                  <QrCode className="w-5 h-5 text-blue-600" />
                  Your Digital Ticket
                </h3>

                <div className="flex flex-col items-center">
                  <img
                    src={invitation.qrCodeData}
                    alt="Event Ticket QR Code"
                    className="w-48 h-48 mb-4 bg-white p-2 rounded shadow-sm"
                  />
                  <button
                    onClick={handleDownloadTicket}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Download Ticket
                  </button>
                  <p className="text-xs text-gray-500 mt-4">
                    Please present this QR code at the entrance.
                  </p>
                </div>
              </div>
            )}

            <div className="text-center mt-8 text-sm text-gray-500">
              <p>Powered by Pazimo Events Platform</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function GuestInvitationPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      }
    >
      <GuestInvitationContent />
    </Suspense>
  );
}
