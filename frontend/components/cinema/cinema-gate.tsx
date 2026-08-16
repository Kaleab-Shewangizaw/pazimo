"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { Skeleton } from "@/components/ui/skeleton";
import { Film } from "lucide-react";
import { fetchMyCinema, type CinemaProfile } from "@/lib/cinema-api";

/**
 * Resolves the signed-in account's cinema and hands it to the page.
 *
 * Every cinema page needs the same three things — the cinema to build its
 * screens from, a loading state, and something to show an account with no cinema
 * — so they live here once rather than in each page.
 *
 * The cinema always comes from /api/cinemas/me: it is never taken from the URL
 * or from local state, which is what keeps a cinema's requests pointed at its
 * own cinema and nothing else.
 *
 * Unlike VenueGate this does NOT gate on approval. A venue exists only to sell
 * drinks, so an unapproved venue has nothing to do; a cinema's main business is
 * seats, which needs no approval — only the concessions surface does, and that
 * page gates itself.
 */
export function CinemaGate({
  children,
}: {
  children: (cinema: CinemaProfile, token: string) => ReactNode;
}) {
  const { token } = useAuthStore();
  const [cinema, setCinema] = useState<CinemaProfile | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetchMyCinema(token)
      .then((data) => {
        if (cancelled) return;
        setCinema(data);
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

  if (state === "error" || !cinema) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-16 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-950/40">
          <Film className="h-7 w-7 text-indigo-600 dark:text-indigo-400" />
        </div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          This account isn&apos;t linked to a cinema
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-gray-600 dark:text-gray-400">
          {message || "Get in touch with Pazimo to have your cinema set up."}
        </p>
      </div>
    );
  }

  return <>{children(cinema, token || "")}</>;
}
