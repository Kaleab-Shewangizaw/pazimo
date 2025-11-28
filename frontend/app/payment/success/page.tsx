"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CheckCircle, Loader2, ArrowRight, Ticket } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { processInvitation } from "@/lib/invitationUtils";
import { toast } from "sonner";

function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const txnId = searchParams.get("txn") || searchParams.get("orderId");
  const [status, setStatus] = useState<
    "loading" | "success" | "pending" | "failed"
  >("loading");
  const [pollCount, setPollCount] = useState(0);
  const [isInvitation, setIsInvitation] = useState(false);

  useEffect(() => {
    if (!txnId) {
      setStatus("success"); // Fallback if no txnId
      return;
    }

    const checkStatus = async () => {
      // If we already know it's a success, don't poll again
      if (status === "success") return;

      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/payments/status?txn=${txnId}`
        );
        const data = await response.json();

        if (data.success === true) {
          setStatus("success");

          // Check for pending invitation
          const storedInvitation = localStorage.getItem(`invitation_${txnId}`);
          if (storedInvitation) {
            setIsInvitation(true);
            try {
              const invitationData = JSON.parse(storedInvitation);
              await processInvitation(invitationData);
              localStorage.removeItem(`invitation_${txnId}`);
              // toast.success("Invitation sent successfully!");
            } catch (e) {
              console.error("Failed to process invitation", e);
              toast.error("Payment successful, but failed to send invitation.");
            }
          }
        } else if (data.status === "FAILED" || data.status === "CANCELLED") {
          setStatus("failed");
        } else {
          // Still pending, poll again
          if (pollCount < 20) {
            // Poll for ~40 seconds (2s interval)
            setTimeout(() => setPollCount((prev) => prev + 1), 2000);
          } else {
            setStatus("pending"); // Give up polling, show pending message
          }
        }
      } catch (error) {
        console.error("Status check failed", error);
        // Retry on error
        if (pollCount < 20) {
          setTimeout(() => setPollCount((prev) => prev + 1), 2000);
        }
      }
    };

    checkStatus();
  }, [txnId, pollCount, status]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
        <div className="mb-6 flex justify-center">
          {status === "loading" || status === "pending" ? (
            <Loader2 className="w-16 h-16 text-blue-600 animate-spin" />
          ) : status === "success" ? (
            <CheckCircle className="w-20 h-20 text-green-500" />
          ) : (
            <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center">
              <span className="text-4xl">⚠️</span>
            </div>
          )}
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {status === "loading"
            ? "Verifying Payment..."
            : status === "pending"
            ? "Payment Processing"
            : status === "success"
            ? "Payment Successful!"
            : "Payment Failed"}
        </h1>

        <p className="text-gray-600 mb-8">
          {status === "loading" || status === "pending"
            ? "Please wait while we confirm your transaction."
            : status === "success"
            ? isInvitation
              ? "Thank you! Your invitation has been sent successfully."
              : "Thank you for your purchase. Your tickets have been generated and sent to your email."
            : "We couldn't verify your payment. Please contact support if you believe this is an error."}
        </p>

        <div className="space-y-3">
          {status === "success" && !isInvitation && (
            <Link href="/my-account" className="block w-full">
              <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white h-12 text-lg">
                <Ticket className="mr-2 h-5 w-5" /> View My Tickets
              </Button>
            </Link>
          )}

          {status === "success" && isInvitation && (
            <Link href="/organizer/invitations" className="block w-full">
              <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white h-12 text-lg">
                Return to Invitations
              </Button>
            </Link>
          )}

          <Link
            href="/events"
            className={`block w-full ${
              status === "success"
                ? "bg-gray-100 hover:bg-gray-200 text-gray-700"
                : "bg-blue-600 hover:bg-blue-700 text-white"
            } font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2`}
          >
            {status === "success" ? "Browse More Events" : "Return to Events"}{" "}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center">Loading...</div>}>
      <PaymentSuccessContent />
    </Suspense>
  );
}
