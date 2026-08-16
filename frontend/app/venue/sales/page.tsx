"use client";

import { useEffect, useState } from "react";
import { VenueGate } from "@/components/venue/venue-gate";
import { venueRequest, type VenueSale } from "@/lib/venue-api";
import { formatCompactMoney } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Receipt, RotateCcw } from "lucide-react";

interface SalesResponse {
  data: VenueSale[];
  pagination: { total: number; page: number; pages: number };
}

function VenueSalesContent({ venue, token }: { venue: { _id: string; name: string }; token: string }) {
  const [sales, setSales] = useState<VenueSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("all");
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1 });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams({ page: String(page), limit: "12", status });
        const res = await venueRequest<{ data: SalesResponse }>(`/api/venues/${venue._id}/sales?${params}`, token);
        if (cancelled) return;
        setSales(res.data.data);
        setPagination(res.data.pagination);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load().catch(() => setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [page, status, token, venue._id]);

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Sales</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Confirmed drink sales recorded for {venue.name}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={status} onValueChange={(value) => { setStatus(value); setPage(1); }}>
            <SelectTrigger className="w-[170px]"><SelectValue placeholder="Filter status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sales</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="refunded">Refunded</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => { setStatus("all"); setPage(1); }}>
            <RotateCcw className="mr-2 h-4 w-4" /> Reset
          </Button>
        </div>
      </div>

      <Card className="border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950/50">
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-5">
              <Skeleton className="h-10 rounded-xl" />
              <Skeleton className="h-10 rounded-xl" />
              <Skeleton className="h-10 rounded-xl" />
            </div>
          ) : sales.length === 0 ? (
            <div className="px-5 py-16 text-center text-sm text-gray-500 dark:text-gray-400">
              <Receipt className="mx-auto mb-2 h-6 w-6" />
              No sales match this filter yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:text-gray-400">
                    <th className="px-5 py-3">Drink</th>
                    <th className="px-5 py-3">Customer</th>
                    <th className="px-5 py-3 text-right">Quantity</th>
                    <th className="px-5 py-3 text-right">Amount</th>
                    <th className="px-5 py-3 text-right">Status</th>
                    <th className="px-5 py-3 text-right">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((sale) => (
                    <tr key={sale._id} className="border-b border-gray-100 last:border-0 dark:border-gray-800">
                      <td className="px-5 py-3 font-medium text-gray-900 dark:text-gray-100">{sale.beverageName}</td>
                      <td className="px-5 py-3 text-gray-600 dark:text-gray-400">{sale.customerName || "Walk-in"}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-gray-600 dark:text-gray-400">{sale.quantity}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-gray-600 dark:text-gray-400">
                        {formatCompactMoney(sale.totalAmount, sale.currency)}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Badge variant={sale.status === "confirmed" ? "secondary" : "outline"}>{sale.status}</Badge>
                      </td>
                      <td className="px-5 py-3 text-right text-gray-500 dark:text-gray-400">
                        {new Date(sale.soldAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-4 flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
        <span>
          {pagination.total.toLocaleString()} sale{pagination.total === 1 ? "" : "s"}
        </span>
        <div className="flex items-center gap-2">
          <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            Previous
          </Button>
          <span>
            Page {pagination.page} of {pagination.pages}
          </span>
          <Button variant="outline" disabled={page >= pagination.pages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function VenueSalesPage() {
  return <VenueGate>{(venue, token) => <VenueSalesContent venue={venue} token={token} />}</VenueGate>;
}