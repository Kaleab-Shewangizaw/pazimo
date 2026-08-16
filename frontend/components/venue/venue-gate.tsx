"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { Skeleton } from "@/components/ui/skeleton";
import { Store, Clock } from "lucide-react";
import { fetchMyVenue, type VenueProfile } from "@/lib/venue-api";

/**
 * Resolves the signed-in account's venue and gates the surface behind approval.
 *
 * Every venue page needs the same three things — the venue's id to build its
 * requests from, a loading state, and something to show a venue that has not
 * been approved yet — so they live here once rather than in each page.
 *
 * The venue is always fetched from /api/venues/me: the id is never taken from
 * the URL or from local state, which is what keeps a venue's requests pointed
 * at its own venue and nothing else.
 */
export function VenueGate({
  children,
}: {
  children: (venue: VenueProfile, token: string) => ReactNode;
}) {
  const { token } = useAuthStore();
  const [venue, setVenue] = useState<VenueProfile | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetchMyVenue(token)
      .then((data) => {
        if (cancelled) return;
        setVenue(data);
        setState("ready");
      })
      .catch((error: Error) => {
        if (cancelled) return;
        setMessage(error.message);
        setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (state === "loading") {
    return (
      <div className="container mx-auto max-w-6xl px-4 py-8">
        <Skeleton className="mb-6 h-9 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (state === "error" || !venue) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-16 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/40">
          <Store className="h-7 w-7 text-amber-600 dark:text-amber-400" />
        </div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          This account isn&apos;t linked to a venue
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-gray-600 dark:text-gray-400">
          {message || "Get in touch with Pazimo to have your venue set up."}
        </p>
      </div>
    );
  }

  // Approved-to-sell is separate from having a venue at all: a venue awaiting
  // approval still signs in and still sees who it is, it just cannot list
  // drinks yet. Saying so beats a bare permission error.
  if (venue.eligibility !== "eligible") {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-16 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/40">
          <Clock className="h-7 w-7 text-amber-600 dark:text-amber-400" />
        </div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          {venue.name} isn&apos;t approved to sell yet
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-gray-600 dark:text-gray-400">
          {venue.eligibilityNotes ||
            "Pazimo approves venues for beverage sales individually. We'll be in touch once your venue is live."}
        </p>
      </div>
    );
  }

  return <>{children(venue, token || "")}</>;
}
