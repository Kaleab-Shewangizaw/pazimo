"use client";

import { useParams } from "next/navigation";
import CinemaOrderResult from "@/components/cinemas/cinema-order-result";

/**
 * Landing spot for a payment-redirect return (hosted Chapa checkout), and the
 * bookmark link "my tickets" uses for a past order. A direct-charge purchase
 * (the common case — mobile money approved on the customer's phone) no longer
 * lands here at all: booking-flow.tsx renders the same CinemaOrderResult
 * inline instead of navigating away, so this route only exists for the two
 * cases above.
 */
export default function CinemaOrderPage() {
  // useParams rather than the `params` prop: this is a client component, and
  // React 18 has no `use()` to unwrap the promise Next 15 passes. Every other
  // client page in this app reads its route the same way.
  const { transactionId } = useParams<{ transactionId: string }>();

  return <CinemaOrderResult transactionId={transactionId} />;
}
