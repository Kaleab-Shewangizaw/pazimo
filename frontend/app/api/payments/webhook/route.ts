import { NextResponse } from "next/server";
import { checkTransactionStatus } from "@/lib/santimpay-client";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const orderId = body.id || body.order_id;

    if (!orderId) {
      return NextResponse.json(
        { message: "Missing Order ID" },
        { status: 400 }
      );
    }

    // Verify status with SantimPay directly (Secure)
    const transaction = await checkTransactionStatus(orderId);

    const status = transaction.status || transaction.paymentStatus;

    if (status === "COMPLETED" || status === "SUCCESS") {
      // Call Backend to fulfill
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/payments/santim/webhook-fulfill`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: orderId,
              status: "COMPLETED",
              paymentId: transaction.paymentId || transaction.reference,
            }),
          }
        );

        if (!response.ok) {
          throw new Error("Backend fulfillment failed");
        }
      } catch (e) {
        console.error("Failed to fulfill payment via backend", e);
        return NextResponse.json(
          { message: "Fulfillment failed" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ status: "success" });
  } catch (error: any) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { message: error.message || "Webhook failed" },
      { status: 500 }
    );
  }
}
