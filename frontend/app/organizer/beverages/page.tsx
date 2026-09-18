"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BeverageDashboard } from "@/components/beverages/beverage-dashboard";
import BeverageBalanceCard from "@/components/beverages/BeverageBalanceCard";
import { Beer, ArrowLeft } from "lucide-react";

export default function OrganizerBeveragesPage() {
  const router = useRouter();
  const { token } = useAuthStore();
  const [eligibility, setEligibility] = useState<"loading" | "eligible" | "not_eligible">(
    "loading"
  );

  useEffect(() => {
    if (!token) return;
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/beverages/organizer/eligibility`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) =>
        setEligibility(data?.data?.eligibility === "eligible" ? "eligible" : "not_eligible")
      )
      .catch(() => setEligibility("not_eligible"));
  }, [token]);

  if (eligibility === "loading") {
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

  if (eligibility === "not_eligible") {
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
        <Button variant="outline" className="mt-6" onClick={() => router.push("/organizer")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Beverage sales</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          What you&apos;ve sold across your events, how much stock is left, and your
          bar balance — withdrawn here, separately from ticket revenue.
        </p>
      </div>

      {/* Bar takings are withdrawn separately from ticket sales. */}
      <BeverageBalanceCard token={token} />
      <BeverageDashboard scope="organizer" token={token || ""} />
    </div>
  );
}
