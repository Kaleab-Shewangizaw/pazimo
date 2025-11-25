import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const orderId = searchParams.get("orderId");
  const ticketId = searchParams.get("ticketId");

  if (!orderId && !ticketId) {
    return NextResponse.json(
      { message: "Order ID or Ticket ID required" },
      { status: 400 }
    );
  }

  try {
    const query = orderId ? `txn=${orderId}` : `ticketId=${ticketId}`;
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/payments/status?${query}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    console.error("Payment verification error:", error);
    return NextResponse.json(
      { message: error.message || "Failed to verify payment" },
      { status: 500 }
    );
  }
}
