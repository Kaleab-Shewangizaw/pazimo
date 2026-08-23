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
import { Popcorn, Clock, Trash2, TrendingUp, Plus } from "lucide-react";

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

  const [form, setForm] = useState({
    beverage: "",
    price: "",
    stockTotal: "",
    unlimitedStock: false,
  });

  // Creating a product this cinema sells that the platform catalogue lacks.
  //
  // Separate from `form` above, which prices an EXISTING product onto this
  // cinema's counter. The two are different actions — "what is this thing" and
  // "what do I charge for it" — and sharing one form would make the picker's
  // meaning depend on whether another field was filled in.
  const [newProduct, setNewProduct] = useState({ name: "", category: "snack" });
  const [creating, setCreating] = useState(false);
  const [showNewProduct, setShowNewProduct] = useState(false);

  const createProduct = async () => {
    setCreating(true);
    try {
      const body = new FormData();
      body.append("name", newProduct.name.trim());
      body.append("category", newProduct.category);

      const res = await cinemaRequest<{ data: CinemaCatalogItem }>(
        "/api/cinemas/me/concessions/products",
        token,
        { method: "POST", body }
      );
      toast.success(`${newProduct.name.trim()} added to your products`);
      setNewProduct({ name: "", category: "snack" });
      setShowNewProduct(false);
      await reload();
      // Selected straight away, because the only reason to create a product is
      // to put it on the counter — making the operator find it again in a list
      // they just added to is a pointless second step.
      setForm((f) => ({ ...f, beverage: res.data._id }));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const deleteProduct = async (productId: string, name: string) => {
    try {
      const res = await cinemaRequest<{ message?: string }>(
        `/api/cinemas/me/concessions/products/${productId}`,
        token,
        { method: "DELETE" }
      );
      toast.success(res.message || `${name} removed`);
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const addItem = async () => {
    setBusy(true);
    try {
      await cinemaRequest("/api/cinemas/me/concessions", token, {
        method: "POST",
        body: JSON.stringify({
          beverage: form.beverage,
          price: Number(form.price),
          unlimitedStock: form.unlimitedStock,
          // Omitted entirely on an unlimited line: the server ignores it, and
          // sending a number that means nothing invites a later reader to trust
          // it.
          ...(form.unlimitedStock ? {} : { stockTotal: Number(form.stockTotal) }),
        }),
      });
      toast.success("Added to line-up");
      setForm({ beverage: "", price: "", stockTotal: "", unlimitedStock: false });
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
                Pick a product and set your price — it applies only at this
                cinema. If what you sell isn&apos;t listed, add it yourself.
              </p>

              {/* The way out of "it's not in the list".
                  Placed with the picker rather than on a separate screen: the
                  moment an operator discovers the catalogue is missing their
                  brand of crisps is the moment they are looking at this select,
                  and sending them elsewhere to come back is how a counter ends
                  up ringing everything up as "Popcorn". */}
              {!showNewProduct ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowNewProduct(true)}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Add a product that isn&apos;t listed
                </Button>
              ) : (
                <div className="space-y-3 rounded-lg border border-dashed border-indigo-300 bg-indigo-50/50 p-4 dark:border-indigo-800 dark:bg-indigo-950/20">
                  <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    New product for this cinema
                  </p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="sm:col-span-2">
                      <Label className="text-xs">Name</Label>
                      <Input
                        autoFocus
                        value={newProduct.name}
                        placeholder="Coke, Pepsi, Water, Popcorn…"
                        onChange={(e) =>
                          setNewProduct({ ...newProduct, name: e.target.value })
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && newProduct.name.trim()) createProduct();
                        }}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Kind</Label>
                      <select
                        className={selectClass}
                        value={newProduct.category}
                        onChange={(e) =>
                          setNewProduct({ ...newProduct, category: e.target.value })
                        }
                      >
                        <option value="drink">Drink</option>
                        <option value="snack">Snack</option>
                        <option value="combo">Combo</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={creating || !newProduct.name.trim()}
                      onClick={createProduct}
                    >
                      {creating ? "Adding…" : "Create product"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setShowNewProduct(false);
                        setNewProduct({ name: "", category: "snack" });
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    Only this cinema sees it. You still set the price below.
                  </p>
                </div>
              )}
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
                        {c.isOwn ? " — yours" : ""}
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
                    disabled={form.unlimitedStock}
                    placeholder={form.unlimitedStock ? "Not counted" : ""}
                    onChange={(e) =>
                      setForm({ ...form, stockTotal: e.target.value })
                    }
                  />
                </div>
              </div>
              {/* A stand runs out of cups, not of fountain soda. Retyping 9999
                  every morning is a chore that eventually gets forgotten and
                  closes the till mid-rush. */}
              <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                <input
                  type="checkbox"
                  checked={form.unlimitedStock}
                  onChange={(e) =>
                    setForm({ ...form, unlimitedStock: e.target.checked })
                  }
                  className="h-3.5 w-3.5 rounded border-gray-300"
                />
                Unlimited — don&apos;t count stock for this one
              </label>
              <Button
                onClick={addItem}
                disabled={
                  busy ||
                  !form.beverage ||
                  !form.price ||
                  (!form.unlimitedStock && !form.stockTotal)
                }
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
                    // An unlimited line reports stockRemaining as null and is
                    // always sellable; a counted one needs stock left.
                    .filter(
                      (l) =>
                        l.isAvailable &&
                        (l.stockRemaining === null || l.stockRemaining > 0)
                    )
                    .map((l) => (
                      <option key={l._id} value={l._id}>
                        {l.beverage?.name} — {money(l.price)} (
                        {l.stockRemaining === null
                          ? "unlimited"
                          : `${l.stockRemaining} left`}
                        )
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
                      {money(l.price)} · {l.sold} sold ·{" "}
                      {l.stockRemaining === null
                        ? "unlimited stock"
                        : `${l.stockRemaining} left`}
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

          {/* Products this cinema created.
              Listed separately from the line-up above, because they are a
              different thing: the line-up is what is ON SALE and at what price,
              this is what EXISTS. A product created and not yet priced would
              otherwise be invisible — and, having no line-up row, impossible to
              remove. */}
          {catalog.some((c) => c.isOwn) && (
            <Card className="border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950/50">
              <CardContent className="space-y-3 p-5">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Products you added
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Only this cinema sees these. Removing one that has never sold
                  deletes it; one that has sold is retired instead, so your past
                  sales keep their record.
                </p>
                <div className="space-y-2">
                  {catalog
                    .filter((c) => c.isOwn)
                    .map((c) => (
                      <div
                        key={c._id}
                        className="flex items-center justify-between gap-3 rounded-md border border-gray-200 px-3 py-2 dark:border-gray-800"
                      >
                        <span className="min-w-0 truncate text-sm">
                          {c.name}
                          <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                            {CATEGORY_LABEL[c.category] || c.category}
                            {c.inLineup ? " · on sale" : " · not priced yet"}
                          </span>
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteProduct(c._id, c.name)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}
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
