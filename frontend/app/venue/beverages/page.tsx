"use client";

import { VenueGate } from "@/components/venue/venue-gate";
import { BeverageLineupManager } from "@/components/beverages/beverage-lineup-manager";
import { Card, CardContent } from "@/components/ui/card";
import { Beer, ShieldCheck } from "lucide-react";

export default function VenueBeveragesPage() {
  return (
    <VenueGate>
      {(venue, token) => (
        <div className="container mx-auto max-w-6xl px-4 py-8">
          <Card className="mb-6 border border-amber-200 bg-amber-50/70 dark:border-amber-900 dark:bg-amber-950/20">
            <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                  <Beer className="h-5 w-5 text-amber-700 dark:text-amber-400" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Drink lineup</h1>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    Set what this venue sells, how much it costs, and how much stock is live on the floor.
                  </p>
                </div>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-900 dark:bg-gray-950/50 dark:text-emerald-300">
                <ShieldCheck className="h-3.5 w-3.5" />
                {venue.eligibility === "eligible" ? "Approved to sell" : "Pending approval"}
              </div>
            </CardContent>
          </Card>

          <BeverageLineupManager token={token} context={{ kind: "venue", venueId: venue._id, scope: "venue" }} />
        </div>
      )}
    </VenueGate>
  );
}