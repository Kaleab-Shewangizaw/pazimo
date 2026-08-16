"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Beer, Plus, Pencil, Trash2, Power, AlertTriangle } from "lucide-react";
import { getBeverageColorVars } from "@/lib/beverage-color";

export interface CatalogBeverage {
  _id: string;
  name: string;
  image?: string | null;
  color?: string | null;
}

export interface LineupRow {
  _id: string;
  price: number;
  currency: string;
  isAvailable: boolean;
  stockTotal: number;
  sold: number;
  remaining: number;
  beverage: CatalogBeverage & { isActive: boolean };
  // Set by the API when a drink is no longer sellable — paused centrally,
  // blocked for this organizer, or deleted from the catalogue.
  unavailableReason: "inactive" | "blocked" | "removed" | null;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export const buildBeverageImageUrl = (image?: string | null) =>
  image ? `${API_URL}${image}` : null;

const UNAVAILABLE_COPY: Record<string, string> = {
  inactive: "Pazimo has paused this drink. It won't be sold until it returns.",
  blocked: "This seller is no longer approved to sell this drink.",
  removed: "This drink was removed from the Pazimo catalogue.",
};

/**
 * Which sales channel this manager is editing.
 *
 * An event line-up and a venue line-up are the same interaction — pick from the
 * catalogue, set a price, set stock, stop selling — against different owners.
 * One component serves both rather than a near-copy per channel, because a copy
 * is where the two would silently drift apart on validation and on the
 * stop-selling-vs-delete rule that protects the ledger.
 *
 * Only the endpoints and the noun differ, and both live in this table.
 */
type ChannelContext =
  | { kind: "event"; eventId: string; scope: "admin" | "organizer" }
  | { kind: "venue"; venueId: string; scope: "admin" | "venue" };

const CHANNEL_COPY = {
  event: { place: "this event", placeCap: "This event", owner: "organizer" },
  venue: { place: "this venue", placeCap: "This venue", owner: "venue" },
} as const;

interface BeverageLineupManagerProps {
  token: string;
  // Which surface is mounting this. Chooses the API prefix, and admins get
  // wording that refers to the owner in the third person.
  context: ChannelContext;
  onForbidden?: () => void;
  onEventLoaded?: (event: { title: string }) => void;
}

export function BeverageLineupManager({
  token,
  context,
  onForbidden,
  onEventLoaded,
}: BeverageLineupManagerProps) {
  const isAdmin = context.scope === "admin";
  const copy = CHANNEL_COPY[context.kind];

  // Admins pick from the drinks this owner is allowed to sell, which is not the
  // same list as the raw catalogue — the deny list is applied server-side.
  const lineupUrl =
    context.kind === "venue"
      ? `${API_URL}/api/venues/${context.venueId}/beverages`
      : `${API_URL}/api/beverages/${context.scope}/events/${context.eventId}/beverages`;
  const catalogUrl =
    context.kind === "venue"
      ? `${API_URL}/api/venues/${context.venueId}/catalog`
      : isAdmin
      ? `${API_URL}/api/beverages/admin/events/${context.eventId}/catalog`
      : `${API_URL}/api/beverages/organizer/catalog`;

  const [rows, setRows] = useState<LineupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [eligibility, setEligibility] = useState<string>("eligible");

  const [catalog, setCatalog] = useState<CatalogBeverage[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [addBeverageId, setAddBeverageId] = useState("");
  const [addPrice, setAddPrice] = useState("");
  const [addStock, setAddStock] = useState("");
  const [saving, setSaving] = useState(false);

  const [editRow, setEditRow] = useState<LineupRow | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const [editStock, setEditStock] = useState("");
  const [removeTarget, setRemoveTarget] = useState<LineupRow | null>(null);
  const [busyRow, setBusyRow] = useState<string | null>(null);

  const fetchLineup = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const res = await fetch(lineupUrl, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();

      // 403 is the eligibility gate rather than a failure worth shouting about;
      // the host page decides how to explain it.
      if (res.status === 403) {
        onForbidden?.();
        return;
      }
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to load beverages");

      setRows(data.data);
      // The two channels name this after their owner; either means the same
      // thing — may this seller list drinks at all?
      setEligibility(data.venueEligibility || data.organizerEligibility || "eligible");
      if (data.event) onEventLoaded?.(data.event);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load beverages");
    } finally {
      setLoading(false);
    }
    // onForbidden/onEventLoaded are host callbacks; re-running on their identity
    // would refetch on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineupUrl, token]);

  useEffect(() => {
    fetchLineup();
  }, [fetchLineup]);

  const request = async (url: string, method: string, body?: Record<string, unknown>) => {
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || "Something went wrong");
    return data;
  };

  const openAdd = async () => {
    setAddBeverageId("");
    setAddPrice("");
    setAddStock("");
    setAddOpen(true);
    try {
      const data = await request(catalogUrl, "GET");
      setCatalog(data.data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load the catalogue");
    }
  };

  const handleAdd = async () => {
    if (!addBeverageId) {
      toast.error("Pick a drink to add");
      return;
    }
    if (!(Number(addPrice) > 0)) {
      toast.error("Enter a price greater than 0");
      return;
    }
    if (!Number.isInteger(Number(addStock)) || Number(addStock) < 1) {
      toast.error("Enter how many bottles are for sale");
      return;
    }
    try {
      setSaving(true);
      await request(lineupUrl, "POST", {
        beverageId: addBeverageId,
        price: addPrice,
        stockTotal: addStock,
      });
      toast.success(`Drink added to ${copy.place}`);
      setAddOpen(false);
      fetchLineup();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add the drink");
    } finally {
      setSaving(false);
    }
  };

  const handleReprice = async () => {
    if (!editRow) return;
    if (!(Number(editPrice) > 0)) {
      toast.error("Enter a price greater than 0");
      return;
    }
    if (!Number.isInteger(Number(editStock)) || Number(editStock) < 1) {
      toast.error("Enter how many bottles are for sale");
      return;
    }
    // Caught here as well as on the server so the message names the number the
    // organizer is actually up against.
    if (Number(editStock) < editRow.sold) {
      toast.error(`${editRow.sold} already sold — stock can't go below that`);
      return;
    }
    try {
      setSaving(true);
      await request(`${lineupUrl}/${editRow._id}`, "PATCH", {
        price: editPrice,
        stockTotal: editStock,
      });
      toast.success("Drink updated");
      setEditRow(null);
      fetchLineup();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update the price");
    } finally {
      setSaving(false);
    }
  };

  const toggleAvailability = async (row: LineupRow) => {
    try {
      setBusyRow(row._id);
      await request(`${lineupUrl}/${row._id}`, "PATCH", { isAvailable: !row.isAvailable });
      toast.success(row.isAvailable ? "Stopped selling this drink" : "Selling this drink again");
      fetchLineup();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update the drink");
    } finally {
      setBusyRow(null);
    }
  };

  const handleRemove = async () => {
    if (!removeTarget) return;
    try {
      setBusyRow(removeTarget._id);
      await request(`${lineupUrl}/${removeTarget._id}`, "DELETE");
      toast.success(`Drink removed from ${copy.place}`);
      setRemoveTarget(null);
      fetchLineup();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove the drink");
    } finally {
      setBusyRow(null);
    }
  };

  // Already-added drinks are filtered out of the picker rather than offered and
  // then rejected on submit.
  const addable = catalog.filter(
    (beverage) => !rows.some((row) => row.beverage?._id === beverage._id)
  );
  const notApproved = eligibility !== "eligible";

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700">
            <Skeleton className="aspect-square rounded-none" />
            <div className="p-4">
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isAdmin && notApproved && (
        <p className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          This {copy.owner} isn&apos;t approved to sell beverages, so no new drinks can be added.
          You can still edit or remove what&apos;s already here.
        </p>
      )}

      <div className="flex justify-end">
        <Button
          type="button"
          onClick={openAdd}
          disabled={notApproved}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Plus className="mr-2 h-4 w-4" /> Add a drink
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 px-6 py-12 text-center dark:border-gray-700">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/40">
            <Beer className="h-6 w-6 text-amber-600 dark:text-amber-400" />
          </div>
          <p className="font-semibold text-gray-900 dark:text-gray-100">
            No drinks on {copy.place}
          </p>
          <p className="mt-1 max-w-sm text-sm text-gray-600 dark:text-gray-400">
            {isAdmin
              ? "Nothing is being sold here yet."
              : context.kind === "venue"
              ? "Add a drink and set your price. This is what customers pay at your bar."
              : "Add a drink and set your price. Guests buy ahead of the event, so price below what they'd pay at the door."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((row) => {
            const stoppedCentrally = row.unavailableReason !== null;
            const selling = row.isAvailable && !stoppedCentrally;
            return (
              <div
                key={row._id}
                style={getBeverageColorVars(row.beverage?.color)}
                className="flex flex-col overflow-hidden rounded-2xl border border-[var(--bev-border)] bg-white shadow-sm dark:border-[var(--bev-border-dark)] dark:bg-gray-900"
              >
                <div className="relative aspect-square shrink-0 overflow-hidden bg-gradient-to-b from-[var(--bev-panel)] to-[var(--bev-panel-2)] dark:from-[var(--bev-panel-dark)] dark:to-[var(--bev-panel-2-dark)]">
                  {buildBeverageImageUrl(row.beverage?.image) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={buildBeverageImageUrl(row.beverage.image)!}
                      alt={row.beverage.name}
                      className={`absolute inset-0 h-full w-full object-contain p-6 ${
                        selling ? "" : "opacity-40 grayscale"
                      }`}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Beer className="h-10 w-10 text-amber-300 dark:text-amber-900" />
                    </div>
                  )}
                  {!selling && (
                    <Badge className="absolute right-3 top-3 bg-gray-200 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700">
                      {stoppedCentrally ? "Unavailable" : "Not selling"}
                    </Badge>
                  )}
                </div>

                <div className="flex flex-1 flex-col p-4">
                  <h3 className="line-clamp-2 font-semibold leading-tight text-gray-900 dark:text-gray-100">
                    {row.beverage?.name || "Removed drink"}
                  </h3>
                  <div className="mt-auto space-y-2 border-t border-gray-100 pt-3 dark:border-gray-700">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-xs uppercase tracking-wide text-gray-500">
                        {isAdmin ? `${copy.owner === "venue" ? "Venue" : "Organizer"}'s price` : "Your price"}
                      </span>
                      <span className="font-semibold text-gray-900 dark:text-gray-100">
                        {formatCompactMoney(row.price, row.currency)}
                      </span>
                    </div>

                    {/* Stock as a bar rather than a bare number: how close a
                        drink is to selling out is the thing worth seeing. */}
                    <div>
                      <div className="flex items-baseline justify-between gap-2 text-xs">
                        <span className="uppercase tracking-wide text-gray-500">Stock</span>
                        <span className="text-gray-700 dark:text-gray-300">
                          <span className="font-semibold text-gray-900 dark:text-gray-100">
                            {row.sold ?? 0}
                          </span>
                          {" of "}
                          {row.stockTotal ?? 0} sold
                        </span>
                      </div>
                      <div
                        className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"
                        role="progressbar"
                        aria-valuenow={row.sold ?? 0}
                        aria-valuemin={0}
                        aria-valuemax={row.stockTotal ?? 0}
                        aria-label={`${row.sold ?? 0} of ${row.stockTotal ?? 0} sold`}
                      >
                        <div
                          className="h-full rounded-full bg-[var(--bev-ink)] dark:bg-[var(--bev-ink-dark)]"
                          style={{
                            width: `${
                              row.stockTotal > 0
                                ? Math.min((row.sold / row.stockTotal) * 100, 100)
                                : 0
                            }%`,
                          }}
                        />
                      </div>
                      {row.remaining === 0 && row.stockTotal > 0 && (
                        <p className="mt-1.5 text-xs font-medium text-[var(--bev-ink)] dark:text-[var(--bev-ink-dark)]">
                          Sold out
                        </p>
                      )}
                    </div>
                  </div>
                  {stoppedCentrally && (
                    <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      {UNAVAILABLE_COPY[row.unavailableReason as string]}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 border-t border-gray-100 px-4 py-3 dark:border-gray-700">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busyRow === row._id || stoppedCentrally}
                    onClick={() => toggleAvailability(row)}
                    className="flex-1"
                  >
                    <Power className="mr-1 h-4 w-4" />
                    {row.isAvailable ? "Stop selling" : "Sell again"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Change the price of ${row.beverage?.name}`}
                    onClick={() => {
                      setEditRow(row);
                      setEditPrice(String(row.price));
                      setEditStock(String(row.stockTotal ?? 0));
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${row.beverage?.name}`}
                    onClick={() => setRemoveTarget(row)}
                  >
                    <Trash2 className="h-4 w-4 text-red-600 dark:text-red-500" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add a drink</DialogTitle>
            <DialogDescription>
              Pick a drink and set what customers pay for it at {copy.place}.
            </DialogDescription>
          </DialogHeader>

          {addable.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-600 dark:text-gray-400">
              {catalog.length === 0
                ? isAdmin
                  ? `No drinks are approved for this ${copy.owner} yet.`
                  : "There are no drinks approved for you yet."
                : `Every approved drink is already on ${copy.place}.`}
            </p>
          ) : (
            <div className="space-y-4">
              <div className="max-h-[40vh] space-y-1 overflow-y-auto pr-1">
                {addable.map((beverage) => (
                  <button
                    key={beverage._id}
                    type="button"
                    onClick={() => setAddBeverageId(beverage._id)}
                    className={`flex w-full items-center gap-3 rounded-lg border p-2.5 text-left transition-colors ${
                      addBeverageId === beverage._id
                        ? "border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30"
                        : "border-transparent hover:bg-gray-50 dark:hover:bg-gray-800"
                    }`}
                  >
                    {buildBeverageImageUrl(beverage.image) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={buildBeverageImageUrl(beverage.image)!}
                        alt={beverage.name}
                        className="h-10 w-10 rounded-md object-contain"
                      />
                    ) : (
                      <div
                        style={getBeverageColorVars(beverage.color)}
                        className="flex h-10 w-10 items-center justify-center rounded-md bg-[var(--bev-panel)] dark:bg-[var(--bev-panel-dark)]"
                      >
                        <Beer className="h-4 w-4 text-[var(--bev-ink)] dark:text-[var(--bev-ink-dark)]" />
                      </div>
                    )}
                    <span className="flex-1 text-sm font-medium">{beverage.name}</span>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="add-price">Price (ETB)</Label>
                  <Input
                    id="add-price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={addPrice}
                    onChange={(e) => setAddPrice(e.target.value)}
                    placeholder="e.g. 90"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="add-stock">Bottles for sale</Label>
                  <Input
                    id="add-stock"
                    type="number"
                    min="1"
                    step="1"
                    value={addStock}
                    onChange={(e) => setAddStock(e.target.value)}
                    placeholder="e.g. 200"
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleAdd}
              disabled={saving || addable.length === 0}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {saving ? "Adding..." : context.kind === "venue" ? "Add to venue" : "Add to event"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reprice dialog */}
      <Dialog open={editRow !== null} onOpenChange={(open) => !open && setEditRow(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Price and stock</DialogTitle>
            <DialogDescription>{editRow?.beverage?.name}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-price">Price (ETB)</Label>
              <Input
                id="edit-price"
                type="number"
                min="0"
                step="0.01"
                value={editPrice}
                onChange={(e) => setEditPrice(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-stock">Bottles for sale</Label>
              <Input
                id="edit-stock"
                type="number"
                min="1"
                step="1"
                value={editStock}
                onChange={(e) => setEditStock(e.target.value)}
              />
              {(editRow?.sold ?? 0) > 0 && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {editRow?.sold} already sold
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditRow(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleReprice}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {saving ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={removeTarget !== null}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removeTarget?.beverage?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {(removeTarget?.sold ?? 0) > 0
                ? `${removeTarget?.sold} bottles have already sold, so this can't be removed — the record of what people paid has to stay. Use "Stop selling" instead.`
                : `It comes off ${copy.place} entirely. To pause sales without losing the price and stock, use "Stop selling" instead.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemove}
              disabled={(removeTarget?.sold ?? 0) > 0}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
