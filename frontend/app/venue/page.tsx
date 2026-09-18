"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { VenueGate } from "@/components/venue/venue-gate";
import { venueRequest, type VenueFinance, type VenueProfile, type VenueSale } from "@/lib/venue-api";
import { formatCompactMoney } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Beer, Clock3, MapPin, Receipt, Store, TrendingUp, Wallet } from "lucide-react";

interface VenueDashboardData {
  totals: {
    revenue: number;
    units: number;
    orders: number;
    averageOrderValue: number;
    stockTotal: number;
    stockSold: number;
    stockRemaining: number;
    sellThrough: number | null;
    potentialRevenue: number;
    venuesSelling: number;
    listings: number;
  };
  byBeverage: { _id: string; name: string; color?: string | null; revenue: number; units: number; venueCount: number }[];
  timeline: { date: string; revenue: number; units: number }[];
  recent: VenueSale[];
}

const StatCard = ({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Store;
  label: string;
  value: string;
  sub?: string;
}) => (
  <Card className="border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950/50">
    <CardContent className="p-5">
      <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
        <Icon className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{sub}</p>}
    </CardContent>
  </Card>
);

function VenueOverviewContent({ venue, token }: { venue: VenueProfile; token: string }) {
  const [dashboard, setDashboard] = useState<VenueDashboardData | null>(null);
  const [finance, setFinance] = useState<VenueFinance | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        const [dashboardRes, financeRes] = await Promise.all([
          venueRequest<{ data: VenueDashboardData }>(`/api/venues/${venue._id}/dashboard`, token),
          venueRequest<{ data: VenueFinance }>(`/api/venues/${venue._id}/finance`, token),
        ]);
        if (cancelled) return;
        setDashboard(dashboardRes.data);
        setFinance(financeRes.data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load().catch(() => setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [venue._id, token]);

  const totals = dashboard?.totals;
  const balance = finance?.availableBalance ?? 0;

  if (loading) {
    return (
      <div className="container mx-auto max-w-6xl px-4 py-8">
        <Skeleton className="mb-6 h-10 w-72" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-28 rounded-2xl" />
          ))}
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-80 rounded-2xl" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
            <Store className="h-3.5 w-3.5" />
            Venue dashboard
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            {venue.name}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-4 w-4" />
              {[venue.city, venue.address].filter(Boolean).join(" • ") || "Venue address not set"}
            </span>
            <Badge variant="outline" className="border-emerald-200 text-emerald-700 dark:border-emerald-900 dark:text-emerald-300">
              Live sales enabled
            </Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="border-amber-200 bg-white dark:border-amber-900 dark:bg-gray-950/50">
            <Link href="/venue/beverages">
              <Beer className="mr-2 h-4 w-4" />
              Manage drinks
            </Link>
          </Button>
          <Button asChild className="bg-amber-600 text-white hover:bg-amber-700">
            <Link href="/venue/withdrawals">
              <Wallet className="mr-2 h-4 w-4" />
              Withdraw balance
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={TrendingUp}
          label="Gross revenue"
          value={formatCompactMoney(totals?.revenue || 0, finance?.currency || "ETB")}
          sub={`${totals?.orders || 0} sales`}
        />
        <StatCard
          icon={Wallet}
          label="Available balance"
          value={formatCompactMoney(balance, finance?.currency || "ETB")}
          sub={`${formatCompactMoney(finance?.withdrawals.pending || 0, finance?.currency || "ETB")} pending`}
        />
        <StatCard
          icon={Beer}
          label="Units sold"
          value={String(totals?.units || 0)}
          sub={`${totals?.listings || 0} drinks listed`}
        />
        <StatCard
          icon={Receipt}
          label="Venue net"
          value={formatCompactMoney(finance?.totals.venueNet || 0, finance?.currency || "ETB")}
          sub={`${finance?.totals.salesCount || 0} confirmed sales`}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950/50">
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Top drinks</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">What is moving fastest on this venue&apos;s line-up.</p>
              </div>
              <Badge variant="secondary">{finance?.beverages.length || 0} drinks</Badge>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:text-gray-400">
                    <th className="py-2 pr-3">Drink</th>
                    <th className="py-2 pr-3 text-right">Sold</th>
                    <th className="py-2 pr-3 text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {(finance?.beverages || []).slice(0, 6).map((row) => (
                    <tr key={row.beverageId} className="border-b border-gray-100 last:border-0 dark:border-gray-800">
                      <td className="py-3 pr-3 font-medium text-gray-900 dark:text-gray-100">{row.name}</td>
                      <td className="py-3 pr-3 text-right tabular-nums text-gray-600 dark:text-gray-400">{row.unitsSold}</td>
                      <td className="py-3 pr-3 text-right tabular-nums text-gray-600 dark:text-gray-400">
                        {formatCompactMoney(row.grossRevenue, finance?.currency || "ETB")}
                      </td>
                    </tr>
                  ))}
                  {(finance?.beverages || []).length === 0 && (
                    <tr>
                      <td className="py-8 text-center text-sm text-gray-500 dark:text-gray-400" colSpan={3}>
                        No drinks have sold yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950/50">
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Recent sales</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">Latest confirmed drink sales at the bar.</p>
              </div>
              <Badge variant="secondary">{dashboard?.recent.length || 0} shown</Badge>
            </div>

            <div className="mt-4 space-y-3">
              {(dashboard?.recent || []).map((sale) => (
                <div key={sale._id} className="rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-800">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">{sale.beverageName}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {sale.referenceNumber} · {sale.channel === "manual" ? "Manual" : "Online"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900 dark:text-gray-100">
                        {formatCompactMoney(sale.totalAmount, sale.currency)}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{sale.quantity} sold</p>
                    </div>
                  </div>
                </div>
              ))}
              {(dashboard?.recent || []).length === 0 && (
                <div className="rounded-xl border border-dashed border-gray-300 px-4 py-10 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                  <Clock3 className="mx-auto mb-2 h-5 w-5" />
                  No sales recorded yet.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function VenueOverviewPage() {
  return <VenueGate>{(venue, token) => <VenueOverviewContent venue={venue} token={token} />}</VenueGate>;
}