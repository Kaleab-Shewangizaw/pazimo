"use client";

import { useAuthStore } from "@/store/authStore";
import { EventCashierManager } from "@/components/events/event-cashier-manager";
import { Card, CardContent } from "@/components/ui/card";

export default function OrganizerCashiersPage() {
  const { token } = useAuthStore();

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-bold text-gray-900 dark:text-gray-100">Cashiers</h1>
      <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
        Give beverage-redemption staff their own login, then share one of your
        events&apos; codes with them from that event&apos;s row.
      </p>
      <Card className="border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950/50">
        <CardContent className="p-5">
          <EventCashierManager token={token || ""} />
        </CardContent>
      </Card>
    </div>
  );
}
