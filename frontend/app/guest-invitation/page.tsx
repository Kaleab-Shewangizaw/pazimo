"use client";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Calendar, Clock, MapPin, QrCode, Download, Users } from "lucide-react";
import Image from "next/image";

interface EventData {
  title: string;
  startDate: string;
  startTime: string;
  location: string | { address: string };
  description: string;
  organizer?: { name: string };
}

interface InvitationData {
  ticketId: string;
  guestName: string;
  ticketCount: number;
  status: string;
  qrCode?: string;
  event: EventData;
  ticketType?: string;
  message?: string;
}

function GuestInvitationContent() {
  const searchParams = useSearchParams();
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isDeclined, setIsDeclined] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const invId = searchParams.get("id") || searchParams.get("inv");
    if (invId) fetchInvitation(invId);
    else {
      setError("No invitation ID found");
      setIsLoading(false);
    }
  }, [searchParams]);

  const fetchInvitation = async (id: string) => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/tickets/invitation/${id}`
      );
      const result = await response.json();
      if (response.ok && result.success) {
        const data = result.data;
        setInvitation(data);
        if (
          ["confirmed", "accepted", "delivered", "used"].includes(data.status)
        )
          setIsConfirmed(true);
        else if (data.status === "declined") setIsDeclined(true);
      } else {
        setError(result.message || "Failed to load invitation");
      }
    } catch {
      setError("An error occurred while loading the invitation");
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusUpdate = async (status: "confirmed" | "declined") => {
    if (!invitation) return;
    setIsLoading(true);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/tickets/invitation/${invitation.ticketId}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status }),
        }
      );
      const result = await response.json();
      if (response.ok) {
        if (status === "confirmed") setIsConfirmed(true);
        else setIsDeclined(true);
      } else {
        setError(result.message || "Failed to update status");
      }
    } catch (error) {
      setError("An error occurred while updating status");
    } finally {
      setIsLoading(false);
    }
  };

  const formatLocation = (loc: string | { address: string }) =>
    typeof loc === "string" ? loc : loc.address;
  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

  if (isLoading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin h-8 w-8 border-b-2 border-blue-600 rounded-full" />
      </div>
    );

  if (error)
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-600">{error}</p>
      </div>
    );

  if (!invitation) return null;

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto space-y-6 relative">
        {/* HERO */}
        <div className="relative bg-white rounded-xl shadow-xl p-8 text-center overflow-hidden">
          {/* Decorations */}
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-yellow-200 rounded-full opacity-60 rotate-12" />
          <div className="absolute -bottom-10 -left-10 w-28 h-28 bg-pink-200 rounded-lg opacity-50 -rotate-6" />
          <svg
            className="absolute top-20 -left-20 w-72 h-20 opacity-30"
            viewBox="0 0 300 80"
          >
            <path
              d="M0,40 Q150,0 300,40"
              stroke="#fbbf24"
              strokeWidth="8"
              fill="transparent"
            />
          </svg>
          <svg
            className="absolute bottom-24 -right-20 w-72 h-20 opacity-30"
            viewBox="0 0 300 80"
          >
            <path
              d="M0,40 Q150,80 300,40"
              stroke="#a78bfa"
              strokeWidth="6"
              fill="transparent"
            />
          </svg>
          {/* Confetti */}
          <svg className="absolute top-40 right-0 w-full h-60 pointer-events-none">
            <circle cx="20" cy="30" r="6" fill="#f59e0b" opacity="0.4" />
            <rect
              x="60"
              y="40"
              width="8"
              height="8"
              fill="#f472b6"
              opacity="0.3"
            />
            <polygon
              points="100,10 110,30 90,30"
              fill="#60a5fa"
              opacity="0.3"
            />
            <circle cx="140" cy="50" r="5" fill="#fbbf24" opacity="0.4" />
            <rect
              x="180"
              y="30"
              width="6"
              height="6"
              fill="#a78bfa"
              opacity="0.3"
            />
            <polygon
              points="220,20 230,40 210,40"
              fill="#34d399"
              opacity="0.3"
            />
            <circle cx="260" cy="60" r="4" fill="#f87171" opacity="0.3" />
            <rect
              x="300"
              y="40"
              width="7"
              height="7"
              fill="#fb923c"
              opacity="0.4"
            />
          </svg>

          {/* Guest Hero Content */}
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {isConfirmed
              ? "You're Going! 🎊"
              : isDeclined
              ? "Maybe Next Time"
              : "You're Invited!"}
          </h1>
          <p className="py-3 text-gray-400">
            {isConfirmed
              ? "Your attendance has been confirmed. We’re excited to have you with us."
              : isDeclined
              ? "You’ve declined this invitation. We hope to see you at a future event."
              : "Please confirm your attendance below."}
          </p>
          <h2 className="text-2xl font-extrabold text-gray-900">
            {invitation.event.title}
          </h2>

          {/* Action Buttons */}
        </div>

        {/* Invitation + Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Invitation Text */}
          <div className="bg-white rounded-xl p-6 shadow relative overflow-hidden">
            {/* Small confetti inside card */}
            <svg className="absolute top-0 right-0 w-32 h-32 opacity-20 pointer-events-none">
              <circle cx="20" cy="30" r="6" fill="#f59e0b" />
              <rect x="60" y="20" width="8" height="8" fill="#f472b6" />
            </svg>

            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              Dear {invitation.guestName},
              {invitation.ticketType &&
                ["VIP", "VVIP"].includes(invitation.ticketType) && (
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-bold ${
                      invitation.ticketType === "VVIP"
                        ? "bg-purple-100 text-purple-700 border border-purple-200"
                        : "bg-amber-100 text-amber-700 border border-amber-200"
                    }`}
                  >
                    {invitation.ticketType}
                  </span>
                )}
            </h3>
            <div className="text-gray-700 text-sm leading-relaxed space-y-4">
              <p>
                You are warmly invited to{" "}
                <strong>{invitation.event.title}</strong>.
              </p>

              {invitation.message && (
                <p className="italic text-gray-800 border-l-4 border-blue-500 pl-3 py-1 bg-blue-50/50 rounded-r">
                  &quot;{invitation.message}&quot;
                </p>
              )}

              <p>
                {invitation.event.description ||
                  "We would be honored to have you join us."}
              </p>

              <p>
                This invitation admits <strong>{invitation.ticketCount}</strong>{" "}
                {invitation.ticketCount > 1 ? "people" : "person"}.
              </p>
            </div>
          </div>

          {/* Event Details */}
          <div className="bg-blue-50 rounded-xl p-6 shadow relative overflow-hidden">
            {/* Confetti */}
            <svg className="absolute top-0 left-0 w-32 h-32 opacity-20 pointer-events-none">
              <circle cx="20" cy="30" r="6" fill="#f59e0b" />
              <rect x="60" y="20" width="8" height="8" fill="#f472b6" />
            </svg>

            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" /> Event Details
            </h3>
            <div className="space-y-2 text-sm text-gray-700">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-400" />
                {formatDate(invitation.event.startDate)}
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-400" />
                {invitation.event.startTime}
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-blue-400" />
                {formatLocation(invitation.event.location)}
              </div>
            </div>
          </div>
        </div>
        {!isConfirmed && !isDeclined && (
          <div className="flex justify-center gap-4 mt-6 relative z-10">
            <button
              onClick={() => handleStatusUpdate("confirmed")}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-semibold shadow-lg transition-all transform hover:scale-105"
            >
              Confirm Attendance
            </button>
            <button
              onClick={() => handleStatusUpdate("declined")}
              className="bg-red-100 hover:bg-red-200 text-red-700 px-8 py-3 rounded-lg font-semibold shadow transition-all"
            >
              Decline
            </button>
          </div>
        )}

        {/* QR */}
        {isConfirmed && invitation.qrCode && (
          <div className="bg-white relative rounded-xl p-6 shadow text-center">
            <div className=" my-3 mx-auto w-fit  bg-blue-400 text-white px-4 py-1 rounded-md text-sm font-semibold flex items-center gap-2 z-10 shadow">
              {" "}
              <Users className="w-4 h-4" /> Admits {invitation.ticketCount}{" "}
              {invitation.ticketCount > 1 ? "People" : "Person"}{" "}
            </div>
            <h3 className="font-semibold mb-4 flex items-center justify-center gap-2">
              <QrCode className="w-5 h-5 text-blue-600" />
              Digital Ticket (admits {invitation.ticketCount})
            </h3>
            <Image
              src={invitation.qrCode}
              alt="QR Code"
              width={192}
              height={192}
              className="mx-auto border rounded-lg"
            />
            <button className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg flex items-center gap-2 mx-auto">
              <Download className="w-4 h-4" />
              Download Ticket
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function GuestInvitationPage() {
  return (
    <Suspense>
      <GuestInvitationContent />
    </Suspense>
  );
}
