"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/authStore";
import { BeverageLineupManager } from "@/components/beverages/beverage-lineup-manager";
import { Beer, ArrowLeft } from "lucide-react";

export default function EventBeveragesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: eventId } = use(params);
  const router = useRouter();
  const { token } = useAuthStore();

  const [eventTitle, setEventTitle] = useState("");
  const [forbidden, setForbidden] = useState(false);

  if (forbidden) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-16 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/40">
          <Beer className="h-7 w-7 text-amber-600 dark:text-amber-400" />
        </div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Beverage selling isn&apos;t enabled for your account
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-gray-600 dark:text-gray-400">
          Pazimo approves organizers for beverage sales individually. Get in touch if you&apos;d
          like to sell drinks at your events.
        </p>
        <Button variant="outline" className="mt-6" onClick={() => router.push("/organizer/events")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to events
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <Button
        variant="ghost"
        className="mb-4 -ml-2"
        onClick={() => router.push("/organizer/events")}
      >
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to events
      </Button>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Beverage sales</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {eventTitle
            ? `Drinks you're selling at ${eventTitle}, and what guests pay for each.`
            : "Drinks you're selling at this event, and what guests pay for each."}
        </p>
      </div>

      <BeverageLineupManager
        token={token || ""}
        context={{ kind: "event", eventId, scope: "organizer" }}
        onForbidden={() => setForbidden(true)}
        onEventLoaded={(event) => setEventTitle(event.title)}
      />
    </div>
  );
}
