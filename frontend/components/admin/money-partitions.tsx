"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, Clapperboard, Beer, Ticket, Store, Popcorn } from "lucide-react";
import { formatCompactMoney } from "@/lib/utils";

/**
 * The money, split by pool.
 *
 * REPLACES a single "Available Balance" tile that showed a NEGATIVE number,
 * because it subtracted payouts from every stream from ticket revenue alone.
 * The pools settle independently — a cinema selling out a screening does not
 * release popcorn money — so they are reported independently. A single figure
 * across them could only ever be a sum of things that are not interchangeable,
 * which is why the total row below is labelled as display-only.
 */

export interface MoneyPartition {
  key: string;
  label: string;
  ownerKind: string;
  stream: string;
  currency: string;
  grossRevenue: number;
  ownerRevenue: number;
  pazimoCommission: number;
  vatOnCommission: number;
  ownerVat: number;
  withdrawn: number;
  pendingWithdrawals: number;
  availableBalance: number;
  ownerCount: number;
  entryCount: number;
  lastEntryAt: string | null;
}

export interface PartitionsPayload {
  currency: string;
  partitions: MoneyPartition[];
  platform: { currency: string; commission: number; byStream: Record<string, number> };
  totals: Omit<MoneyPartition, "key" | "label" | "ownerKind" | "stream" | "currency" | "ownerCount" | "entryCount" | "lastEntryAt">;
  coverage: {
    backfilled: boolean;
    sourceRows: number;
    ledgerEntries: number;
    lastEntryAt: string | null;
    bySource: { name: string; rows: number }[];
  } | null;
}

const ICONS: Record<string, typeof Ticket> = {
  event_tickets: Ticket,
  event_beverages: Beer,
  venue_beverages: Store,
  cinema_tickets: Clapperboard,
  cinema_beverages: Popcorn,
};

// Each pool gets its own accent so the five cards are distinguishable at a
// glance rather than being five identical rectangles of numbers.
const ACCENTS: Record<string, { bar: string; icon: string; chip: string }> = {
  event_tickets: { bar: "border-l-blue-600", icon: "text-blue-600", chip: "bg-blue-50 dark:bg-blue-950/40" },
  event_beverages: { bar: "border-l-amber-600", icon: "text-amber-600", chip: "bg-amber-50 dark:bg-amber-950/40" },
  venue_beverages: { bar: "border-l-purple-600", icon: "text-purple-600", chip: "bg-purple-50 dark:bg-purple-950/40" },
  cinema_tickets: { bar: "border-l-rose-600", icon: "text-rose-600", chip: "bg-rose-50 dark:bg-rose-950/40" },
  cinema_beverages: { bar: "border-l-emerald-600", icon: "text-emerald-600", chip: "bg-emerald-50 dark:bg-emerald-950/40" },
};

const Row = ({ label, value, muted }: { label: string; value: string; muted?: boolean }) => (
  <div className="flex items-baseline justify-between gap-2">
    <span className="text-[11px] text-gray-500 dark:text-gray-400">{label}</span>
    <span
      className={`text-xs tabular-nums ${
        muted ? "text-gray-500 dark:text-gray-400" : "font-medium text-gray-900 dark:text-gray-100"
      }`}
    >
      {value}
    </span>
  </div>
);

export default function MoneyPartitions({
  currency,
  token,
  refreshKey = 0,
}: {
  currency: "ETB" | "USD";
  token: string | null;
  refreshKey?: number;
}) {
  const [data, setData] = useState<PartitionsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/admin/finance/partitions?currency=${currency}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!res.ok) throw new Error((await res.json())?.message || "Failed to load balances");
        const body = await res.json();
        if (!cancelled) setData(body.data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load balances");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    if (token) run();
    // Ignoring a stale response after the currency changes: without this a slow
    // ETB request can land after a fast USD one and overwrite it.
    return () => {
      cancelled = true;
    };
  }, [currency, token, refreshKey]);

  if (loading && !data) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {[...Array(5)].map((_, i) => (
          <Card key={i} className="border border-gray-200 dark:border-gray-700 animate-pulse">
            <CardContent className="p-4 space-y-3">
              <div className="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="h-6 w-28 bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="h-2 w-full bg-gray-100 dark:bg-gray-800 rounded" />
              <div className="h-2 w-2/3 bg-gray-100 dark:bg-gray-800 rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="mb-8 rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40 p-4 text-sm text-red-800 dark:text-red-300">
        Could not load the money breakdown: {error}
      </div>
    );
  }

  if (!data) return null;

  const stale = data.coverage && !data.coverage.backfilled;

  return (
    <div className="mb-8">
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Money by pool</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Each pool is settled on its own — a payout from one never draws on another.
          </p>
        </div>
        <span className="text-xs text-gray-500 dark:text-gray-400">{data.currency}</span>
      </div>

      {/* The guard. Without it an unbackfilled ledger would render five
          confident 0.00 cards, which is truthful about the ledger and a lie
          about the business. */}
      {stale && (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40 p-4">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
          <div className="text-sm text-amber-900 dark:text-amber-200">
            <p className="font-semibold">These balances are not populated yet.</p>
            <p className="mt-1 text-xs">
              The ledger holds no entries while {data.coverage?.sourceRows.toLocaleString()} sales exist
              in the source collections, so every figure below reads as zero. Run{" "}
              <code className="rounded bg-amber-100 dark:bg-amber-900/60 px-1 py-0.5">
                npm run ledger:backfill
              </code>{" "}
              on this database.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {data.partitions.map((p) => {
          const Icon = ICONS[p.key] ?? Ticket;
          const accent = ACCENTS[p.key] ?? ACCENTS.event_tickets;
          const idle = p.entryCount === 0;
          return (
            <Card
              key={p.key}
              className={`border border-gray-200 dark:border-gray-700 border-l-4 ${accent.bar} shadow-sm hover:shadow-md transition-shadow ${
                idle ? "opacity-70" : ""
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className={`rounded-md p-1.5 ${accent.chip}`}>
                    <Icon className={`h-4 w-4 ${accent.icon}`} />
                  </span>
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-200 leading-tight">
                    {p.label}
                  </p>
                </div>

                <p className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Available
                </p>
                <p
                  className={`text-xl font-bold tabular-nums mb-3 ${
                    p.availableBalance < 0
                      ? "text-red-600 dark:text-red-400"
                      : "text-gray-900 dark:text-white"
                  }`}
                >
                  {formatCompactMoney(p.availableBalance, p.currency)}
                </p>

                <div className="space-y-1 border-t border-gray-100 dark:border-gray-800 pt-2">
                  <Row label="Total revenue" value={formatCompactMoney(p.grossRevenue, p.currency)} />
                  <Row label="Seller earned" value={formatCompactMoney(p.ownerRevenue, p.currency)} />
                  <Row label="Withdrawn" value={formatCompactMoney(p.withdrawn, p.currency)} muted />
                  <Row label="Pending" value={formatCompactMoney(p.pendingWithdrawals, p.currency)} muted />
                  <Row
                    label="Pazimo took"
                    value={formatCompactMoney(p.pazimoCommission + p.vatOnCommission, p.currency)}
                    muted
                  />
                </div>

                <p className="mt-2 text-[10px] text-gray-400 dark:text-gray-500">
                  {idle
                    ? "No sales yet"
                    : `${p.ownerCount} ${p.ownerCount === 1 ? "seller" : "sellers"}`}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Totals. Display only — a withdrawal is always validated against ONE
          pool, because summing them is exactly what would let seat money fund a
          concession payout. */}
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/40 p-4">
        <div>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">Total revenue collected</p>
          <p className="text-base font-semibold tabular-nums text-gray-900 dark:text-white">
            {formatCompactMoney(data.totals.grossRevenue, data.currency)}
          </p>
        </div>
        <div>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">Withdrawn, all pools</p>
          <p className="text-base font-semibold tabular-nums text-gray-900 dark:text-white">
            {formatCompactMoney(data.totals.withdrawn, data.currency)}
          </p>
        </div>
        <div>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">Available, all pools</p>
          <p className="text-base font-semibold tabular-nums text-gray-900 dark:text-white">
            {formatCompactMoney(data.totals.availableBalance, data.currency)}
          </p>
        </div>
        <div>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            Pazimo commission earned
          </p>
          <p className="text-base font-semibold tabular-nums text-gray-900 dark:text-white">
            {formatCompactMoney(data.platform.commission, data.currency)}
          </p>
        </div>
      </div>
      <p className="mt-2 text-[11px] text-gray-400 dark:text-gray-500">
        Totals are for display. Every payout is checked against one pool on its own.
        Withheld VAT is excluded from commission earned — it is remitted, not revenue.
      </p>
    </div>
  );
}
