"use client";

import { useCallback, useEffect, useState } from "react";
import { CinemaGate } from "@/components/cinema/cinema-gate";
import {
  cinemaRequest,
  fetchConcessionCatalog,
  fetchConcessionSales,
  fetchConcessionSummary,
  fetchConcessions,
  money,
  type CinemaCatalogItem,
  type CinemaConcession,
  type CinemaConcessionSale,
  type CinemaConcessionSummary,
  type CinemaProfile,
} from "@/lib/cinema-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Popcorn, Clock, Trash2, TrendingUp } from "lucide-react";

const CATEGORY_LABEL: Record<string, string> = {
  drink: "Drink",
  snack: "Snack",
  combo: "Combo",
};

function ConcessionsContent({
  cinema,
  token,
}: {
  cinema: CinemaProfile;
  token: string;
}) {
  const [lineup, setLineup] = useState<CinemaConcession[]>([]);
  const [catalog, setCatalog] = useState<CinemaCatalogItem[]>([]);
  const [sales, setSales] = useState<CinemaConcessionSale[]>([]);
  const [summary, setSummary] = useState<CinemaConcessionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const approved = cinema.beverageEligibility === "eligible";

  const reload = useCallback(async () => {
    const [l, c, s, sum] = await Promise.all([
      fetchConcessions(token),
      fetchConcessionCatalog(token),
      fetchConcessionSales(token),
      fetchConcessionSummary(token),
    ]);
    setLineup(l);
    setCatalog(c);
    setSales(s.data);
    setSummary(sum);
  }, [token]);

  useEffect(() => {
    if (!approved) {
      setLoading(false);
      return;
    }
    reload()
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [reload, approved]);

  const [form, setForm] = useState({ beverage: "", price: "", stockTotal: "" });

  const addItem = async () => {
    setBusy(true);
    try {
      await cinemaRequest("/api/cinemas/me/concessions", token, {
        method: "POST",
        body: JSON.stringify({
          beverage: form.beverage,
          price: Number(form.price),
          stockTotal: Number(form.stockTotal),
        }),
      });
      toast.success("Added to line-up");
      setForm({ beverage: "", price: "", stockTotal: "" });
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const removeItem = async (id: string) => {
    try {
      const res = await cinemaRequest<{ message?: string }>(
        `/api/cinemas/me/concessions/${id}`,
        token,
        { method: "DELETE" }
      );
      toast.success(res.message || "Removed");
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const [saleForm, setSaleForm] = useState({ cinemaBeverage: "", quantity: "1" });
  const recordSale = async () => {
    setBusy(true);
    try {
      await cinemaRequest("/api/cinemas/me/concession-sales", token, {
        method: "POST",
        body: JSON.stringify({
          cinemaBeverage: saleForm.cinemaBeverage,
          quantity: Number(saleForm.quantity),
        }),
      });
      toast.success("Sale recorded");
      setSaleForm({ cinemaBeverage: "", quantity: "1" });
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // Approval gates only this surface — a cinema still sells seats without it,
  // which is why the layout and the tickets page are not behind this check.
  if (!approved) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-16 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/40">
          <Clock className="h-7 w-7 text-amber-600 dark:text-amber-400" />
        </div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          {cinema.name} isn&apos;t approved to sell concessions yet
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-gray-600 dark:text-gray-400">
          {cinema.eligibilityNotes ||
            "Pazimo approves cinemas for concession sales individually. Your ticket sales are unaffected."}
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto max-w-6xl px-4 py-8">
        <Skeleton className="mb-6 h-9 w-64" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const selectClass =
    "h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm dark:border-gray-700 dark:bg-gray-900";
  const available = catalog.filter((c) => !c.inLineup);

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-gray-100">
        Concessions
      </h1>

      <Tabs defaultValue="lineup" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 bg-gray-100 p-1 dark:bg-gray-900/70 sm:w-[340px]">
          <TabsTrigger value="lineup">Line-up</TabsTrigger>
          <TabsTrigger value="sales">Sales</TabsTrigger>
        </TabsList>

        <TabsContent value="lineup" className="space-y-6">
          <Card className="border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950/50">
            <CardContent className="space-y-4 p-5">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                <Popcorn className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                Add a product
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Products come from Pazimo&apos;s catalogue; the price is yours and
                applies only at this cinema.
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <Label className="text-xs">Product</Label>
                  <select
                    className={selectClass}
                    value={form.beverage}
                    onChange={(e) => setForm({ ...form, beverage: e.target.value })}
                  >
                    <option value="">Select…</option>
                    {available.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name} ({CATEGORY_LABEL[c.category] || c.category})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Your price (ETB)</Label>
                  <Input
                    type="number"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Stock</Label>
                  <Input
                    type="number"
                    value={form.stockTotal}
                    onChange={(e) =>
                      setForm({ ...form, stockTotal: e.target.value })
                    }
                  />
                </div>
              </div>
              <Button
                onClick={addItem}
                disabled={busy || !form.beverage || !form.price}
              >
                Add to line-up
              </Button>
            </CardContent>
          </Card>

          <Card className="border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950/50">
            <CardContent className="space-y-4 p-5">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Record a counter sale
              </h2>
              <div className="grid gap-3 sm:grid-cols-[2fr_1fr_auto]">
                <select
                  className={selectClass}
                  value={saleForm.cinemaBeverage}
                  onChange={(e) =>
                    setSaleForm({ ...saleForm, cinemaBeverage: e.target.value })
                  }
                >
                  <option value="">Select a product…</option>
                  {lineup
                    .filter((l) => l.isAvailable && l.stockRemaining > 0)
                    .map((l) => (
                      <option key={l._id} value={l._id}>
                        {l.beverage?.name} — {money(l.price)} ({l.stockRemaining}{" "}
                        left)
                      </option>
                    ))}
                </select>
                <Input
                  type="number"
                  min={1}
                  value={saleForm.quantity}
                  onChange={(e) =>
                    setSaleForm({ ...saleForm, quantity: e.target.value })
                  }
                />
                <Button
                  onClick={recordSale}
                  disabled={busy || !saleForm.cinemaBeverage}
                >
                  Record
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {lineup.map((l) => (
              <Card
                key={l._id}
                className="border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950/50"
              >
                <CardContent className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-gray-900 dark:text-gray-100">
                      {l.beverage?.name}{" "}
                      <Badge variant="outline" className="ml-1">
                        {CATEGORY_LABEL[l.beverage?.category] ||
                          l.beverage?.category}
                      </Badge>
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {money(l.price)} · {l.sold} sold · {l.stockRemaining} left
                      {!l.isAvailable && " · off sale"}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => removeItem(l._id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="sales" className="space-y-6">
          {/* How much has actually been sold. The table below is every
              individual sale; this is the same money totalled, and split per
              product so it is clear WHAT sells rather than only how much. */}
          {/* Guarded on the field actually read, not just on `summary` being
              truthy. A malformed response previously satisfied `summary &&` and
              then threw on `.revenue.grossRevenue`, which the error boundary
              turned into a blank page — so a cinema could not manage its
              line-up or see a single sale because one tile failed. A hidden
              panel is the right failure here, not a dead page. */}
          {summary?.revenue && (
            <>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                {[
                  {
                    label: "Sold, all time",
                    value: money(summary.revenue.grossRevenue),
                    hint: `${summary.revenue.salesCount} ${summary.revenue.salesCount === 1 ? "sale" : "sales"}`,
                  },
                  {
                    label: "Items sold",
                    value: summary.revenue.unitsSold.toLocaleString(),
                    hint: "units across every product",
                  },
                  {
                    label: "You keep",
                    value: money(summary.revenue.cinemaRevenue),
                    hint: "after Pazimo's fee and VAT",
                  },
                  {
                    label: "Pazimo's fee",
                    value: money(
                      summary.revenue.pazimoCommission + summary.revenue.vatOnCommission
                    ),
                    hint: "commission plus VAT on it",
                  },
                ].map((tile) => (
                  <Card
                    key={tile.label}
                    className="border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950/50"
                  >
                    <CardContent className="p-4">
                      <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        {tile.label}
                      </p>
                      <p className="mt-1 text-xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
                        {tile.value}
                      </p>
                      <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                        {tile.hint}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {summary.byProduct?.length > 0 && (
                <Card className="border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950/50">
                  <CardContent className="space-y-3 p-5">
                    <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                      <TrendingUp className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                      What sells
                    </h2>
                    <div className="space-y-2">
                      {summary.byProduct.map((product) => {
                        // Bar width is relative to the best seller, so the
                        // comparison is between products rather than against an
                        // arbitrary scale.
                        const top = summary.byProduct[0]?.grossRevenue || 1;
                        const width = Math.max(2, (product.grossRevenue / top) * 100);
                        return (
                          <div key={product._id}>
                            <div className="flex items-baseline justify-between gap-3 text-sm">
                              <span className="truncate text-gray-800 dark:text-gray-200">
                                {product.name}
                                <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                                  {CATEGORY_LABEL[product.category] ?? product.category}
                                </span>
                              </span>
                              <span className="shrink-0 tabular-nums text-gray-600 dark:text-gray-300">
                                {product.unitsSold} × &nbsp;
                                <span className="font-medium text-gray-900 dark:text-gray-100">
                                  {money(product.grossRevenue)}
                                </span>
                              </span>
                            </div>
                            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                              <div
                                className="h-full rounded-full bg-indigo-500"
                                style={{ width: `${width}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          <Card className="border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950/50">
            <CardContent className="p-5">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:text-gray-400">
                      <th className="py-2 pr-4">Reference</th>
                      <th className="py-2 pr-4">Product</th>
                      <th className="py-2 pr-4 text-right">Qty</th>
                      <th className="py-2 pr-4 text-right">Amount</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2">Sold</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sales.length === 0 && (
                      <tr>
                        <td
                          colSpan={6}
                          className="py-6 text-center text-gray-500 dark:text-gray-400"
                        >
                          No concession sales yet.
                        </td>
                      </tr>
                    )}
                    {sales.map((s) => (
                      <tr
                        key={s._id}
                        className="border-b border-gray-100 dark:border-gray-800/60"
                      >
                        <td className="py-2 pr-4 font-mono text-xs">
                          {s.referenceNumber}
                        </td>
                        <td className="py-2 pr-4">{s.beverageName}</td>
                        <td className="py-2 pr-4 text-right tabular-nums">
                          {s.quantity}
                        </td>
                        <td className="py-2 pr-4 text-right tabular-nums">
                          {money(s.totalAmount, s.currency)}
                        </td>
                        <td className="py-2 pr-4">
                          <Badge
                            variant={
                              s.status === "refunded" ? "secondary" : "default"
                            }
                          >
                            {s.status}
                          </Badge>
                        </td>
                        <td className="py-2 text-xs text-gray-500 dark:text-gray-400">
                          {new Date(s.soldAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function CinemaConcessionsPage() {
  return (
    <CinemaGate>
      {(cinema, token) => <ConcessionsContent cinema={cinema} token={token} />}
    </CinemaGate>
  );
}
