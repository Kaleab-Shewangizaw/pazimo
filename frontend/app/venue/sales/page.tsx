"use client";

import { useEffect, useState } from "react";
import { VenueGate } from "@/components/venue/venue-gate";
import { venueRequest, type VenueSale, type VenueOutstandingItem } from "@/lib/venue-api";
import { formatCompactMoney } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Martini, Receipt, RotateCcw, Search } from "lucide-react";
import { toast } from "sonner";

/**
 * Look up an order by the reference the customer shows at the counter (a
 * venue purchase has no standing ticket to scan, unlike an event), and hand
 * its drinks over one at a time.
 */
function CollectOrderCard({ venue, token }: { venue: { _id: string; name: string }; token: string }) {
  const [reference, setReference] = useState("");
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<VenueOutstandingItem[] | null>(null);
  const [collectingId, setCollectingId] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const lookup = async () => {
    const ref = reference.trim();
    if (!ref) return;
    setLoading(true);
    setSearched(true);
    try {
      const res = await venueRequest<{ data: VenueOutstandingItem[] }>(
        `/api/venues/${venue._id}/sales/outstanding/${encodeURIComponent(ref)}`,
        token
      );
      setItems(res.data);
    } catch (e: any) {
      toast.error(e.message || "Could not look up that order");
      setItems(null);
    } finally {
      setLoading(false);
    }
  };

  const collect = async (item: VenueOutstandingItem) => {
    setCollectingId(item._id);
    try {
      await venueRequest(`/api/venues/${venue._id}/sales/${item._id}/redeem`, token, {
        method: "POST",
      });
      setItems((current) => current?.filter((i) => i._id !== item._id) ?? null);
      toast.success(`${item.beverageName} handed over`);
    } catch (e: any) {
      toast.error(e.message || "Could not mark this as handed over");
    } finally {
      setCollectingId(null);
    }
  };

  return (
    <Card className="mb-6 border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950/50">
      <CardContent className="space-y-4 p-5">
        <div>
          <h2 className="flex items-center gap-2 font-semibold text-gray-900 dark:text-gray-100">
            <Martini className="h-4 w-4" /> Collect a drink
          </h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            A customer who paid through the app shows their order reference —
            look it up here and hand over what&apos;s still owed.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="Order reference (e.g. VBEV-…)"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && lookup()}
            className="max-w-xs"
          />
          <Button onClick={lookup} disabled={loading || !reference.trim()}>
            <Search className="mr-2 h-4 w-4" /> {loading ? "Looking up…" : "Look up"}
          </Button>
        </div>

        {searched && !loading && (
          items && items.length > 0 ? (
            <div className="space-y-2">
              {items.map((item) => (
                <div
                  key={item._id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm dark:border-amber-500/40 dark:bg-amber-500/10"
                >
                  <span className="text-amber-900 dark:text-amber-200">
                    {item.quantity} × {item.beverageName}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="rounded-full border-amber-400 text-amber-900 hover:bg-amber-100 dark:text-amber-200"
                    disabled={collectingId === item._id}
                    onClick={() => collect(item)}
                  >
                    {collectingId === item._id ? "Handing over…" : "Handed over"}
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Nothing outstanding on that reference.
            </p>
          )
        )}
      </CardContent>
    </Card>
  );
}

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

      <CollectOrderCard venue={venue} token={token} />

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