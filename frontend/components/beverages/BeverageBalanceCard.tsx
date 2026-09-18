"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, Beer } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL;

const money = (n: number) =>
  `${(Number.isFinite(n) ? n : 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ETB`;

/**
 * A read-only glance at the bar balance, sitting above the sales dashboard.
 *
 * Requesting and tracking withdrawals happens on /organizer/beverages/withdrawals,
 * which has the room for history and status. This card exists so an organizer
 * looking at what sold also sees what it is worth to them, and has one click to
 * get to the money.
 */
export default function BeverageBalanceCard({ token }: { token: string | null }) {
  const [available, setAvailable] = useState(0);
  const [pending, setPending] = useState(0);
  const [withdrawn, setWithdrawn] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const res = await fetch(`${API}/api/beverages/finance/organizer`, {
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      const { data } = await res.json();
      setAvailable(data.availableBalance ?? 0);
      setPending(data.withdrawals?.pending ?? 0);
      setWithdrawn(data.withdrawals?.approved ?? 0);
    } catch {
      // Silent: the sales dashboard below still renders, and a failed balance
      // fetch should not bury the page in an error toast on every load.
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Card className="border border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-900/10 mb-6">
      <CardContent className="p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
            <Beer className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Bar balance available
            </p>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
              {loading ? "—" : money(available)}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {loading
                ? " "
                : `${money(pending)} pending · ${money(withdrawn)} already withdrawn · separate from ticket sales`}
            </p>
          </div>
        </div>
        <Button
          asChild
          className="bg-[#1a2d5a] hover:bg-[#1a2d5a]/90 text-white"
        >
          <Link href="/organizer/beverages/withdrawals">
            <ArrowUpRight className="h-4 w-4 mr-2" />
            Withdrawals
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
