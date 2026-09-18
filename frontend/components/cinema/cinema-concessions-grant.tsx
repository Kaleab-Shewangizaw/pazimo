"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAdminAuthStore } from "@/store/adminAuthStore";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Search, Check, Popcorn } from "lucide-react";

/**
 * What one cinema is allowed to sell at its counter.
 *
 * An ALLOW list, so an empty selection means the counter sells nothing. That
 * inversion is the thing this screen has to make impossible to misread: the
 * footer states the consequence in words rather than leaving an admin to infer
 * it from an empty list.
 *
 * Products and their artwork belong to the concession catalogue (the Snacks
 * tab). This screen only decides who may sell them, which is why there is no
 * create control here — adding a product and granting it are different
 * decisions with different consequences.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL;

interface CatalogueProduct {
  _id: string;
  name: string;
  image?: string | null;
  color?: string | null;
  category: "drink" | "snack" | "combo";
  isActive: boolean;
}

const CATEGORY_LABEL: Record<string, string> = {
  drink: "Drink",
  snack: "Snack",
  combo: "Combo",
};

export default function CinemaConcessionsGrant({
  cinemaId,
  cinemaName,
  granted,
  open,
  onOpenChange,
  onSaved,
}: {
  cinemaId: string;
  cinemaName: string;
  granted: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (next: string[]) => void;
}) {
  const { token } = useAdminAuthStore();
  const [catalogue, setCatalogue] = useState<CatalogueProduct[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Loaded when the dialog opens, not on mount: an admin scanning a list of
  // cinemas should not pull the whole catalogue for each row they pass.
  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/cinemas/admin/products?limit=200`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setCatalogue(data?.data || []);
    } catch {
      toast.error("Could not load the product catalogue");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!open) return;
    load();
    // Reset from props each time it opens, so cancelling really discards.
    setSelected(new Set(granted));
    setSearch("");
  }, [open, granted, load]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return catalogue
      .filter((p) => !term || p.name.toLowerCase().includes(term))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [catalogue, search]);

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(
        `${API_URL}/api/cinemas/admin/${cinemaId}/allowed-concessions`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ allowedConcessions: [...selected] }),
        }
      );
      const data = await res.json();
      if (!res.ok || data?.success === false) {
        throw new Error(data?.message || "Could not save");
      }
      toast.success(
        selected.size === 0
          ? `${cinemaName} can no longer sell anything`
          : `${cinemaName} can sell ${selected.size} product${selected.size === 1 ? "" : "s"}`
      );
      onSaved([...selected]);
      onOpenChange(false);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-hidden p-0">
        <DialogHeader className="border-b border-gray-200 px-6 py-5 dark:border-gray-800">
          <DialogTitle className="flex items-center gap-2">
            <Popcorn className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            What {cinemaName} can sell
          </DialogTitle>
          <DialogDescription>
            Tick the products this cinema may put on its counter. It sets its own
            prices; the name and artwork stay yours.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              className="pl-9"
              placeholder="Search the catalogue"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="max-h-[46vh] overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-lg" />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <p className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">
              {search
                ? "Nothing in the catalogue matches that."
                : "The catalogue is empty. Add products on the Snacks tab first."}
            </p>
          ) : (
            <div className="space-y-1.5">
              {visible.map((product) => {
                const on = selected.has(product._id);
                return (
                  <button
                    key={product._id}
                    type="button"
                    onClick={() => toggle(product._id)}
                    className={`flex w-full items-center gap-3 rounded-lg border p-2.5 text-left transition-colors ${
                      on
                        ? "border-indigo-300 bg-indigo-50 dark:border-indigo-700 dark:bg-indigo-950/40"
                        : "border-gray-200 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-900/50"
                    }`}
                  >
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md"
                      style={{
                        backgroundColor: product.image
                          ? undefined
                          : product.color || "#6366f1",
                      }}
                    >
                      {product.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`${API_URL}${product.image}`}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Popcorn className="h-4 w-4 text-white" />
                      )}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                        {product.name}
                      </span>
                      <span className="block text-xs text-gray-500 dark:text-gray-400">
                        {CATEGORY_LABEL[product.category] || product.category}
                        {/* Retired products stay tickable: a cinema may already
                            be selling one, and hiding it here would revoke it
                            the next time anyone saved this screen. */}
                        {!product.isActive && " · retired from the catalogue"}
                      </span>
                    </span>

                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                        on
                          ? "border-indigo-600 bg-indigo-600 text-white"
                          : "border-gray-300 dark:border-gray-700"
                      }`}
                    >
                      {on && <Check className="h-3.5 w-3.5" />}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter className="flex-row items-center justify-between gap-3 border-t border-gray-200 px-6 py-4 dark:border-gray-800">
          {/* The consequence, in words. An empty allow list means the counter
              sells nothing, which is the opposite of how a deny list read and
              the one thing an admin could reasonably misjudge. */}
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {selected.size === 0
              ? "Nothing selected — this cinema will not be able to sell anything."
              : `${selected.size} product${selected.size === 1 ? "" : "s"} selected.`}
          </p>
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
