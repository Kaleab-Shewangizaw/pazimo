"use client";

import { CinemaGate } from "@/components/cinema/cinema-gate";
import CinemaScheduleTickets from "@/components/cinema/cinema-schedule-tickets";

export default function CinemaTicketsPage() {
  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-bold text-gray-900 dark:text-gray-100">Tickets</h1>
      <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
        Pick a screening off the week to see what it sold and who&apos;s walked in.
      </p>
      <CinemaGate>
        {(_cinema, token) => <CinemaScheduleTickets token={token} endpointBase="/api/cinemas/me" />}
      </CinemaGate>
    </div>
  );
}
