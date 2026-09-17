"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";
import { VenueGate } from "@/components/venue/venue-gate";

// Loaded client-side only: the scanner needs camera APIs that do not exist
// during SSR. Same arrangement as the cinema scanner page.
const VenueScanner = dynamic(() => import("@/components/venue/venue-scanner"), {
  ssr: false,
});

export default function VenueScannerPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-black text-white">
          Loading scanner…
        </div>
      }
    >
      <VenueGate>{(venue, token) => <VenueScanner venue={venue} token={token} />}</VenueGate>
    </Suspense>
  );
}
