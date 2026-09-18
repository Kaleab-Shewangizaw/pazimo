"use client";
import { useState, useEffect, Suspense, type CSSProperties } from "react";
import { useSearchParams } from "next/navigation";
import { Download, Loader2 } from "lucide-react";
import Image from "next/image";
import { ticketQrUrl, downloadTicketQr } from "@/lib/ticketQr";

interface EventData {
  title: string;
  startDate: string;
  startTime: string;
  location: string | { address?: string; city?: string; country?: string };
  description: string;
  organizer?: { name: string };
  coverImages?: string[];
}

interface InvitationData {
  ticketId: string;
  guestName: string;
  ticketCount: number;
  status: string;
  event: EventData;
  ticketType?: string;
  message?: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

const buildEventImageUrl = (coverImages?: string[]) => {
  if (!coverImages || coverImages.length === 0) return "";
  const img = coverImages[0];
  if (!img) return "";
  if (img.startsWith("http")) return img;
  return `${API_URL}${img.startsWith("/") ? img : `/${img}`}`;
};

const formatDateLine = (isoDate: string, startTime?: string) => {
  const date = new Date(isoDate);
  const weekday = date
    .toLocaleDateString("en-US", { weekday: "short" })
    .toUpperCase();
  const day = date.getDate().toString().padStart(2, "0");
  const month = date
    .toLocaleDateString("en-US", { month: "short" })
    .toUpperCase();
  const year = date.getFullYear();
  return `${weekday}, ${day} ${month} ${year}${startTime ? `, ${startTime}` : ""}`;
};

function GuestInvitationContent() {
  const searchParams = useSearchParams();
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isDeclined, setIsDeclined] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");

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
      const response = await fetch(`${API_URL}/api/tickets/invitation/${id}`);
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
    setIsUpdating(true);
    setActionError("");
    try {
      const response = await fetch(
        `${API_URL}/api/tickets/invitation/${invitation.ticketId}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        }
      );
      const result = await response.json();
      if (response.ok) {
        setIsConfirmed(status === "confirmed");
        setIsDeclined(status === "declined");
      } else {
        setActionError(result.message || "Failed to update status");
      }
    } catch {
      setActionError("Something went wrong. Please try again.");
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading)
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-500" />
      </div>
    );

  if (error)
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-background px-4">
        <p className="text-center font-medium text-red-500 dark:text-red-400">
          {error}
        </p>
      </div>
    );

  if (!invitation) return null;

  const handleDownload = () => {
    downloadTicketQr(invitation.ticketId, `invitation-${invitation.ticketId}.png`);
  };

  const dateLine = formatDateLine(
    invitation.event.startDate,
    invitation.event.startTime
  );
  const venue = (
    typeof invitation.event.location === "string"
      ? invitation.event.location
      : invitation.event.location?.address ||
        invitation.event.location?.city ||
        "See map"
  ).toUpperCase();
  const attendee = (invitation.guestName || "Guest").toUpperCase();
  const firstName = (invitation.guestName || "there").split(" ")[0];
  const orderId = invitation.ticketId.slice(-6).toUpperCase();
  const watermark = invitation.event.title.split(" ")[0]?.toUpperCase() || "";
  const eventImageUrl = buildEventImageUrl(invitation.event.coverImages);

  const backdropStyle: CSSProperties | undefined = eventImageUrl
    ? {
        backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.7), rgba(0,0,0,0.35) 50%, rgba(0,0,0,0.8)), linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.45)), url(${eventImageUrl})`,
        backgroundSize: "cover, cover, cover",
        backgroundPosition: "center, center, center",
        backgroundAttachment: "fixed, fixed, fixed",
        backgroundRepeat: "no-repeat, no-repeat, no-repeat",
      }
    : undefined;

  const badgeLabel =
    invitation.ticketType === "VVIP"
      ? "VVIP"
      : invitation.ticketType === "VIP"
      ? "VIP"
      : "GUEST PASS";
  const badgeClass =
    invitation.ticketType === "VVIP"
      ? "border-purple-300/70 bg-purple-500/20 text-purple-100"
      : invitation.ticketType === "VIP"
      ? "border-amber-300/70 bg-amber-500/20 text-amber-100"
      : "border-white/50 text-white";

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      {/* Full-screen event backdrop */}
      <div
        className="fixed inset-0 -z-10 bg-gray-50 dark:bg-background"
        style={backdropStyle}
      />

      <div className="relative flex min-h-screen w-full flex-col items-center px-4 py-10 sm:py-16">
        {/* Headline */}
        <div className="mb-6 w-full max-w-sm text-center">
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-gray-100 sm:text-3xl">
            {isConfirmed
              ? "You're Going! 🎉"
              : isDeclined
              ? "Maybe Next Time"
              : "You're Invited"}
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {isConfirmed
              ? `${firstName}, your spot is locked in — see you there.`
              : isDeclined
              ? "You've let the organizer know you can't make it this time."
              : `${firstName}, you've been personally invited. Let us know if you're coming.`}
          </p>
        </div>

        {/* Ticket card */}
        <div className="w-full max-w-sm overflow-hidden rounded-3xl border-0 bg-gradient-to-br from-[#06283D] to-[#1A5D8C] pb-8 shadow-2xl ring-1 ring-white/10 dark:bg-card">
          {/* Header block */}
          <div className="relative overflow-hidden bg-gradient-to-br from-[#06283D] to-[#1A5D8C] px-7 py-10">
            <span className="pointer-events-none absolute -bottom-4 right-5 select-none whitespace-nowrap text-6xl font-black tracking-tight text-white/10">
              {watermark}
            </span>

            <div className="relative flex items-start justify-between gap-3">
              <h2 className="text-xl font-extrabold leading-tight text-white">
                {invitation.event.title}
              </h2>
              <span
                className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-[10px] font-bold tracking-wider ${badgeClass}`}
              >
                {badgeLabel}
              </span>
            </div>

            <div className="relative mt-5 grid grid-cols-2 gap-x-3 gap-y-4">
              <div>
                <p className="text-[10px] tracking-wider text-white/65">
                  DATE &amp; TIME
                </p>
                <p className="text-sm font-bold text-white">{dateLine}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] tracking-wider text-white/65">
                  VENUE
                </p>
                <p className="text-sm font-bold text-white">{venue}</p>
              </div>
              <div>
                <p className="text-[10px] tracking-wider text-white/65">
                  ADMITS
                </p>
                <p className="text-sm font-bold text-white">
                  {invitation.ticketCount.toString().padStart(2, "0")}{" "}
                  {invitation.ticketCount > 1 ? "GUESTS" : "GUEST"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] tracking-wider text-white/65">
                  INVITE ID
                </p>
                <p className="text-sm font-bold text-white">{orderId}</p>
              </div>
              <div className="col-span-2">
                <p className="text-[10px] tracking-wider text-white/65">
                  GUEST
                </p>
                <p className="text-sm font-bold text-white">{attendee}</p>
              </div>
            </div>
          </div>

          {/* Perforation with die-cut notches */}
          <div className="relative">
            <div
              className="absolute -top-2.5 -left-2.5 h-5 w-5 rounded-full border-0 bg-gray-50 dark:bg-background"
              style={backdropStyle}
            />
            <div
              className="absolute -top-2.5 -right-2.5 h-5 w-5 rounded-full bg-gray-50 dark:bg-background"
              style={backdropStyle}
            />
            <div className="mx-5 border-t-2 border-dashed border-gray-300 dark:border-border" />
          </div>

          {/* Stub / action area */}
          <div className="px-7 pt-6">
            {invitation.message && (
              <p className="mb-5 rounded-r border-l-4 border-blue-500 bg-blue-50/70 py-1 pl-3 text-sm italic text-gray-700 dark:border-yellow-400 dark:bg-white/5 dark:text-gray-300">
                &quot;{invitation.message}&quot;
              </p>
            )}

            {isConfirmed ? (
              <div className="flex flex-col items-center gap-3">
                <Image
                  width={256}
                  height={256}
                  priority
                  unoptimized
                  src={ticketQrUrl(invitation.ticketId)}
                  alt="Ticket QR Code"
                  className="h-34 w-34"
                />
                <p className="text-[11px] font-bold tracking-[0.2em] text-gray-400 dark:text-gray-500">
                  &mdash;&mdash; SCAN FOR ENTRY &mdash;&mdash;
                </p>
                <button
                  onClick={handleDownload}
                  className="mt-1 flex items-center gap-2 rounded-full bg-[#06283D] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#0a3a57] dark:bg-yellow-400 dark:text-black dark:hover:bg-yellow-300"
                >
                  <Download className="h-4 w-4" />
                  Download Ticket
                </button>
              </div>
            ) : isDeclined ? (
              <div className="flex flex-col items-center gap-2 py-2 text-center">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Changed your mind?
                </p>
                <button
                  onClick={() => handleStatusUpdate("confirmed")}
                  disabled={isUpdating}
                  className="text-sm font-semibold text-blue-600 hover:underline disabled:opacity-50 dark:text-yellow-400"
                >
                  {isUpdating ? "Updating…" : "Confirm attendance instead"}
                </button>
                {actionError && (
                  <p className="mt-1 text-xs text-red-500 dark:text-red-400">
                    {actionError}
                  </p>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <div className="relative">
                  <Image
                    width={256}
                    height={256}
                    unoptimized
                    src={ticketQrUrl(invitation.ticketId)}
                    alt=""
                    aria-hidden
                    className="h-28 w-28 opacity-40 blur-sm grayscale"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="rounded bg-white/80 px-2 py-1 text-[10px] font-bold tracking-wider text-gray-500 dark:bg-black/60 dark:text-gray-400">
                      LOCKED
                    </span>
                  </div>
                </div>
                <p className="text-center text-xs text-gray-500 dark:text-gray-400">
                  Confirm to unlock your ticket QR code.
                </p>
                <div className="flex w-full gap-3">
                  <button
                    onClick={() => handleStatusUpdate("declined")}
                    disabled={isUpdating}
                    className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-border dark:text-gray-300 dark:hover:bg-white/5"
                  >
                    Decline
                  </button>
                  <button
                    onClick={() => handleStatusUpdate("confirmed")}
                    disabled={isUpdating}
                    className="flex-1 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-blue-700 disabled:opacity-50 dark:bg-yellow-400 dark:text-black dark:hover:bg-yellow-300"
                  >
                    {isUpdating ? "Confirming…" : "Confirm Attendance"}
                  </button>
                </div>
                {actionError && (
                  <p className="text-xs text-red-500 dark:text-red-400">
                    {actionError}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
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
