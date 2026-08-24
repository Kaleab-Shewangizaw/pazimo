"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAdminAuthStore } from "@/store/adminAuthStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import {
  Popcorn,
  Pencil,
  Search,
  ImageUp,
  EyeOff,
  Eye,
  Trash2,
} from "lucide-react";

/**
 * The products cinemas sell at the counter, and their artwork.
 *
 * This is the CATALOGUE — what exists. Which cinema may sell what is a separate
 * decision, made per cinema on the Cinemas tab, and the two are kept apart on
 * purpose: adding popcorn to the platform and letting one site sell it have
 * different consequences and different blast radii.
 *
 * The image matters more here than anywhere else in the admin: it is what a
 * customer sees in the snacks step, so the form leads with it rather than
 * treating it as an optional afterthought.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL;

interface Product {
  _id: string;
  name: string;
  image?: string | null;
  color?: string | null;
  category: "drink" | "snack" | "combo";
  isActive: boolean;
}

const CATEGORIES: { value: Product["category"]; label: string }[] = [
  { value: "drink", label: "Drink" },
  { value: "snack", label: "Snack" },
  { value: "combo", label: "Combo" },
];

const EMPTY = { name: "", category: "snack" as Product["category"], color: "#6366f1" };

export default function AdminConcessionCatalogue() {
  const { token } = useAdminAuthStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Product | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/cinemas/admin/products?limit=200`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setProducts(data?.data || []);
    } catch {
      toast.error("Could not load the catalogue");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter((p) => !term || p.name.toLowerCase().includes(term));
  }, [products, search]);

  const reset = () => {
    setForm(EMPTY);
    setEditingId(null);
    setImageFile(null);
    setImagePreview(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const beginEdit = (product: Product) => {
    setEditingId(product._id);
    setForm({
      name: product.name,
      category: product.category,
      color: product.color || "#6366f1",
    });
    // Left unset on purpose: saving without choosing a new file keeps the
    // existing artwork rather than clearing it.
    setImageFile(null);
    setImagePreview(product.image ? `${API_URL}${product.image}` : null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const pickImage = (file: File | null) => {
    setImageFile(file);
    setImagePreview(file ? URL.createObjectURL(file) : null);
  };

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const body = new FormData();
      body.append("name", form.name.trim());
      body.append("category", form.category);
      body.append("color", form.color);
      if (imageFile) body.append("image", imageFile);

      const res = await fetch(
        editingId
          ? `${API_URL}/api/cinemas/admin/products/${editingId}`
          : `${API_URL}/api/cinemas/admin/products`,
        {
          method: editingId ? "PATCH" : "POST",
          headers: { Authorization: `Bearer ${token}` },
          body,
        }
      );
      const data = await res.json();
      if (!res.ok || data?.success === false) {
        throw new Error(data?.message || "Could not save");
      }
      toast.success(editingId ? `${form.name.trim()} updated` : `${form.name.trim()} added`);
      reset();
      await load();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const removeProduct = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/cinemas/admin/products/${deleting._id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok || data?.success === false) {
        throw new Error(data?.message || "Could not delete");
      }
      toast.success(`${deleting.name} deleted`);
      // Editing the row that was just deleted would save into nothing.
      if (editingId === deleting._id) reset();
      setDeleting(null);
      await load();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setDeleteBusy(false);
    }
  };

  const toggleActive = async (product: Product) => {
    try {
      const res = await fetch(`${API_URL}/api/cinemas/admin/products/${product._id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isActive: !product.isActive }),
      });
      const data = await res.json();
      if (!res.ok || data?.success === false) {
        throw new Error(data?.message || "Could not save");
      }
      toast.success(
        product.isActive
          ? `${product.name} retired — cinemas can no longer put it on sale`
          : `${product.name} is available again`
      );
      await load();
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr] lg:items-start">
      {/* The form. Left column and sticky, so adding several products in a row
          does not mean scrolling back up between each. */}
      <Card className="border border-gray-200 dark:border-gray-800 dark:bg-gray-950/50 lg:sticky lg:top-6">
        <CardContent className="space-y-4 p-5">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
              <Popcorn className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              {editingId ? "Edit product" : "Add a product"}
            </h2>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {editingId
                ? "Changes apply everywhere this product is sold."
                : "Adding it here does not put it on sale — grant it to a cinema on the Cinemas tab."}
            </p>
          </div>

          {/* Artwork first: it is what the customer actually sees. */}
          <div>
            <Label className="text-xs">Image</Label>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="mt-1 flex h-28 w-full items-center justify-center overflow-hidden rounded-lg border border-dashed border-gray-300 bg-gray-50 transition-colors hover:border-indigo-400 dark:border-gray-700 dark:bg-gray-900/50"
              style={imagePreview ? undefined : { backgroundColor: `${form.color}12` }}
            >
              {imagePreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imagePreview} alt="" className="h-full w-full object-contain" />
              ) : (
                <span className="flex flex-col items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                  <ImageUp className="h-5 w-5" />
                  Choose an image
                </span>
              )}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => pickImage(e.target.files?.[0] || null)}
            />
          </div>

          <div>
            <Label className="text-xs">Name</Label>
            <Input
              value={form.name}
              placeholder="Coke, Popcorn, Water…"
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter" && form.name.trim()) save();
              }}
            />
          </div>

          <div className="grid grid-cols-[1fr_auto] gap-3">
            <div>
              <Label className="text-xs">Kind</Label>
              <select
                className="h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm dark:border-gray-700 dark:bg-gray-900"
                value={form.category}
                onChange={(e) =>
                  setForm({ ...form, category: e.target.value as Product["category"] })
                }
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs">Colour</Label>
              {/* Used behind products with no image, so it is never dead
                  configuration — it is the fallback the customer sees. */}
              <input
                type="color"
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
                className="h-9 w-14 cursor-pointer rounded-md border border-gray-300 bg-white p-1 dark:border-gray-700 dark:bg-gray-900"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={save} disabled={saving || !form.name.trim()}>
              {saving ? "Saving…" : editingId ? "Save changes" : "Add product"}
            </Button>
            {editingId && (
              <Button variant="ghost" onClick={reset} disabled={saving}>
                Cancel
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* The catalogue. */}
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            className="pl-9"
            placeholder="Search products"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-[104px] rounded-xl" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <Card className="border border-dashed border-gray-300 dark:border-gray-700">
            <CardContent className="py-16 text-center">
              <Popcorn className="mx-auto mb-2 h-6 w-6 text-gray-300 dark:text-gray-700" />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {search
                  ? "Nothing matches that."
                  : "No products yet. Add the first one on the left."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3">
            {visible.map((product) => (
              <Card
                key={product._id}
                className={`border border-gray-200 dark:border-gray-800 dark:bg-gray-950/50 ${
                  product.isActive ? "" : "opacity-60"
                }`}
              >
                {/* Fixed height and a fixed-size thumbnail, so a card with a
                    long name is the same shape as one without. */}
                <CardContent className="flex h-[104px] items-center gap-3 p-4">
                  <span
                    className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg"
                    style={{
                      backgroundColor: product.image ? undefined : product.color || "#6366f1",
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
                      <Popcorn className="h-5 w-5 text-white" />
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-gray-900 dark:text-gray-100">
                      {product.name}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      {CATEGORIES.find((c) => c.value === product.category)?.label ||
                        product.category}
                    </p>
                    {!product.isActive && (
                      <Badge variant="outline" className="mt-1 text-[10px]">
                        Retired
                      </Badge>
                    )}
                  </div>

                  <div className="grid shrink-0 grid-cols-2 gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      title="Edit this product"
                      onClick={() => beginEdit(product)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      title={
                        product.isActive
                          ? "Retire — cinemas stop being able to sell it"
                          : "Make available again"
                      }
                      onClick={() => toggleActive(product)}
                    >
                      {product.isActive ? (
                        <EyeOff className="h-3.5 w-3.5" />
                      ) : (
                        <Eye className="h-3.5 w-3.5" />
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="col-span-2 h-7 w-full text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950/40"
                      title="Delete this product"
                      onClick={() => setDeleting(product)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes it from the catalogue entirely — no cinema will be able to
              grant or sell it again. If any cinema still has it on their line-up,
              deleting is refused; retire it there first, or use &ldquo;Retire&rdquo;
              here instead if you might want it back. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteBusy}>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={removeProduct}
              disabled={deleteBusy}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {deleteBusy ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
