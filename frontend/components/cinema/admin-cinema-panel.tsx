"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAdminAuthStore } from "@/store/adminAuthStore";
import { toast } from "sonner";
import {
  Film,
  Plus,
  Pencil,
  RefreshCw,
  Search,
  ShieldCheck,
  ShieldOff,
  Store,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const buildImageUrl = (image?: string | null) => {
  if (!image) return null;
  return `${API_URL}${image}`;
};

const formatRate = (rate?: number | null) => `${(((rate || 0) * 100)).toFixed(1)}%`;

type CinemaEligibility = "eligible" | "not_eligible";

interface CinemaRow {
  _id: string;
  name: string;
  description?: string | null;
  city?: string | null;
  address?: string | null;
  phoneNumber?: string | null;
  email?: string | null;
  image?: string | null;
  isActive: boolean;
  beverageEligibility: CinemaEligibility;
  eligibilityNotes?: string | null;
  ticketCommissionRate?: number;
  beverageCommissionRate?: number;
  coversCinemaVat?: boolean;
  account?: {
    _id?: string;
    email?: string;
    phoneNumber?: string;
    firstName?: string;
    lastName?: string;
    isActive?: boolean;
  };
}

interface CinemaFormState {
  name: string;
  description: string;
  city: string;
  address: string;
  phoneNumber: string;
  email: string;
  password: string;
  active: boolean;
  eligible: boolean;
  notes: string;
  ticketCommissionRate: string;
  beverageCommissionRate: string;
  coversCinemaVat: boolean;
}

const EMPTY_FORM: CinemaFormState = {
  name: "",
  description: "",
  city: "",
  address: "",
  phoneNumber: "",
  email: "",
  password: "",
  active: true,
  eligible: false,
  notes: "",
  ticketCommissionRate: "0.03",
  beverageCommissionRate: "0.03",
  coversCinemaVat: false,
};


export default function AdminCinemaPanel() {
  const { token } = useAdminAuthStore();
  const [cinemas, setCinemas] = useState<CinemaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CinemaRow | null>(null);
  const [form, setForm] = useState<CinemaFormState>(EMPTY_FORM);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchCinemas = useCallback(async () => {
    if (!token) return;

    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: "10",
        ...(search ? { search } : {}),
        ...(statusFilter !== "all" ? { status: statusFilter } : {}),
      });
      const res = await fetch(`${API_URL}/api/cinemas/admin?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to load cinemas");
      setCinemas(data.data || []);
      setPages(data.pagination?.pages || 1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load cinemas");
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, token]);

  useEffect(() => {
    fetchCinemas();
  }, [fetchCinemas]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setImageFile(null);
    setImagePreview(null);
    setDialogOpen(true);
  };

  const openEdit = (cinema: CinemaRow) => {
    setEditing(cinema);
    setForm({
      name: cinema.name || "",
      description: cinema.description || "",
      city: cinema.city || "",
      address: cinema.address || "",
      phoneNumber: cinema.phoneNumber || "",
      email: cinema.account?.email || cinema.email || "",
      password: "",
      active: cinema.isActive,
      eligible: cinema.beverageEligibility === "eligible",
      notes: cinema.eligibilityNotes || "",
      ticketCommissionRate: String(cinema.ticketCommissionRate ?? 0.03),
      beverageCommissionRate: String(cinema.beverageCommissionRate ?? 0.03),
      coversCinemaVat: Boolean(cinema.coversCinemaVat),
    });
    setImageFile(null);
    setImagePreview(buildImageUrl(cinema.image));
    setDialogOpen(true);
  };

  const saveCinema = async () => {
    if (!form.name.trim()) return toast.error("Cinema name is required");
    if (!editing && !form.email.trim()) return toast.error("Cinema email is required");
    if (!editing && String(form.password).length < 6) {
      return toast.error("A password of at least 6 characters is required");
    }

    const ticketRate = Number(form.ticketCommissionRate);
    const beverageRate = Number(form.beverageCommissionRate);
    if (!Number.isFinite(ticketRate)) return toast.error("Ticket commission rate must be a number");
    if (!Number.isFinite(beverageRate)) return toast.error("Beverage commission rate must be a number");

    try {
      setSaving(true);
      const body = new FormData();
      body.append("name", form.name.trim());
      body.append("description", form.description.trim());
      body.append("city", form.city.trim());
      body.append("address", form.address.trim());
      body.append("phoneNumber", form.phoneNumber.trim());
      body.append("isActive", String(form.active));
      body.append("beverageEligibility", form.eligible ? "eligible" : "not_eligible");
      body.append("ticketCommissionRate", String(ticketRate));
      body.append("beverageCommissionRate", String(beverageRate));
      body.append("coversCinemaVat", String(form.coversCinemaVat));
      body.append("eligibilityNotes", form.notes.trim());
      if (imageFile) body.append("image", imageFile);
      if (!editing) {
        body.append("email", form.email.trim());
        body.append("password", form.password);
        body.append("contactLastName", "Cinema");
      } else {
        body.append("email", form.email.trim());
      }

      const res = await fetch(
        editing ? `${API_URL}/api/cinemas/admin/${editing._id}` : `${API_URL}/api/cinemas/admin`,
        {
          method: editing ? "PATCH" : "POST",
          headers: { Authorization: `Bearer ${token || ""}` },
          body,
        }
      );
      const payload = await res.json();
      if (!res.ok || !payload.success) throw new Error(payload.message || "Failed to save cinema");

      toast.success(editing ? "Cinema updated" : "Cinema created");
      setDialogOpen(false);
      fetchCinemas();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save cinema");
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (cinema: CinemaRow) => {
    try {
      const next = !cinema.isActive;
      const res = await fetch(`${API_URL}/api/cinemas/admin/${cinema._id}/status`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token || ""}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isActive: next }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.success) throw new Error(payload.message || "Failed to update status");
      toast.success(next ? "Cinema activated" : "Cinema suspended");
      fetchCinemas();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update status");
    }
  };

  const toggleEligibility = async (cinema: CinemaRow) => {
    try {
      const next = cinema.beverageEligibility === "eligible" ? "not_eligible" : "eligible";
      const res = await fetch(`${API_URL}/api/cinemas/admin/${cinema._id}/beverage-eligibility`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token || ""}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ eligibility: next, notes: cinema.eligibilityNotes || "" }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.success) throw new Error(payload.message || "Failed to update eligibility");
      toast.success(next === "eligible" ? "Cinema approved for concessions" : "Cinema concessions revoked");
      fetchCinemas();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update eligibility");
    }
  };

  const summary = useMemo(
    () => ({
      total: cinemas.length,
      active: cinemas.filter((cinema) => cinema.isActive).length,
      inactive: cinemas.filter((cinema) => !cinema.isActive).length,
      eligible: cinemas.filter((cinema) => cinema.beverageEligibility === "eligible").length,
      avgTicketRate: cinemas.length
        ? cinemas.reduce((sum, cinema) => sum + (cinema.ticketCommissionRate || 0), 0) / cinemas.length
        : 0,
      avgBeverageRate: cinemas.length
        ? cinemas.reduce((sum, cinema) => sum + (cinema.beverageCommissionRate || 0), 0) / cinemas.length
        : 0,
    }),
    [cinemas]
  );

  return (
    <div className="space-y-6">
      <Tabs defaultValue="dashboard" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 bg-gray-100 p-1 dark:bg-gray-900/70 sm:w-[340px]">
          <TabsTrigger value="dashboard">
            <Film className="mr-1.5 h-4 w-4" /> Dashboard
          </TabsTrigger>
          <TabsTrigger value="cinemas">
            <Store className="mr-1.5 h-4 w-4" /> Cinemas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Card className="border border-gray-200 dark:border-gray-800 dark:bg-gray-950/50">
              <CardContent className="p-5">
                <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Cinemas</p>
                <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">{summary.total}</p>
              </CardContent>
            </Card>
            <Card className="border border-gray-200 dark:border-gray-800 dark:bg-gray-950/50">
              <CardContent className="p-5">
                <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Active</p>
                <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">{summary.active}</p>
              </CardContent>
            </Card>
            <Card className="border border-gray-200 dark:border-gray-800 dark:bg-gray-950/50">
              <CardContent className="p-5">
                <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Suspended</p>
                <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">{summary.inactive}</p>
              </CardContent>
            </Card>
            <Card className="border border-gray-200 dark:border-gray-800 dark:bg-gray-950/50">
              <CardContent className="p-5">
                <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Concession eligible</p>
                <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">{summary.eligible}</p>
              </CardContent>
            </Card>
            <Card className="border border-gray-200 dark:border-gray-800 dark:bg-gray-950/50">
              <CardContent className="p-5">
                <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Avg ticket cut</p>
                <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">{formatRate(summary.avgTicketRate)}</p>
              </CardContent>
            </Card>
          </div>

          <Card className="border border-gray-200 dark:border-gray-800 dark:bg-gray-950/50">
            <CardContent className="grid gap-4 p-6 lg:grid-cols-[1.2fr_0.8fr]">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Cinema management</p>
                <h2 className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">Cinema channel dashboard</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-400">
                  Manage cinema accounts, upload branding, switch activation, and control whether a cinema can sell
                  concessions. Ticket and beverage commission rates are editable here as admin-controlled business
                  settings.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900/50">
                  <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Avg beverage cut</p>
                  <p className="mt-2 text-xl font-semibold text-gray-900 dark:text-gray-100">{formatRate(summary.avgBeverageRate)}</p>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900/50">
                  <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Access</p>
                  <p className="mt-2 text-xl font-semibold text-gray-900 dark:text-gray-100">Admin-managed</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cinemas" className="space-y-6">
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
                  placeholder="Search cinemas"
                  className="pl-9"
                />
              </div>
              <Select
                value={statusFilter}
                onValueChange={(value) => {
                  setStatusFilter(value);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={fetchCinemas}>
                <RefreshCw className="mr-2 h-4 w-4" /> Refresh
              </Button>
              <Button className="bg-blue-600 text-white hover:bg-blue-700" onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" /> Add cinema
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
              ) : cinemas.length === 0 ? (
                <div className="px-5 py-16 text-center text-sm text-gray-500 dark:text-gray-400">
                  <Store className="mx-auto mb-2 h-6 w-6" />
                  No cinemas found.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:text-gray-400">
                        <th className="px-5 py-3">Cinema</th>
                        <th className="px-5 py-3">Account</th>
                        <th className="px-5 py-3">Status</th>
                        <th className="px-5 py-3 text-right">Ticket cut</th>
                        <th className="px-5 py-3 text-right">Beverage cut</th>
                        <th className="px-5 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cinemas.map((cinema) => (
                        <tr key={cinema._id} className="border-b border-gray-100 last:border-0 dark:border-gray-800">
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              {buildImageUrl(cinema.image) ? (
                                <img
                                  src={buildImageUrl(cinema.image)!}
                                  alt={cinema.name}
                                  className="h-12 w-12 rounded-lg object-cover ring-1 ring-gray-200 dark:ring-gray-800"
                                />
                              ) : (
                                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100 text-xs font-semibold text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                                  CN
                                </div>
                              )}
                              <div>
                                <p className="font-medium text-gray-900 dark:text-gray-100">{cinema.name}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  {[cinema.city, cinema.description].filter(Boolean).join(" • ") || "Cinema"}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4 text-gray-600 dark:text-gray-400">
                            <p>{cinema.account?.email || cinema.email || "—"}</p>
                            <p className="text-xs">{cinema.phoneNumber || cinema.account?.phoneNumber || ""}</p>
                          </td>
                          <td className="px-5 py-4">
                            <Badge variant={cinema.isActive ? "secondary" : "outline"}>
                              {cinema.isActive ? "Active" : "Inactive"}
                            </Badge>
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                              {cinema.beverageEligibility === "eligible" ? "Concessions enabled" : "Concessions blocked"}
                            </p>
                          </td>
                          <td className="px-5 py-4 text-right tabular-nums text-gray-600 dark:text-gray-400">
                            {formatRate(cinema.ticketCommissionRate)}
                          </td>
                          <td className="px-5 py-4 text-right tabular-nums text-gray-600 dark:text-gray-400">
                            {formatRate(cinema.beverageCommissionRate)}
                          </td>
                          <td className="px-5 py-4 text-right">
                            <div className="flex justify-end gap-2">
                              <Button variant="outline" size="sm" onClick={() => openEdit(cinema)}>
                                <Pencil className="mr-1 h-4 w-4" /> Edit
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => toggleEligibility(cinema)}>
                                {cinema.beverageEligibility === "eligible" ? (
                                  <ShieldOff className="mr-1 h-4 w-4" />
                                ) : (
                                  <ShieldCheck className="mr-1 h-4 w-4" />
                                )}
                                {cinema.beverageEligibility === "eligible" ? "Revoke" : "Approve"}
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => toggleStatus(cinema)}>
                                {cinema.isActive ? "Suspend" : "Activate"}
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
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit cinema" : "Add cinema"}</DialogTitle>
            <DialogDescription>
              Register the cinema account, upload its image, and set ticket and concession settings from one place.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Image</Label>
              <div className="flex items-center gap-4">
                {imagePreview ? (
                  <img
                    src={imagePreview}
                    alt={editing ? editing.name : form.name || "Cinema preview"}
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
                    setImagePreview(file ? URL.createObjectURL(file) : buildImageUrl(editing?.image));
                  }}
                />
              </div>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>City</Label>
              <Input value={form.city} onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={form.phoneNumber} onChange={(e) => setForm((prev) => ({ ...prev, phoneNumber: e.target.value }))} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Address</Label>
              <Textarea value={form.address} onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} />
            </div>
            {!editing && (
              <div className="space-y-1.5">
                <Label>Password</Label>
                <Input type="password" value={form.password} onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))} />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Ticket commission</Label>
              <Input
                value={form.ticketCommissionRate}
                onChange={(e) => setForm((prev) => ({ ...prev, ticketCommissionRate: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Beverage commission</Label>
              <Input
                value={form.beverageCommissionRate}
                onChange={(e) => setForm((prev) => ({ ...prev, beverageCommissionRate: e.target.value }))}
              />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-800 sm:col-span-2">
              <div>
                <p className="font-medium text-gray-900 dark:text-gray-100">Cinema VAT coverage</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Controls whether Pazimo withholds VAT on future sales.</p>
              </div>
              <Button
                type="button"
                variant={form.coversCinemaVat ? "default" : "outline"}
                onClick={() => setForm((prev) => ({ ...prev, coversCinemaVat: !prev.coversCinemaVat }))}
              >
                {form.coversCinemaVat ? "On" : "Off"}
              </Button>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Eligibility notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={form.active ? "active" : "inactive"}
                onValueChange={(value) => setForm((prev) => ({ ...prev, active: value === "active" }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Beverage access</Label>
              <Select
                value={form.eligible ? "eligible" : "not_eligible"}
                onValueChange={(value) => setForm((prev) => ({ ...prev, eligible: value === "eligible" }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Eligibility" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="eligible">Eligible</SelectItem>
                  <SelectItem value="not_eligible">Not eligible</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveCinema} disabled={saving} className="bg-blue-600 text-white hover:bg-blue-700">
              {saving ? "Saving..." : editing ? "Save changes" : "Create cinema"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
