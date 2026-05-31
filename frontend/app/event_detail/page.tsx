import { Suspense } from "react";
import EventDetailClient from "./EventDetailClient";

export default function EventDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen bg-white dark:bg-[#0A0A0A] text-gray-900 dark:text-gray-100">
          Loading event...
        </div>
      }
    >
      <EventDetailClient />
    </Suspense>
  );
}
