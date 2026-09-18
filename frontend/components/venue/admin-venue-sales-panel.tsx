"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { formatCompactMoney } from "@/lib/utils";
import { Store, Undo2, Package, Wallet } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL;

interface VenueFinanceRow {
  venueId: string;
  name: string;
  venueType?: string;
  city?: string;
  commissionPercent: number;
  coversVenueVat: boolean;
  totalCutPercent: number;
  salesCount: number;
  unitsSold: number;
  grossRevenue: number;
  venueNet: number;
  venueVat: number;
  pazimoCollected: number;
  pendingWithdrawals: number;
  approvedWithdrawals: number;
  availableBalance: number;
}

interface VenueSaleRow {
  _id: string;
  referenceNumber: string;
  salesContext: "VENUE";
  beverageName: string;
  unitPrice: number;
  quantity: number;
  totalAmount: number;
  currency: string;
  status: "confirmed" | "refunded";
  channel: "online" | "manual";
  customerName?: string;
  soldAt: string;
  venue?: { _id: string; name: string; venueType?: string; city?: string } | null;
}

interface FinanceTotals {
  grossRevenue: number;
  venueNet: number;
  pazimoCommission: number;
  vatOnCommission: number;
  venueVat: number;
  pazimoCollected: number;
  unitsSold: number;
  salesCount: number;
}

/**
 * Venue beverage sales, platform-wide.
 *
 * The venue-channel counterpart of BeverageEventsPanel. It reads the venue
 * ledger only (/api/venues/admin/*), so nothing an organizer earned at an event
 * can appear here and nothing here is folded into the event figures on the
 * other tabs — which is the whole point of the two channels being separate
 * collections rather than one table with a flag.
 *
 * Every sale row names the venue that generated it, so "which venue produced
 * this revenue?" is answerable straight off the feed.
 */
export default function AdminVenueSalesPanel({ token }: { token: string | null }) {
  const [totals, setTotals] = useState<FinanceTotals | null>(null);
  const [venues, setVenues] = useState<VenueFinanceRow[]>([]);
  const [sales, setSales] = useState<VenueSaleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refundTarget, setRefundTarget] = useState<VenueSaleRow | null>(null);
  const [refunding, setRefunding] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const headers = { Authorization: `Bearer ${token}` };
      const [financeRes, salesRes] = await Promise.all([
        fetch(`${API}/api/venues/admin/finance?limit=50`, { headers }),
        fetch(`${API}/api/venues/admin/sales?limit=25`, { headers }),
      ]);
      const finance = await financeRes.json();
      const salesData = await salesRes.json();

      if (!financeRes.ok || !finance.success) {
        throw new Error(finance.message || "Failed to load venue finance");
      }
      if (!salesRes.ok || !salesData.success) {
        throw new Error(salesData.message || "Failed to load venue sales");
      }

      setTotals(finance.data.totals);
      setVenues(finance.data.venues || []);
      setSales(salesData.data || []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load venue sales");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRefund = async () => {
    if (!refundTarget) return;
    try {
      setRefunding(true);
      const res = await fetch(
        `${API}/api/venues/admin/sales/${refundTarget._id}/refund`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ reason: "Refunded by admin" }),
        }
      );
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Refund failed");
      toast.success("Sale refunded and stock returned");
      setRefundTarget(null);
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Refund failed");
    } finally {
      setRefunding(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const stats = [
    {
      label: "Venue bar takings",
      value: formatCompactMoney(totals?.grossRevenue || 0, "ETB"),
      hint: `${totals?.salesCount || 0} sales · ${totals?.unitsSold || 0} units`,
      icon: Store,
    },
    {
      label: "Owed to venues",
      value: formatCompactMoney(totals?.venueNet || 0, "ETB"),
      hint: "after commission, VAT and withholding",
      icon: Wallet,
    },
    {
      label: "Pazimo collected",
      value: formatCompactMoney(totals?.pazimoCollected || 0, "ETB"),
      hint: "commission + VAT + withheld venue VAT",
      icon: Package,
    },
    {
      label: "Withheld venue VAT",
      value: formatCompactMoney(totals?.venueVat || 0, "ETB"),
      // Stated apart from "collected" on purpose: it is a liability remitted to
      // the government, never Pazimo revenue.
      hint: "owed to government, not revenue",
      icon: Package,
    },
  ];

  return (
    <div className="space-y-6">
      <p className="flex items-start gap-2 rounded-lg bg-blue-50 p-3 text-sm text-blue-800 dark:bg-blue-950/30 dark:text-blue-300">
        <Store className="mt-0.5 h-4 w-4 shrink-0" />
        Venue sales only. Drinks sold at events are a separate pool and appear on
        the Dashboard and Events tabs — the two are never combined.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ label, value, hint, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500">
                <Icon className="h-3.5 w-3.5" />
                {label}
              </div>
              <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">
                {value}
              </p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Per venue: what each took, what it is owed, and what it can draw. */}
      <Card>
        <CardContent className="p-0">
          <div className="border-b border-gray-100 px-4 py-3 dark:border-gray-800">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">By venue</h3>
          </div>
          {venues.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
              No venue has sold anything yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Venue</TableHead>
                    <TableHead className="text-right">Sales</TableHead>
                    <TableHead className="text-right">Gross</TableHead>
                    <TableHead className="text-right">Venue net</TableHead>
                    <TableHead className="text-right">Pazimo</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead className="text-right">Cut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {venues.map((venue) => (
                    <TableRow key={venue.venueId}>
                      <TableCell>
                        <div className="font-medium text-gray-900 dark:text-gray-100">
                          {venue.name}
                        </div>
                        <div className="text-xs capitalize text-gray-500 dark:text-gray-400">
                          {[venue.venueType, venue.city].filter(Boolean).join(" · ")}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{venue.salesCount}</TableCell>
                      <TableCell className="text-right">
                        {formatCompactMoney(venue.grossRevenue, "ETB")}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCompactMoney(venue.venueNet, "ETB")}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCompactMoney(venue.pazimoCollected, "ETB")}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCompactMoney(venue.availableBalance, "ETB")}
                        {venue.pendingWithdrawals > 0 && (
                          <div className="text-xs text-amber-600 dark:text-amber-400">
                            {formatCompactMoney(venue.pendingWithdrawals, "ETB")} pending
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-gray-900 dark:text-gray-100">
                          {venue.totalCutPercent}%
                        </span>
                        {venue.coversVenueVat && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            VAT covered
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* The raw feed. Each row names its venue, so a sale is always traceable
          to the business that generated it. */}
      <Card>
        <CardContent className="p-0">
          <div className="border-b border-gray-100 px-4 py-3 dark:border-gray-800">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Recent venue sales</h3>
          </div>
          {sales.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
              No venue sales recorded yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reference</TableHead>
                    <TableHead>Venue</TableHead>
                    <TableHead>Drink</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sales.map((sale) => (
                    <TableRow key={sale._id}>
                      <TableCell className="font-mono text-xs">
                        {sale.referenceNumber}
                      </TableCell>
                      <TableCell className="font-medium text-gray-900 dark:text-gray-100">
                        {sale.venue?.name || "Deleted venue"}
                      </TableCell>
                      <TableCell>
                        {sale.beverageName}
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(sale.soldAt).toLocaleDateString()} · {sale.channel}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{sale.quantity}</TableCell>
                      <TableCell className="text-right">
                        {formatCompactMoney(sale.totalAmount, sale.currency)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            sale.status === "confirmed"
                              ? "bg-emerald-500 text-white"
                              : "bg-gray-400 text-white"
                          }
                        >
                          {sale.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {sale.status === "confirmed" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setRefundTarget(sale)}
                          >
                            <Undo2 className="mr-1 h-3.5 w-3.5" /> Refund
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={refundTarget !== null}
        onOpenChange={(open) => !open && setRefundTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Refund {refundTarget?.referenceNumber}?</AlertDialogTitle>
            <AlertDialogDescription>
              {refundTarget?.quantity}× {refundTarget?.beverageName} at{" "}
              {refundTarget?.venue?.name}. The sale stays in the ledger as history,
              comes out of the venue&apos;s revenue, and the stock goes back.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRefund}
              disabled={refunding}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {refunding ? "Refunding..." : "Refund"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
