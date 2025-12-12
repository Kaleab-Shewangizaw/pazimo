"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { QrCode, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";

interface RSVPButtonsProps {
  ticketId: string | null;
  initialData?: any;
}

export default function RSVPButtons({
  ticketId,
  initialData,
}: RSVPButtonsProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<"pending" | "confirmed" | "declined">(
    initialData?.status === "confirmed" || initialData?.status === "declined"
      ? initialData.status
      : "pending"
  );
  const [qrCodeData, setQrCodeData] = useState<string | null>(
    initialData?.qrCode || null
  );

  const handleRSVP = async (attending: boolean) => {
    if (!ticketId) {
      toast.error("Invalid invitation link");
      return;
    }

    setIsSubmitting(true);

    try {
      // Determine endpoint based on context (assuming ticketId is passed)
      // Using the ticket status update endpoint
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/tickets/invitation/${ticketId}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: attending ? "confirmed" : "declined",
          }),
        }
      );

      const result = await response.json();

      if (response.ok && result.success) {
        setStatus(attending ? "confirmed" : "declined");
        if (attending && result.data?.qrCode) {
          setQrCodeData(result.data.qrCode);
        } else if (attending) {
          // If QR code not in response, try fetching ticket details
          const ticketRes = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/api/tickets/invitation/${ticketId}`
          );
          const ticketData = await ticketRes.json();
          if (ticketData.success && ticketData.data.qrCode) {
            setQrCodeData(ticketData.data.qrCode);
          }
        }
        toast.success(
          attending ? "Attendance confirmed!" : "Response recorded"
        );
      } else {
        toast.error(result.message || "Failed to submit RSVP");
      }
    } catch (error) {
      console.error("RSVP Error:", error);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const downloadTicket = () => {
    if (!qrCodeData) return;

    const link = document.createElement("a");
    link.href = qrCodeData;
    link.download = `signature-invitation-${ticketId}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (status === "confirmed") {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center space-y-6 w-full"
      >
        <div className="bg-white p-4 rounded-xl shadow-lg border border-yellow-500/20">
          {qrCodeData ? (
            <Image
              src={qrCodeData}
              alt="Ticket QR Code"
              className="w-48 h-48 object-contain"
              width={50}
              height={50}
            />
          ) : (
            <div className="w-48 h-48 flex items-center justify-center bg-gray-100 rounded-lg">
              <QrCode className="w-12 h-12 text-gray-400" />
            </div>
          )}
        </div>

        <div className="text-center space-y-2">
          <h3 className="text-xl font-serif text-yellow-500">
            Attendance Confirmed
          </h3>
          <p className="text-neutral-400 text-sm">
            Please present this QR code at the entrance.
          </p>
        </div>

        <button
          onClick={downloadTicket}
          className="flex items-center gap-2 px-6 py-3 bg-yellow-600 hover:bg-yellow-700 text-white rounded-full transition-all shadow-lg hover:shadow-yellow-600/20"
        >
          <Download className="w-4 h-4" />
          <span>Download Ticket</span>
        </button>
      </motion.div>
    );
  }

  if (status === "declined") {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center p-6 bg-neutral-800/50 rounded-xl border border-neutral-700"
      >
        <p className="text-neutral-300">
          Thank you for letting us know. We hope to see you at our next event.
        </p>
      </motion.div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md mx-auto">
      <button
        onClick={() => handleRSVP(true)}
        disabled={isSubmitting}
        className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-yellow-600 hover:bg-yellow-700 text-white rounded-full transition-all shadow-lg hover:shadow-yellow-600/20 disabled:opacity-50 disabled:cursor-not-allowed group"
      >
        {isSubmitting ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <span>Confirm Attendance</span>
        )}
      </button>

      <button
        onClick={() => handleRSVP(false)}
        disabled={isSubmitting}
        className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-transparent border border-neutral-600 hover:border-neutral-400 text-neutral-300 hover:text-white rounded-full transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
      >
        <span>Decline</span>
      </button>
    </div>
  );
}
