"use client";
import { ticketQrUrl } from "@/lib/ticketQr";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { toast } from "sonner";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { downloadTicketQr } from "@/lib/ticketQr";

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
      await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/payments/status?ticketId=${id}`
      ).catch(() => {});

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
        } catch {
          // Retried below regardless — a network blip here just costs a beat.
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

  const downloadQRCode = (ticketId: string) => {
    downloadTicketQr(ticketId, `ticket-${ticketId}.png`).catch(() =>
      toast.error("Could not download the QR code")
    );
  };

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center dark:bg-background">
        <Loader2 className="mb-4 h-8 w-8 animate-spin text-[#0D47A1] dark:text-blue-400" />
        <p className="text-gray-600 dark:text-muted-foreground">
          Getting your ticket ready…
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8 dark:bg-background">
      <h1 className="mb-6 text-center text-2xl font-bold text-gray-900 dark:text-foreground">
        Your tickets
      </h1>

      {tickets.length === 0 ? (
        <div className="rounded-lg bg-gray-50 py-12 text-center dark:bg-card">
          <p className="mb-4 text-gray-600 dark:text-muted-foreground">
            No tickets found for this order.
          </p>
          <Button onClick={() => router.push("/my-account/tickets")}>
            View all tickets
          </Button>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {tickets.map((ticket) => (
            <div
              key={ticket._id}
              className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-border dark:bg-card"
            >
              <div className="p-6 text-center">
                <h3 className="mb-1 font-bold text-lg text-gray-900 dark:text-foreground">
                  {ticket.event.title}
                </h3>
                <p className="mb-4 text-sm text-gray-500 dark:text-muted-foreground">
                  {new Date(ticket.event.startDate).toLocaleDateString()}
                </p>

                <div className="mb-4 inline-block rounded-lg border border-gray-200 bg-white p-4 dark:border-border">
                  <Image
                    src={ticket.ticketId ? ticketQrUrl(ticket.ticketId) : "/events/sampleqr.png"}
                    unoptimized
                    alt={`Ticket ${ticket.ticketId}`}
                    width={150}
                    height={150}
                  />
                </div>

                <div className="mb-4 space-y-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-foreground">
                    {ticket.ticketType}
                  </p>
                  <p className="text-sm font-bold text-[#0D47A1] dark:text-blue-400">
                    Admits {ticket.ticketCount}
                  </p>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => downloadQRCode(ticket.ticketId)}
                >
                  <Download className="mr-2 h-4 w-4" />
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
          Back to my tickets
        </Button>
      </div>
    </div>
  );
}
