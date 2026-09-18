"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";

// Loaded client-side only: the scanner needs camera APIs that do not exist
// during SSR. Same arrangement as the organizer's scanner page.
const CinemaScanner = dynamic(
  () => import("@/components/cinema/cinema-scanner"),
  { ssr: false }
);

export default function CinemaScannerPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-black text-white">
          Loading scanner…
        </div>
      }
    >
      <CinemaScanner />
    </Suspense>
  );
}
