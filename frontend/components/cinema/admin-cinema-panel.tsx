"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordField } from "@/components/ui/password-field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAdminAuthStore } from "@/store/adminAuthStore";
import { toast } from "sonner";
import AdminMovieCuration from "@/components/cinema/admin-movie-curation";
import CinemaConcessionsGrant from "@/components/cinema/cinema-concessions-grant";
import AdminConcessionCatalogue from "@/components/cinema/admin-concession-catalogue";
import AdminCinemaFinancePanel from "@/components/cinema/admin-cinema-finance-panel";
import AdminCinemaTicketsPanel from "@/components/cinema/admin-cinema-tickets-panel";
import AdminCinemaHalls from "@/components/cinema/admin-cinema-halls";
import AdminScreenVideoSection from "@/components/cinema/admin-screen-video-section";
import { CinemaCashierManager } from "@/components/cinema/cinema-cashier-manager";
import {
  AlertTriangle,
  Clapperboard,
  Plus,
  Pencil,
  RefreshCw,
  Search,
  ShieldCheck,
  ShieldOff,
  Store,
  Popcorn,
  PauseCircle,
  PlayCircle,
  Wallet,
  Ticket,
  DoorOpen,
  Users,
  MonitorPlay,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const buildImageUrl = (image?: string | null) => {
  if (!image) return null;
  return `${API_URL}${image}`;
};

// Same relative-path convention as the image, just under a different field —
// see the note on Cinema.promoVideo in the backend model.
const buildVideoUrl = (video?: string | null) => {
  if (!video) return null;
  return `${API_URL}${video}`;
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
  promoVideo?: string | null;
  isActive: boolean;
  beverageEligibility: CinemaEligibility;
  eligibilityNotes?: string | null;
  /**
   * Catalogue products this cinema may sell. An ALLOW list: empty means it can
   * sell nothing, which is why an empty one is called out as needing attention
   * rather than read as "no restrictions".
   */
  allowedConcessions?: string[];
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
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // A direct reset, not the create-time password — see resetPassword below.
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resettingPassword, setResettingPassword] = useState(false);
  // The cinema whose concession grants are being edited, or null.
  const [granting, setGranting] = useState<CinemaRow | null>(null);
  // The cinema whose halls are being managed, or null.
  const [managingHalls, setManagingHalls] = useState<CinemaRow | null>(null);
  const [managingCashiers, setManagingCashiers] = useState<CinemaRow | null>(null);

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
    setVideoFile(null);
    setVideoPreview(null);
    setNewPassword("");
    setConfirmPassword("");
    setDialogOpen(true);
  };

  const openEdit = (cinema: CinemaRow) => {
    setEditing(cinema);
    setNewPassword("");
    setConfirmPassword("");
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
    setVideoFile(null);
    setVideoPreview(buildVideoUrl(cinema.promoVideo));
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
      if (videoFile) body.append("promoVideo", videoFile);
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

  // A separate action from saveCinema, deliberately: setting a new password
  // is not a field on the profile form, it is its own privileged operation,
  // and bundling it into "Save changes" would reset it on every unrelated
  // edit (or silently leave it typed-but-unsent if the admin forgot to hit
  // save last).
  const resetPassword = async () => {
    if (!editing) return;
    if (newPassword.length < 6) {
      return toast.error("New password must be at least 6 characters");
    }
    if (newPassword !== confirmPassword) {
      return toast.error("New password and confirmation don't match");
    }
    setResettingPassword(true);
    try {
      const res = await fetch(`${API_URL}/api/cinemas/admin/${editing._id}/security`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token || ""}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ newPassword }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.success) throw new Error(payload.message || "Failed to reset password");
      toast.success(`Password reset for ${editing.name}`);
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to reset password");
    } finally {
      setResettingPassword(false);
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

  // What actually needs an admin's attention. Empty means nothing does.
  //
  // This replaces five equal-weight counters — total, active, suspended,
  // eligible, average cut — which were true and useless: at any realistic
  // number of cinemas an admin already knows the totals, and none of them said
  // what to DO. Only the exceptions are worth the top of the page, and when
  // there are none the strip disappears rather than announcing "0 problems".
  const attention = useMemo(() => {
    const items: { key: string; text: string }[] = [];
    const suspended = cinemas.filter((c) => !c.isActive);
    if (suspended.length) {
      items.push({
        key: "suspended",
        text: `${suspended.length} ${suspended.length === 1 ? "cinema is" : "cinemas are"} suspended`,
      });
    }
    // A cinema approved for concessions but granted nothing has a counter it
    // cannot use — the exact trap an allow list sets, so it is called out.
    const ungranted = cinemas.filter(
      (c) => c.beverageEligibility === "eligible" && (c.allowedConcessions || []).length === 0
    );
    if (ungranted.length) {
      items.push({
        key: "ungranted",
        text: `${ungranted.length} ${ungranted.length === 1 ? "cinema has" : "cinemas have"} no products granted and cannot sell concessions`,
      });
    }
    return items;
  }, [cinemas]);

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <Tabs defaultValue="cinemas" className="space-y-6">
        <TabsList className="grid w-full grid-cols-6 bg-gray-100 p-1 dark:bg-gray-900/70 sm:w-[800px]">
          <TabsTrigger value="cinemas">
            <Store className="mr-1.5 h-4 w-4" /> Cinemas
          </TabsTrigger>
          <TabsTrigger value="movies">
            <Clapperboard className="mr-1.5 h-4 w-4" /> Films
          </TabsTrigger>
          <TabsTrigger value="snacks">
            <Popcorn className="mr-1.5 h-4 w-4" /> Snacks
          </TabsTrigger>
          <TabsTrigger value="money">
            <Wallet className="mr-1.5 h-4 w-4" /> Money
          </TabsTrigger>
          <TabsTrigger value="tickets">
            <Ticket className="mr-1.5 h-4 w-4" /> Tickets
          </TabsTrigger>
          <TabsTrigger value="screen">
            <MonitorPlay className="mr-1.5 h-4 w-4" /> Screen
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cinemas" className="space-y-5">
          {/* One honest line instead of five counters. It says the size of the
              channel and the only exception worth stating up front. */}
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Cinemas
              </h2>
              <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                {summary.total === 0
                  ? "No cinemas yet."
                  : `${summary.total} ${summary.total === 1 ? "partner" : "partners"}` +
                    (summary.inactive ? ` · ${summary.inactive} suspended` : "") +
                    ` · avg cut ${formatRate(summary.avgTicketRate)} tickets, ${formatRate(summary.avgBeverageRate)} concessions`}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button variant="outline" onClick={fetchCinemas}>
                <RefreshCw className="mr-2 h-4 w-4" /> Refresh
              </Button>
              <Button className="bg-blue-600 text-white hover:bg-blue-700" onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" /> Add cinema
              </Button>
            </div>
          </div>

          {/* Only what needs doing, and gone entirely when nothing does. */}
          {attention.length > 0 && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-900/60 dark:bg-amber-950/30">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5" />
                Needs attention
              </p>
              <ul className="mt-1.5 space-y-0.5">
                {attention.map((item) => (
                  <li key={item.key} className="text-sm text-amber-900 dark:text-amber-200">
                    {item.text}
                  </li>
                ))}
              </ul>
            </div>
          )}

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
                  {/* Fixed layout with explicit widths.
                      An auto-layout table re-measures every column against its
                      content, so one long cinema name or a missing description
                      shifted every other column and made the rates and actions
                      sit at a different x on each row. The widths below are the
                      alignment fix; min-width keeps them from collapsing before
                      the container scrolls. */}
                  <table className="w-full min-w-[960px] table-fixed text-sm">
                    <colgroup>
                      <col className="w-[23%]" />
                      <col className="w-[17%]" />
                      <col className="w-[13%]" />
                      <col className="w-[8%]" />
                      <col className="w-[8%]" />
                      <col className="w-[13%]" />
                      <col className="w-[18%]" />
                    </colgroup>
                    <thead>
                      <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:text-gray-400">
                        <th className="px-5 py-3 font-medium">Cinema</th>
                        <th className="px-5 py-3 font-medium">Account</th>
                        <th className="px-5 py-3 font-medium">Status</th>
                        <th className="px-5 py-3 text-right font-medium">Ticket cut</th>
                        <th className="px-5 py-3 text-right font-medium">Beverage cut</th>
                        <th className="px-5 py-3 text-right font-medium">Can sell</th>
                        <th className="px-5 py-3 text-right font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cinemas.map((cinema) => (
                        <tr
                          key={cinema._id}
                          className="border-b border-gray-100 align-middle last:border-0 dark:border-gray-800"
                        >
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              {buildImageUrl(cinema.image) ? (
                                <img
                                  src={buildImageUrl(cinema.image)!}
                                  alt={cinema.name}
                                  className="h-11 w-11 shrink-0 rounded-lg object-cover ring-1 ring-gray-200 dark:ring-gray-800"
                                />
                              ) : (
                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-xs font-semibold text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                                  {cinema.name.slice(0, 2).toUpperCase()}
                                </div>
                              )}
                              {/* min-w-0 so the truncation below actually
                                  applies — a flex child will not shrink past
                                  its content without it, and a long name pushed
                                  the column wider than its share. */}
                              <div className="min-w-0">
                                <p className="truncate font-medium text-gray-900 dark:text-gray-100">
                                  {cinema.name}
                                </p>
                                <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                                  {[cinema.city, cinema.description].filter(Boolean).join(" · ") || "Cinema"}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4 text-gray-600 dark:text-gray-400">
                            <p className="truncate">{cinema.account?.email || cinema.email || "—"}</p>
                            <p className="truncate text-xs">
                              {cinema.phoneNumber || cinema.account?.phoneNumber || "—"}
                            </p>
                          </td>
                          <td className="px-5 py-4">
                            {/* Both lines always render, so every row is the
                                same height whether or not a value is present. */}
                            <Badge variant={cinema.isActive ? "secondary" : "outline"}>
                              {cinema.isActive ? "Active" : "Suspended"}
                            </Badge>
                            <p className="mt-1 truncate text-xs text-gray-500 dark:text-gray-400">
                              {cinema.beverageEligibility === "eligible"
                                ? "Concessions approved"
                                : "Concessions blocked"}
                            </p>
                          </td>
                          <td className="whitespace-nowrap px-5 py-4 text-right tabular-nums text-gray-600 dark:text-gray-400">
                            {formatRate(cinema.ticketCommissionRate)}
                          </td>
                          <td className="whitespace-nowrap px-5 py-4 text-right tabular-nums text-gray-600 dark:text-gray-400">
                            {formatRate(cinema.beverageCommissionRate)}
                          </td>
                          {/* Granted products, as a control rather than a
                              number: the count is the thing an admin wants to
                              change, so reading it and changing it are the same
                              click. */}
                          <td className="whitespace-nowrap px-5 py-4 text-right">
                            <button
                              type="button"
                              onClick={() => setGranting(cinema)}
                              className={`rounded-md px-2 py-1 text-xs font-medium tabular-nums transition-colors ${
                                (cinema.allowedConcessions || []).length === 0
                                  ? "bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-950/50 dark:text-amber-300"
                                  : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                              }`}
                            >
                              <Popcorn className="mr-1 inline h-3.5 w-3.5" />
                              {(cinema.allowedConcessions || []).length === 0
                                ? "None granted"
                                : `${(cinema.allowedConcessions || []).length} granted`}
                            </button>
                          </td>
                          <td className="px-5 py-4">
                            {/* Icon buttons on a fixed grid rather than three
                                labelled ones: the labels changed per row
                                ("Revoke"/"Approve", "Suspend"/"Activate"), so
                                every row's buttons were a different width and
                                nothing lined up down the column. Each keeps its
                                label as a tooltip. */}
                            <div className="flex justify-end gap-1.5">
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                title="Edit this cinema"
                                onClick={() => openEdit(cinema)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                title="Manage this cinema's halls"
                                onClick={() => setManagingHalls(cinema)}
                              >
                                <DoorOpen className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                title={
                                  cinema.beverageEligibility === "eligible"
                                    ? "Block concessions"
                                    : "Approve concessions"
                                }
                                onClick={() => toggleEligibility(cinema)}
                              >
                                {cinema.beverageEligibility === "eligible" ? (
                                  <ShieldOff className="h-4 w-4" />
                                ) : (
                                  <ShieldCheck className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                title={cinema.isActive ? "Suspend this cinema" : "Activate this cinema"}
                                onClick={() => toggleStatus(cinema)}
                              >
                                {cinema.isActive ? (
                                  <PauseCircle className="h-4 w-4" />
                                ) : (
                                  <PlayCircle className="h-4 w-4" />
                                )}
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

        {/* Cross-cinema curation: what the public cinema page shows is decided
            here, not by the cinemas themselves. */}
        <TabsContent value="movies" className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Movies &amp; display
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Every film posted by every cinema. Choose what appears on the
              public cinema page — cinemas cannot promote themselves.
            </p>
          </div>
          <AdminMovieCuration />
        </TabsContent>

        <TabsContent value="snacks" className="space-y-5">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Snacks and drinks
            </h2>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
              The products cinemas can sell, and the artwork customers see. Adding
              one here does not put it on sale — grant it to a cinema on the
              Cinemas tab.
            </p>
          </div>
          <AdminConcessionCatalogue />
        </TabsContent>

        <TabsContent value="money" className="space-y-5">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Cinema money
            </h2>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
              What every cinema has taken, what they&apos;re owed, and where new
              payments settle. Click a row for one cinema&apos;s full ledger.
            </p>
          </div>
          <AdminCinemaFinancePanel token={token} />
        </TabsContent>

        <TabsContent value="tickets" className="space-y-5">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Ticket sales
            </h2>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
              Pick a cinema, a film and a screening to see what it sold and who bought it.
            </p>
          </div>
          <AdminCinemaTicketsPanel token={token} />
        </TabsContent>

        <TabsContent value="screen" className="space-y-5">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Seat-selection screen
            </h2>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
              One ambient clip, shown on every cinema&apos;s auditorium screen while a
              customer picks their seats — on the web and in the app.
            </p>
          </div>
          <AdminScreenVideoSection />
        </TabsContent>
      </Tabs>

      {granting && (
        <CinemaConcessionsGrant
          cinemaId={granting._id}
          cinemaName={granting.name}
          granted={granting.allowedConcessions || []}
          open={!!granting}
          onOpenChange={(open) => !open && setGranting(null)}
          // Patched in place rather than refetching the page: the server has
          // just confirmed this exact list, so a round trip would only risk
          // showing something older.
          onSaved={(next) => {
            setCinemas((rows) =>
              rows.map((row) =>
                row._id === granting._id ? { ...row, allowedConcessions: next } : row
              )
            );
            setGranting(null);
          }}
        />
      )}

      {managingHalls && (
        <AdminCinemaHalls
          cinemaId={managingHalls._id}
          cinemaName={managingHalls.name}
          open={!!managingHalls}
          onOpenChange={(open) => !open && setManagingHalls(null)}
        />
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
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
              <Label>Promo video</Label>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Plays on this cinema&apos;s own page. Optional — swap it out whenever you want something different playing.
              </p>
              <div className="flex items-center gap-4">
                {videoPreview ? (
                  <video
                    key={videoPreview}
                    src={videoPreview}
                    controls
                    muted
                    className="h-20 w-32 rounded-xl bg-black object-cover ring-1 ring-gray-200 dark:ring-gray-800"
                  />
                ) : (
                  <div className="flex h-20 w-32 items-center justify-center rounded-xl border border-dashed border-gray-300 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
                    No video
                  </div>
                )}
                <Input
                  type="file"
                  accept="video/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setVideoFile(file);
                    setVideoPreview(file ? URL.createObjectURL(file) : buildVideoUrl(editing?.promoVideo));
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
              <Label>Email {editing && "(also their sign-in email)"}</Label>
              <Input value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} />
            </div>
            {!editing && (
              <div className="space-y-1.5">
                <PasswordField
                  label="Password"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(v) => setForm((prev) => ({ ...prev, password: v }))}
                />
              </div>
            )}
            {editing && (
              <div className="space-y-3 rounded-xl border border-gray-200 p-4 dark:border-gray-800 sm:col-span-2">
                <div>
                  <Label>Reset password</Label>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Sets what {editing.name} signs in with directly — no current password needed.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <PasswordField
                    label="New password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={setNewPassword}
                  />
                  <PasswordField
                    label="Confirm new password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={setConfirmPassword}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  disabled={resettingPassword || newPassword.length < 6}
                  onClick={resetPassword}
                >
                  {resettingPassword ? "Resetting…" : "Reset password"}
                </Button>
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
