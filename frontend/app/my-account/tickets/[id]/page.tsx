"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { toast } from "sonner";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";

type Ticket = {
  _id: string;
  ticketId: string;
  event: {
    title: string;
    startDate: string;
    endDate: string;
    location: {
      address: string;
      city: string;
    };
  };
  ticketType: string;
  price: number;
  qrCode: string;
  status: string;
  paymentReference: string;
  ticketCount: number;
};

export default function TicketSuccessPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const { user, token } = useAuthStore();
  const id = params?.id as string;

  useEffect(() => {
    const fetchTickets = async () => {
      if (!id) return;

      // If we have query params like status=success, we might want to wait a bit or verify payment
      // But since we are on a dedicated page for a specific ID/Order, we can just try to fetch details.
      // If the ID is a transaction ref, the backend might need the payment to be completed.

      const status = searchParams.get("status");
      const paymentStatus = searchParams.get("payment_status");
      const txRef = searchParams.get("tx_ref");

      // If this is a redirect from payment gateway, we might need to verify first if it's not verified
      // But our backend getTicketDetails just looks for tickets.
      // If tickets aren't generated yet (webhook delay), we might get 404.
      // So we should retry a few times if it's a fresh redirect.

      const isRedirect = status || paymentStatus || txRef;
      let attempts = 0;
      const maxAttempts = 5; // Retry more if it's a redirect

      // Force a status check first to ensure ticket creation if it's pending
      try {
        await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/payments/status?ticketId=${id}`
        );
      } catch (e) {
        console.error("Failed to trigger status check", e);
      }

      while (attempts < maxAttempts) {
        try {
          const response = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/api/tickets/details/${id}`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          );

          if (response.ok) {
            const data = await response.json();
            if (data.success && data.tickets.length > 0) {
              setTickets(data.tickets);
              setLoading(false);
              if (isRedirect) {
                toast.success("Payment successful! Here are your tickets.");
                // Clean URL params if desired, but maybe keep them for debug
              }
              return;
            }
          }

          // If not found or empty, wait and retry
          await new Promise((resolve) => setTimeout(resolve, 2000));
        } catch (error) {
          console.error("Error fetching ticket details:", error);
        }
        attempts++;
      }

      setLoading(false);
      if (tickets.length === 0) {
        if (isRedirect) {
          toast.warning(
            "Payment successful but tickets are being generated. Please check 'My Tickets' in a moment."
          );
        } else {
          toast.error("Ticket not found or access denied.");
        }
      }
    };

    if (user && token && id) {
      fetchTickets();
    } else if (!token) {
      // If no token, maybe redirect to login or show message?
      // But we support guest checkout... wait, guest checkout creates an account and logs them in.
      // So token should be there.
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user, token, searchParams]);

  const downloadQRCode = (qrCodeUrl: string, ticketId: string) => {
    const link = document.createElement("a");
    link.href = qrCodeUrl;
    link.download = `ticket-${ticketId}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-[#0D47A1] mb-4" />
        <p className="text-gray-600">
          Verifying payment and generating tickets...
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6 text-center">Your Tickets</h1>

      {tickets.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-600 mb-4">
            No tickets found for this transaction.
          </p>
          <Button onClick={() => router.push("/my-account/tickets")}>
            View All Tickets
          </Button>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {tickets.map((ticket) => (
            <div
              key={ticket._id}
              className="bg-white border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="p-6 text-center">
                <h3 className="font-bold text-lg mb-1">{ticket.event.title}</h3>
                <p className="text-sm text-gray-500 mb-4">
                  {new Date(ticket.event.startDate).toLocaleDateString()}
                </p>

                <div className="bg-white p-4 rounded-lg border inline-block mb-4">
                  <Image
                    src={ticket.qrCode || "/events/sampleqr.png"}
                    alt={`Ticket ${ticket.ticketId}`}
                    width={150}
                    height={150}
                  />
                </div>

                <div className="space-y-2 mb-4">
                  <p className="text-sm font-medium text-gray-900">
                    {ticket.ticketType} Ticket
                  </p>
                  <p className="text-xs text-gray-500">ID: {ticket.ticketId}</p>
                  <p className="text-sm font-bold text-[#0D47A1]">
                    Admit: {ticket.ticketCount} Person
                    {ticket.ticketCount > 1 ? "s" : ""}
                  </p>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => downloadQRCode(ticket.qrCode, ticket.ticketId)}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download QR
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 text-center">
        <Button
          variant="link"
          onClick={() => router.push("/my-account/tickets")}
        >
          Back to My Tickets
        </Button>
      </div>
    </div>
  );
}
