"use client";

import { useState } from "react";
import { Loader2, CreditCard } from "lucide-react";
import { toast } from "sonner";

interface SantimPayButtonProps {
  amount: number;
  reason: string;
  phoneNumber?: string;
  className?: string;
  onInitiate?: () => void;
}

export default function SantimPayButton({
  amount,
  reason,
  phoneNumber,
  className = "",
  onInitiate,
}: SantimPayButtonProps) {
  const [loading, setLoading] = useState(false);

  const handlePayment = async () => {
    if (loading) return;
    setLoading(true);
    if (onInitiate) onInitiate();

    try {
      // Generate UUID on frontend
      const txnId = crypto.randomUUID();

      // Call backend to initiate payment
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/payments/initiate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amount,
            paymentReason: reason,
            phoneNumber,
            txnId,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Payment initiation failed");
      }

      const { paymentUrl } = data;

      if (paymentUrl) {
        // Redirect to SantimPay
        window.location.href = paymentUrl;
      } else {
        toast.error("Failed to get payment URL");
        setLoading(false);
      }
    } catch (error) {
      console.error("Payment Error:", error);
      toast.error(
        error instanceof Error ? error.message : "Payment initiation failed"
      );
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handlePayment}
      disabled={loading}
      className={`flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed ${className}`}
    >
      {loading ? (
        <>
          <Loader2 className="w-5 h-5 animate-spin" />
          Processing...
        </>
      ) : (
        <>
          <CreditCard className="w-5 h-5" />
          Pay with SantimPay
        </>
      )}
    </button>
  );
}
