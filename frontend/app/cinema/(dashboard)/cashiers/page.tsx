"use client";

import { CinemaGate } from "@/components/cinema/cinema-gate";
import { CinemaCashierManager } from "@/components/cinema/cinema-cashier-manager";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Owner-only cashier management for this cinema — create counter-staff
 * logins scoped to it, suspend/reactivate them, or edit their details. Never
 * reached by a cashier itself: clientLayout.tsx's CASHIER_ALLOWED_PATHS keeps
 * this page off a cashier's allowlist, and the backend routes it under
 * cinemaSelf (owner+admin only), not cinemaStaff.
 */
export default function CinemaCashiersPage() {
  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-bold text-gray-900 dark:text-gray-100">Cashiers</h1>
      <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
        Give counter staff their own login, scoped to this cinema only.
      </p>
      <CinemaGate>
        {(_cinema, token) => (
          <Card className="border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950/50">
            <CardContent className="p-5">
              <CinemaCashierManager endpointBase="/api/cinemas/me" token={token} />
            </CardContent>
          </Card>
        )}
      </CinemaGate>
    </div>
  );
}
