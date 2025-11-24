import { NextResponse } from "next/server";
import { generatePaymentUrl } from "@/lib/santimpay-client";
import { randomUUID } from "crypto";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      amount,
      paymentReason,
      phoneNumber,
      ticketData,
      invitationData,
      method,
      orderId: clientOrderId, // Accept orderId from client
      successUrl: clientSuccessUrl,
      failureUrl: clientFailureUrl,
      cancelUrl: clientCancelUrl,
    } = body;

    // Validate required fields
    if (!amount || !phoneNumber) {
      return NextResponse.json(
        { message: "Amount and phone number are required" },
        { status: 400 }
      );
    }

    const orderId = clientOrderId || randomUUID();
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

    // Construct URLs
    const successUrl =
      clientSuccessUrl || `${baseUrl}/payment/success?orderId=${orderId}`;
    const failureUrl =
      clientFailureUrl || `${baseUrl}/payment/failed?orderId=${orderId}`;
    const cancelUrl =
      clientCancelUrl || `${baseUrl}/payment/failed?orderId=${orderId}`;
    const notifyUrl = `${baseUrl}/api/payments/webhook`;

    // Generate Payment URL
    const paymentUrl = await generatePaymentUrl(
      orderId,
      Number(amount),
      paymentReason || "Payment",
      phoneNumber,
      successUrl,
      failureUrl,
      cancelUrl,
      notifyUrl
    );

    // TODO: Save pending transaction to database (Backend)
    // We need to store the mapping of orderId -> ticketData/invitationData
    // so the webhook knows what to fulfill.
    // For now, we'll assume the webhook can verify the transaction via SantimPay API
    // and we might need to pass metadata in the orderId or reason if possible.
    // Better approach: Call backend to save pending transaction.

    try {
      await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/payments/santim/save-pending`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId,
            amount,
            reason: paymentReason,
            phoneNumber,
            ticketData,
            invitationData,
            method,
          }),
        }
      );
    } catch (e) {
      console.error("Failed to save pending transaction to backend", e);
      // Proceed anyway, but fulfillment might fail if backend doesn't know about it
    }

    return NextResponse.json({ paymentUrl });
  } catch (error: any) {
    console.error("Payment creation error:", error);
    return NextResponse.json(
      { message: error.message || "Failed to create payment" },
      { status: 500 }
    );
  }
}
