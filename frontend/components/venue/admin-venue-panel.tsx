"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { formatCompactMoney } from "@/lib/utils";
import { BeverageLineupManager } from "@/components/beverages/beverage-lineup-manager";
import { useAdminAuthStore } from "@/store/adminAuthStore";
import { Building2, Beer, Search, RefreshCw, Plus, Pencil, ShieldCheck, ShieldOff, Store } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const buildImageUrl = (image?: string | null) => {
  if (!image) return null;
  return `${API_URL}${image}`;
};

type Eligibility = "eligible" | "not_eligible";

interface VenueRow {
  _id: string;
  name: string;
  venueType?: string;
  city?: string;
  address?: string;
  phoneNumber?: string;
  image?: string | null;
  isActive: boolean;
  eligibility: Eligibility;
  eligibilityNotes?: string | null;
  beverageCommissionRate?: number;
  coversVenueVat?: boolean;
  drinksOffered?: number;
  stockTotal?: number;
  stockSold?: number;
  stockRemaining?: number;
  grossRevenue?: number;
  salesCount?: number;
  account?: { _id?: string; email?: string; phoneNumber?: string; firstName?: string; isActive?: boolean };
}

interface VenueFormState {
  name: string;
  venueType: string;
  city: string;
  address: string;
  phoneNumber: string;
  email: string;
  password: string;
  active: boolean;
  eligible: boolean;
  notes: string;
}

const EMPTY_FORM: VenueFormState = {
  name: "",
  venueType: "other",
  city: "",
  address: "",
  phoneNumber: "",
  email: "",
  password: "",
  active: true,
  eligible: false,
  notes: "",
};

const money = (value?: number) => formatCompactMoney(value || 0, "ETB");

export default function AdminVenuePanel() {
  const { token } = useAdminAuthStore();
  const [venues, setVenues] = useState<VenueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [eligibilityFilter, setEligibilityFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<VenueRow | null>(null);
  const [form, setForm] = useState<VenueFormState>(EMPTY_FORM);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [lineupVenue, setLineupVenue] = useState<VenueRow | null>(null);

  const fetchVenues = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: "10",
        ...(search ? { search } : {}),
        ...(statusFilter !== "all" ? { status: statusFilter } : {}),
        ...(eligibilityFilter !== "all" ? { eligibility: eligibilityFilter } : {}),
      });
      const res = await fetch(`${API_URL}/api/venues/admin?${params}`, {
        headers: { Authorization: `Bearer ${token || ""}` },
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to load venues");
      setVenues(data.data || []);
      setPages(data.pagination?.pages || 1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load venues");
    } finally {
      setLoading(false);
    }
  }, [eligibilityFilter, page, search, statusFilter, token]);

  useEffect(() => {
    fetchVenues();
  }, [fetchVenues]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setImageFile(null);
    setImagePreview(null);
    setDialogOpen(true);
  };

  const openEdit = (venue: VenueRow) => {
    setEditing(venue);
    setForm({
      name: venue.name || "",
      venueType: venue.venueType || "other",
      city: venue.city || "",
      address: venue.address || "",
      phoneNumber: venue.phoneNumber || "",
      email: venue.account?.email || "",
      password: "",
      active: venue.isActive,
      eligible: venue.eligibility === "eligible",
      notes: venue.eligibilityNotes || "",
    });
    setImageFile(null);
    setImagePreview(buildImageUrl(venue.image));
    setDialogOpen(true);
  };

  const saveVenue = async () => {
    if (!form.name.trim()) return toast.error("Venue name is required");
    if (!editing && !form.email.trim()) return toast.error("Venue email is required");
    if (!editing && String(form.password).length < 6) {
      return toast.error("A password of at least 6 characters is required");
    }
    try {
      setSaving(true);
      const headers = {
        Authorization: `Bearer ${token || ""}`,
      };
      const body = new FormData();
      body.append("name", form.name.trim());
      body.append("venueType", form.venueType);
      body.append("city", form.city.trim());
      body.append("address", form.address.trim());
      body.append("phoneNumber", form.phoneNumber.trim());
      body.append("isActive", String(form.active));
      if (imageFile) body.append("image", imageFile);
      if (!editing) {
        body.append("email", form.email.trim());
        body.append("password", form.password);
        body.append("eligibility", form.eligible ? "eligible" : "not_eligible");
      }

      const res = await fetch(
        editing ? `${API_URL}/api/venues/admin/${editing._id}` : `${API_URL}/api/venues/admin`,
        {
          method: editing ? "PATCH" : "POST",
          headers,
          body,
        }
      );
      const payload = await res.json();
      if (!res.ok || !payload.success) throw new Error(payload.message || "Failed to save venue");

      if (editing && form.eligible !== (editing.eligibility === "eligible")) {
        await fetch(`${API_URL}/api/venues/admin/${editing._id}/eligibility`, {
          method: "PATCH",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ eligibility: form.eligible ? "eligible" : "not_eligible", notes: form.notes }),
        });
      }

      toast.success(editing ? "Venue updated" : "Venue created");
      setDialogOpen(false);
      fetchVenues();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save venue");
    } finally {
      setSaving(false);
    }
  };

  const toggleEligibility = async (venue: VenueRow) => {
    try {
      const next = venue.eligibility === "eligible" ? "not_eligible" : "eligible";
      const res = await fetch(`${API_URL}/api/venues/admin/${venue._id}/eligibility`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token || ""}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ eligibility: next, notes: venue.eligibilityNotes || "" }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.success) throw new Error(payload.message || "Failed to update eligibility");
      toast.success(next === "eligible" ? "Venue approved" : "Venue approval revoked");
      fetchVenues();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update eligibility");
    }
  };

  const summary = useMemo(
    () => ({
      totalRevenue: venues.reduce((sum, venue) => sum + (venue.grossRevenue || 0), 0),
      totalStock: venues.reduce((sum, venue) => sum + (venue.stockTotal || 0), 0),
      totalSold: venues.reduce((sum, venue) => sum + (venue.stockSold || 0), 0),
      eligible: venues.filter((venue) => venue.eligibility === "eligible").length,
    }),
    [venues]
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border border-gray-200 dark:border-gray-800 dark:bg-gray-950/50">
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Venues</p>
            <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">{venues.length}</p>
          </CardContent>
        </Card>
        <Card className="border border-gray-200 dark:border-gray-800 dark:bg-gray-950/50">
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Eligible</p>
            <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">{summary.eligible}</p>
          </CardContent>
        </Card>
        <Card className="border border-gray-200 dark:border-gray-800 dark:bg-gray-950/50">
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Revenue</p>
            <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">{money(summary.totalRevenue)}</p>
          </CardContent>
        </Card>
        <Card className="border border-gray-200 dark:border-gray-800 dark:bg-gray-950/50">
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Stock sold</p>
            <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
              {summary.totalSold.toLocaleString()}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search venues"
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setPage(1); }}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
          <Select value={eligibilityFilter} onValueChange={(value) => { setEligibilityFilter(value); setPage(1); }}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Eligibility" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All eligibility</SelectItem>
              <SelectItem value="eligible">Eligible</SelectItem>
              <SelectItem value="not_eligible">Not eligible</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchVenues}>
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
          <Button className="bg-blue-600 text-white hover:bg-blue-700" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> Add venue
          </Button>
        </div>
      </div>

      <Card className="border border-gray-200 dark:border-gray-800 dark:bg-gray-950/50">
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-5">
              <Skeleton className="h-12 rounded-xl" />
              <Skeleton className="h-12 rounded-xl" />
              <Skeleton className="h-12 rounded-xl" />
            </div>
          ) : venues.length === 0 ? (
            <div className="px-5 py-16 text-center text-sm text-gray-500 dark:text-gray-400">
              <Store className="mx-auto mb-2 h-6 w-6" />
              No venues found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:text-gray-400">
                    <th className="px-5 py-3">Venue</th>
                    <th className="px-5 py-3">Account</th>
                    <th className="px-5 py-3">Eligibility</th>
                    <th className="px-5 py-3 text-right">Revenue</th>
                    <th className="px-5 py-3 text-right">Line-up</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {venues.map((venue) => (
                    <tr key={venue._id} className="border-b border-gray-100 last:border-0 dark:border-gray-800">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          {buildImageUrl(venue.image) ? (
                            <img
                              src={buildImageUrl(venue.image)!}
                              alt={venue.name}
                              className="h-12 w-12 rounded-lg object-cover ring-1 ring-gray-200 dark:ring-gray-800"
                            />
                          ) : (
                            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100 text-xs font-semibold text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                              VN
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-gray-900 dark:text-gray-100">{venue.name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{[venue.city, venue.venueType].filter(Boolean).join(" • ") || "Venue"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-gray-600 dark:text-gray-400">
                        <p>{venue.account?.email || "—"}</p>
                        <p className="text-xs">{venue.phoneNumber || venue.account?.phoneNumber || ""}</p>
                      </td>
                      <td className="px-5 py-4">
                        <Badge variant={venue.eligibility === "eligible" ? "secondary" : "outline"}>
                          {venue.eligibility === "eligible" ? "Eligible" : "Not eligible"}
                        </Badge>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          {venue.isActive ? "Active account" : "Inactive account"}
                        </p>
                      </td>
                      <td className="px-5 py-4 text-right tabular-nums text-gray-600 dark:text-gray-400">
                        {money(venue.grossRevenue)}
                      </td>
                      <td className="px-5 py-4 text-right tabular-nums text-gray-600 dark:text-gray-400">
                        {venue.drinksOffered || 0} drinks
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => setLineupVenue(venue)}>
                            <Beer className="mr-1 h-4 w-4" /> Beverages
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => openEdit(venue)}>
                            <Pencil className="mr-1 h-4 w-4" /> Edit
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => toggleEligibility(venue)}>
                            {venue.eligibility === "eligible" ? <ShieldOff className="mr-1 h-4 w-4" /> : <ShieldCheck className="mr-1 h-4 w-4" />}
                            {venue.eligibility === "eligible" ? "Revoke" : "Approve"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
        <span>Page {page} of {pages}</span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            Previous
          </Button>
          <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => Math.min(p + 1, pages))}>
            Next
          </Button>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit venue" : "Add venue"}</DialogTitle>
            <DialogDescription>
              Create the venue account first, then give it access to its own dashboard and beverage lineup.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Image</Label>
              <div className="flex items-center gap-4">
                {imagePreview ? (
                  <img
                    src={imagePreview}
                    alt={editing ? editing.name : form.name || "Venue preview"}
                    className="h-20 w-20 rounded-xl object-cover ring-1 ring-gray-200 dark:ring-gray-800"
                  />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-xl border border-dashed border-gray-300 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
                    No image
                  </div>
                )}
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setImageFile(file);
                    setImagePreview(file ? URL.createObjectURL(file) : editing ? buildImageUrl(editing.image) : null);
                  }}
                />
              </div>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Venue type</Label>
              <Input value={form.venueType} onChange={(e) => setForm((prev) => ({ ...prev, venueType: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={form.phoneNumber} onChange={(e) => setForm((prev) => ({ ...prev, phoneNumber: e.target.value }))} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>City</Label>
              <Input value={form.city} onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Address</Label>
              <Textarea value={form.address} onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))} />
            </div>
            {!editing && (
              <>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Password</Label>
                  <Input type="password" value={form.password} onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))} />
                </div>
              </>
            )}
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Eligibility notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveVenue} disabled={saving} className="bg-blue-600 text-white hover:bg-blue-700">
              {saving ? "Saving..." : "Save venue"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(lineupVenue)} onOpenChange={(open) => !open && setLineupVenue(null)}>
        <DialogContent className="max-w-6xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Beer className="h-4 w-4" /> {lineupVenue?.name} beverages</DialogTitle>
            <DialogDescription>
              Add drinks, set prices, and manage the venue's selling line-up.
            </DialogDescription>
          </DialogHeader>
          {lineupVenue && (
            <BeverageLineupManager
              token={token || ""}
              context={{ kind: "venue", venueId: lineupVenue._id, scope: "admin" }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}