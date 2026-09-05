"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CheckCircle, Loader2, ArrowRight, Ticket, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { processInvitation } from "@/lib/invitationUtils";
import { toast } from "sonner";
import { useAuthStore } from "@/store/authStore";

function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { login } = useAuthStore();
  const txnId =
    searchParams.get("txn") ||
    searchParams.get("orderId") ||
    searchParams.get("tx_ref");
  const [status, setStatus] = useState<
    "loading" | "success" | "pending" | "failed"
  >("loading");
  const [pollCount, setPollCount] = useState(0);
  const [isInvitation, setIsInvitation] = useState(false);
  const [newUserCreated, setNewUserCreated] = useState(false);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const hasRedirected = useRef(false);

  useEffect(() => {
    if (!txnId) {
      setStatus("failed");
      toast.error("Missing payment reference. Please contact support.");
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

        if (data.status === "COMPLETED" || data.status === "PAID") {
          setStatus("success");
          if (data.ticketId) {
            setTicketId(data.ticketId);
          }

          if (data.newUserCredentials) {
            setNewUserCreated(true);
            try {
              await login({
                email: data.newUserCredentials.email,
                password: data.newUserCredentials.password,
              });
              toast.success("Welcome to Pazimo! Your account has been created.");
            } catch {
              toast.info(
                `Your account has been created. Login with:\nEmail: ${data.newUserCredentials.email}\nPassword: ${data.newUserCredentials.password}`,
                { duration: 10000 }
              );
            }
          }

          // Check for pending invitation
          const storedInvitation = localStorage.getItem(`invitation_${txnId}`);
          if (storedInvitation) {
            setIsInvitation(true);
            try {
              const invitationData = JSON.parse(storedInvitation);
              await processInvitation(invitationData);
              localStorage.removeItem(`invitation_${txnId}`);
            } catch {
              toast.error("Payment successful, but failed to send invitation.");
            }
          }
        } else if (data.status === "CANCELLED" || data.status === "CANCELED") {
          setStatus("failed");
          toast.error("Payment was cancelled.");
        } else if (data.status === "FAILED") {
          setStatus("failed");
          toast.error("Payment failed. Please try again.");
        } else {
          // Direct-charge payments (BOA USSD, Telebirr, etc.) need the user to
          // act on their phone. Poll for up to 3 minutes, then cancel.
          // First 8 polls are fast, then settle at 2s intervals.
          // 8 fast polls + ~82 × 2s ≈ 3 min total window.
          if (pollCount < 90) {
            const delays = [500, 500, 1000, 1000, 1500, 1500, 2000, 2000];
            const delay = delays[pollCount] ?? 2000;
            setTimeout(() => setPollCount((prev) => prev + 1), delay);
          } else {
            // 3 minutes elapsed — cancel the payment server-side and show failure
            await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/payments/cancel`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ transactionId: txnId }),
            }).catch(() => {});
            setStatus("failed");
            toast.error("Payment timed out. Please try again.");
          }
        }
      } catch {
        // Retry on error up to the same 3-minute window
        if (pollCount < 90) {
          const delays = [500, 500, 1000, 1000, 2000, 2000, 3000, 3000];
          const delay = delays[pollCount] ?? 3000;
          setTimeout(() => setPollCount((prev) => prev + 1), delay);
        } else {
          setStatus("failed");
          toast.error("Payment timed out. Please try again.");
        }
      }
    };

    checkStatus();
  }, [txnId, pollCount, status]);

  useEffect(() => {
    if (status !== "success" || hasRedirected.current) return;
    hasRedirected.current = true;

    const target = ticketId ? `/ticket/${ticketId}` : "/my-account";
    const timer = setTimeout(() => {
      router.replace(target);
    }, 1200);

    return () => clearTimeout(timer);
  }, [status, ticketId, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4 dark:bg-background">
      <div className="w-full max-w-md rounded-2xl border border-transparent bg-white p-8 text-center shadow-xl dark:border-border dark:bg-card">
        <div className="mb-6 flex justify-center">
          {status === "loading" || status === "pending" ? (
            <Loader2 className="h-16 w-16 animate-spin text-blue-600 dark:text-blue-400" />
          ) : status === "success" ? (
            <CheckCircle className="h-20 w-20 text-green-500 dark:text-green-400" />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-100 dark:bg-red-500/10">
              <AlertTriangle className="h-10 w-10 text-red-500 dark:text-red-400" />
            </div>
          )}
        </div>

        <h1 className="mb-2 text-2xl font-bold text-gray-900 dark:text-foreground">
          {status === "loading"
            ? "Verifying payment"
            : status === "pending"
            ? "Confirming payment"
            : status === "success"
            ? "Payment successful"
            : "Payment failed"}
        </h1>

        <p className="mb-8 text-gray-600 dark:text-muted-foreground">
          {status === "loading" || status === "pending"
            ? "This only takes a moment."
            : status === "success"
            ? isInvitation
              ? "Your invitation is on its way."
              : newUserCreated
              ? "Your account is ready, and your ticket is on its way."
              : "Your ticket is ready — sent to your email."
            : "We couldn't verify this payment. Contact support if you were charged."}
        </p>

        <div className="space-y-3">
          {status === "success" && !isInvitation && (
            <Link href="/my-account" className="block w-full">
              <Button className="h-12 w-full bg-blue-600 text-lg text-white hover:bg-blue-700">
                <Ticket className="mr-2 h-5 w-5" /> View my tickets
              </Button>
            </Link>
          )}

          {status === "success" && isInvitation && (
            <Link href="/organizer/invitations" className="block w-full">
              <Button className="h-12 w-full bg-blue-600 text-lg text-white hover:bg-blue-700">
                Return to invitations
              </Button>
            </Link>
          )}

          <Link
            href="/events"
            className={`flex w-full items-center justify-center gap-2 rounded-lg px-6 py-3 font-semibold transition-colors ${
              status === "success"
                ? "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-secondary dark:text-secondary-foreground dark:hover:bg-secondary/80"
                : "bg-blue-600 text-white hover:bg-blue-700"
            }`}
          >
            {status === "success" ? "Browse more events" : "Return to events"}{" "}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="p-10 text-center text-gray-600 dark:text-muted-foreground">
          Loading…
        </div>
      }
    >
      <PaymentSuccessContent />
    </Suspense>
  );
}
