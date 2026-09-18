"use client";

import { useAuthStore } from "@/store/authStore";
import { VenueGate } from "@/components/venue/venue-gate";
import { VenueCashierManager } from "@/components/venue/venue-cashier-manager";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldOff } from "lucide-react";
import type { VenueProfile } from "@/lib/venue-api";

function VenueCashiersContent({ venue, token }: { venue: VenueProfile; token: string }) {
  const role = useAuthStore((s) => s.user?.role);

  // Nav already hides this page from a cashier and the backend rejects a
  // cashier's own token on every cashier-management route (see
  // adminOrVenueAccount in backend/src/routes/venueRoutes.js) — this is just
  // the friendly version of that same rule for anyone who lands here directly
  // by URL, e.g. a bookmark from before their role changed.
  if (role === "cashier") {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-16 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/40">
          <ShieldOff className="h-7 w-7 text-amber-600 dark:text-amber-400" />
        </div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Cashiers can&apos;t manage other cashiers
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-gray-600 dark:text-gray-400">
          Ask {venue.name}&apos;s owner or Pazimo to add or remove counter staff.
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Cashiers</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Counter staff logins for {venue.name}.
        </p>
      </div>

      <Card className="border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950/50">
        <CardContent className="p-5">
          <VenueCashierManager venueId={venue._id} token={token} />
        </CardContent>
      </Card>
    </div>
  );
}

export default function VenueCashiersPage() {
  return (
    <VenueGate>{(venue, token) => <VenueCashiersContent venue={venue} token={token} />}</VenueGate>
  );
}
